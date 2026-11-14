const path = require('path');

// server/.env 로드 — 다른 모듈 require 전에 실행해야 DATA_DIR 등이 반영된다.
// 이미 설정된 환경변수가 우선. loadEnvFile은 Node ≥20.12, 없는 버전은 건너뜀(환경변수 직접 설정 필요).
try {
  process.loadEnvFile?.(path.join(__dirname, '.env'));
} catch (e) {
  if (e.code !== 'ENOENT') console.warn('[env] .env load failed:', e.message);
}

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const {
  createRoom, joinRoom, leaveRoom, getRoom,
  updateNote, revealClue, useWarning,
  submitAnswer, revealRoom, roomToClient,
} = require('./rooms');
const { casesForClient, getCaseAnswer, getChoices } = require('./db');
const { scoreAll } = require('./scoring');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const users = require('./users');
const { DATA_DIR } = require('./jsonStore');
const history = require('./history');

const JWT_SECRET = process.env.JWT_SECRET || 'minicrimessecret2025';
if (!process.env.JWT_SECRET) console.warn('[WARN] JWT_SECRET not set — using insecure default. Set env var in production.');

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '30d' });
}

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'INVALID_TOKEN' });
  }
}

const app = express();
const httpServer = createServer(app);
const corsOrigin = process.env.CLIENT_URL || 'http://localhost:5173';
const io = new Server(httpServer, {
  cors: { origin: corsOrigin },
});

app.use(cors({ origin: corsOrigin }));
app.use(express.json());

// ── 인증 ──────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  const { email, password, name } = req.body ?? {};
  if (!email || !password || !name?.trim()) return res.status(400).json({ error: 'MISSING_FIELDS' });
  if (users.findByEmail(email)) return res.status(409).json({ error: 'EMAIL_EXISTS' });
  if (password.length < 6) return res.status(400).json({ error: 'PASSWORD_TOO_SHORT' });
  const passwordHash = await bcrypt.hash(password, 10);
  const user = users.create({ email, passwordHash, name });
  if (!user) return res.status(409).json({ error: 'EMAIL_EXISTS' });
  res.json({ token: signToken(user), name: user.name, email: user.email });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) return res.status(400).json({ error: 'MISSING_FIELDS' });
  const user = users.findByEmail(email);
  if (!user) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
  res.json({ token: signToken(user), name: user.name, email: user.email });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ id: req.user.id, email: req.user.email, name: req.user.name });
});

// 케이스 메타 (answer 제거 후 응답, warningCard 포함)
app.get('/api/cases', (req, res) => {
  res.json(casesForClient());
});

// 솔로 모드 채점 — answer 는 서버에서만 보관
app.post('/api/score', (req, res) => {
  const { caseId, answers } = req.body;
  const caseAnswer = getCaseAnswer(caseId);
  if (!caseAnswer) return res.status(404).json({ error: 'case not found' });

  const scores = scoreAll(answers ?? {}, caseAnswer, getChoices(caseId));

  // 히스토리 기록 (토큰 있을 때만)
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const u = jwt.verify(token, JWT_SECRET);
      const allScores = Object.values(scores);
      const correct = allScores.filter(s => s.correct).length;
      const total = allScores.length;
      const caseList = casesForClient();
      const caseTitle = caseList.find(c => c.id === caseId)?.titleKo ?? caseId;
      history.add({
        userId: u.id, caseId, caseTitle, mode: 'solo',
        correct, total,
        stamp: correct === total ? 'SOLVED' : correct === 0 ? 'FAILED' : 'PARTIAL',
        playedAt: new Date().toISOString(),
      });
    }
  } catch (e) {
    console.error('[history] solo add failed:', e.message);
  }

  res.json({ caseAnswer, scores });
});

app.get('/api/history', authMiddleware, (req, res) => {
  res.json(history.getByUser(req.user.id));
});

// 프로덕션: Vite 빌드 정적 서빙
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

// socketId → userId (로그인한 사용자만)
const socketUserMap = new Map();

io.on('connection', (socket) => {
  let currentRoomId = null;
  try {
    const tok = socket.handshake.auth?.token;
    if (tok) socketUserMap.set(socket.id, jwt.verify(tok, JWT_SECRET).id);
  } catch {}

  // 모든 이벤트 핸들러 공통 래퍼.
  // socket.io 4.8은 리스너를 process.nextTick에서 호출하므로 핸들러 예외가 uncaughtException → 프로세스 종료로 이어진다
  // (예: payload 없이 emit('note:update') 한 번으로 서버 다운). payload를 객체로 정규화하고 예외를 격리한다.
  const on = (event, handler) => socket.on(event, (payload, ack) => {
    if (typeof payload === 'function') { ack = payload; payload = undefined; } // emit(ev, cb) 형태
    const data = payload && typeof payload === 'object' ? payload : {};
    const reply = typeof ack === 'function' ? ack : undefined;
    try {
      handler(data, reply);
    } catch (e) {
      console.error(`[socket] ${event} handler error socket=${socket.id}:`, e);
      reply?.({ ok: false, error: 'INTERNAL' });
    }
  });

  on('room:create', ({ caseId, playerName }, ack) => {
    const room = createRoom(caseId, socket.id, playerName || '익명');
    currentRoomId = room.roomId;
    socket.join(room.roomId);
    ack?.({ roomId: room.roomId });
    socket.emit('room:state', roomToClient(room));
  });

  on('room:join', ({ roomId, playerName }, ack) => {
    const result = joinRoom(roomId, socket.id, playerName || '익명');
    if (!result.ok) return ack?.({ ok: false, error: result.error });
    currentRoomId = roomId;
    socket.join(roomId);
    ack?.({ ok: true });
    io.to(roomId).emit('room:state', roomToClient(getRoom(roomId)));
  });

  // 현재 방 상태 pull — room:state push는 페이지 전환(navigate) 중 구독 전에 도착해 유실될 수 있어,
  // Lobby/Game 페이지가 마운트 시 직접 요청한다.
  // 요청 roomId(URL)와 이 소켓이 create/join 한 방이 다르면 거부 — 뒤로가기 등으로 이전 방 상태가 노출되는 것 방지.
  on('room:get', (data, ack) => {
    if (!ack) return;
    const reqId = data.roomId;
    const room = getRoom(currentRoomId);
    if (!room || room.roomId !== reqId) {
      // currentRoomId 없음 = 새 소켓(새로고침 등) 정상 경로라 로그 생략
      if (currentRoomId) console.warn(`[room:get] mismatch socket=${socket.id} cur=${currentRoomId} req=${reqId}`);
      return ack({ ok: false, error: 'ROOM_NOT_FOUND' });
    }
    ack({ ok: true, room: roomToClient(room) });
  });

  on('game:start', () => {
    const room = getRoom(currentRoomId);
    // lobby에서만 개시 — 정답 공개 후 재개시 시 이전 답안으로 재공개·history 중복 기록 방지
    if (!room || room.hostId !== socket.id || room.phase !== 'lobby') return;
    room.phase = 'playing';
    io.to(currentRoomId).emit('game:started', { caseId: room.caseId });
    io.to(currentRoomId).emit('room:state', roomToClient(room));
  });

  on('note:update', ({ text }) => {
    updateNote(currentRoomId, text);
    socket.to(currentRoomId).emit('note:synced', { text });
  });

  // 단서 카드 공개 (최초 공개 시 전체 브로드캐스트)
  on('clue:reveal', ({ clueId }) => {
    const added = revealClue(currentRoomId, clueId);
    if (added) {
      const room = getRoom(currentRoomId);
      io.to(currentRoomId).emit('clue:revealed', { clueId, revealedClues: room.revealedClues });
    }
    // 포커스(현재 보고있는 카드)는 별도 이벤트
    socket.to(currentRoomId).emit('clue:focused', { playerId: socket.id, clueId });
  });

  on('clue:focus', ({ clueId }) => {
    socket.to(currentRoomId).emit('clue:focused', { playerId: socket.id, clueId });
  });

  // 경고 카드 사용
  on('warning:use', () => {
    const ok = useWarning(currentRoomId);
    if (ok) io.to(currentRoomId).emit('warning:used');
  });

  on('pointer:move', ({ x, y }) => {
    socket.to(currentRoomId).emit('pointer:moved', { playerId: socket.id, x, y });
  });

  on('pointer:leave', () => {
    socket.to(currentRoomId).emit('pointer:cleared', { playerId: socket.id });
  });

  // 진행 중(playing)일 때만 제출·공개 허용 — 로비에서 제출 시 즉시 공개되어 정답이 전원에게 전송되던 문제 차단
  on('answer:submit', (data, ack) => {
    const reply = ack ?? (() => {});
    const room = getRoom(currentRoomId);
    if (!room || room.phase !== 'playing') {
      console.warn(`[answer:submit] rejected socket=${socket.id} room=${currentRoomId} phase=${room?.phase}`);
      return reply({ ok: false, error: 'NOT_PLAYING' });
    }
    const answers = data.answers && typeof data.answers === 'object' ? data.answers : {};
    const allDone = submitAnswer(currentRoomId, socket.id, answers);
    io.to(currentRoomId).emit('answer:submitted', { playerId: socket.id });
    reply({ ok: true });
    if (allDone) doReveal(currentRoomId);
  });

  on('game:reveal', () => {
    const room = getRoom(currentRoomId);
    if (room?.hostId === socket.id && room.phase === 'playing') doReveal(currentRoomId);
  });

  socket.on('disconnect', () => {
    socketUserMap.delete(socket.id);
    if (!currentRoomId) return;
    leaveRoom(currentRoomId, socket.id);
    socket.to(currentRoomId).emit('player:left', { playerId: socket.id });
    const room = getRoom(currentRoomId);
    if (room) io.to(currentRoomId).emit('room:state', roomToClient(room));
  });
});

function doReveal(roomId) {
  const result = revealRoom(roomId);
  if (!result) return;
  io.to(roomId).emit('game:revealed', result);

  // 멀티 히스토리 기록 (로그인한 플레이어만)
  try {
    const caseList = casesForClient();
    const caseTitle = caseList.find(c => c.id === result.caseId)?.titleKo ?? result.caseId;
    const total = result.caseAnswer ? Object.keys(result.caseAnswer).length : 3;
    for (const [pid, scores] of Object.entries(result.scores ?? {})) {
      const userId = socketUserMap.get(pid);
      if (!userId) continue;
      const correct = Object.values(scores).filter(s => s.correct).length;
      try { // 한 명 실패가 나머지 기록을 막지 않도록 개별 격리
        history.add({
          userId, caseId: result.caseId, caseTitle, mode: 'multi',
          correct, total,
          stamp: correct === total ? 'SOLVED' : correct === 0 ? 'FAILED' : 'PARTIAL',
          playedAt: new Date().toISOString(),
        });
      } catch (e) {
        console.error(`[history] multi add failed user=${userId}:`, e.message);
      }
    }
  } catch (e) {
    console.error('[history] multi record failed:', e.message);
  }
}

// 전역 에러 핸들러 (Express 5: async 라우트 에러 자동 전달)
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message ?? err);
  // status가 지정된 의도된 오류만 메시지 노출. fs 오류 등 내부 메시지(서버 절대경로 포함)는 숨김
  res.status(err.status ?? 500).json({ error: err.status ? err.message : 'INTERNAL_SERVER_ERROR' });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`server listening on :${PORT}`);
  console.log(`[store] data dir: ${DATA_DIR}`); // 영속 디스크 지정 여부 확인용
});
