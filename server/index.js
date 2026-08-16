const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
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
  if (!email || !password || !name) return res.status(400).json({ error: 'MISSING_FIELDS' });
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
  } catch {}

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

  socket.on('room:create', ({ caseId, playerName }, ack) => {
    const room = createRoom(caseId, socket.id, playerName || '익명');
    currentRoomId = room.roomId;
    socket.join(room.roomId);
    ack?.({ roomId: room.roomId });
    socket.emit('room:state', roomToClient(room));
  });

  socket.on('room:join', ({ roomId, playerName }, ack) => {
    const result = joinRoom(roomId, socket.id, playerName || '익명');
    if (!result.ok) return ack?.({ ok: false, error: result.error });
    currentRoomId = roomId;
    socket.join(roomId);
    ack?.({ ok: true });
    io.to(roomId).emit('room:state', roomToClient(getRoom(roomId)));
  });

  socket.on('game:start', () => {
    const room = getRoom(currentRoomId);
    if (!room || room.hostId !== socket.id) return;
    room.phase = 'playing';
    io.to(currentRoomId).emit('game:started', { caseId: room.caseId });
    io.to(currentRoomId).emit('room:state', roomToClient(room));
  });

  socket.on('note:update', ({ text }) => {
    updateNote(currentRoomId, text);
    socket.to(currentRoomId).emit('note:synced', { text });
  });

  // 단서 카드 공개 (최초 공개 시 전체 브로드캐스트)
  socket.on('clue:reveal', ({ clueId }) => {
    const added = revealClue(currentRoomId, clueId);
    if (added) {
      const room = getRoom(currentRoomId);
      io.to(currentRoomId).emit('clue:revealed', { clueId, revealedClues: room.revealedClues });
    }
    // 포커스(현재 보고있는 카드)는 별도 이벤트
    socket.to(currentRoomId).emit('clue:focused', { playerId: socket.id, clueId });
  });

  socket.on('clue:focus', ({ clueId }) => {
    socket.to(currentRoomId).emit('clue:focused', { playerId: socket.id, clueId });
  });

  // 경고 카드 사용
  socket.on('warning:use', () => {
    const ok = useWarning(currentRoomId);
    if (ok) io.to(currentRoomId).emit('warning:used');
  });

  socket.on('pointer:move', ({ x, y }) => {
    socket.to(currentRoomId).emit('pointer:moved', { playerId: socket.id, x, y });
  });

  socket.on('pointer:leave', () => {
    socket.to(currentRoomId).emit('pointer:cleared', { playerId: socket.id });
  });

  socket.on('answer:submit', ({ answers }, ack) => {
    const allDone = submitAnswer(currentRoomId, socket.id, answers);
    io.to(currentRoomId).emit('answer:submitted', { playerId: socket.id });
    ack?.({ ok: true });
    if (allDone) doReveal(currentRoomId);
  });

  socket.on('game:reveal', () => {
    const room = getRoom(currentRoomId);
    if (room?.hostId === socket.id) doReveal(currentRoomId);
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
      history.add({
        userId, caseId: result.caseId, caseTitle, mode: 'multi',
        correct, total,
        stamp: correct === total ? 'SOLVED' : correct === 0 ? 'FAILED' : 'PARTIAL',
        playedAt: new Date().toISOString(),
      });
    }
  } catch {}
}

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => console.log(`server listening on :${PORT}`));
