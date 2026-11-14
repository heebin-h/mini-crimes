// 방장 브라우저에서 실행되는 방 로직 (이전 server/rooms.js + server/index.js 소켓 핸들러 이식).
// 전송 계층과 분리된 순수 모듈 — PeerJS에 의존하지 않아 node --test로 검증한다.
//
// 이벤트 규약은 기존 Socket.IO 서버와 동일하다(클라이언트 화면 코드 호환).
// 모든 입력은 위조 가능하다는 전제로 검증한다(게스트 브라우저도 임의 메시지를 보낼 수 있음).

import { scoreAll } from '../game/grading.js';

export const LIMITS = {
  maxPlayers: 8,
  nameLen: 20,
  noteLen: 5000,
  answerLen: 200,
  graceMs: 20_000,          // 끊김 후 퇴장 판정 유예 — 잠깐 끊긴 사람을 빼고 정답이 공개되는 것 방지
  rate: { capacity: 60, refillPerSec: 30 }, // 피어별 이벤트 토큰 버킷
};

const QUESTION_IDS = ['suspect', 'weapon', 'motive'];

const str = (v, max) => (typeof v === 'string' ? v : '').trim().slice(0, max);

/**
 * @param {object} deps
 * @param {(caseId:string)=>object|null} deps.getCase      케이스 메타(단서 id 검증용)
 * @param {(caseId:string)=>Promise<object|null>} deps.loadAnswer 정답 로드(채점 시)
 * @param {(peerId:string, ev:string, payload:any)=>void} deps.send
 * @param {(ev:string, payload:any, exceptId?:string)=>void} deps.broadcast  방 인원 전체(방장 포함)
 * @param {()=>void} [deps.onChange]  상태 변경 알림(방장 세션 저장용)
 * @param {()=>number} [deps.now]
 * @param {(fn:Function, ms:number)=>any} [deps.setTimer]
 * @param {(t:any)=>void} [deps.clearTimer]
 * @param {(msg:string, ...a:any[])=>void} [deps.log]
 */
export function createHostRoom(deps) {
  const now = deps.now ?? (() => Date.now());
  const setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer ?? (t => clearTimeout(t));
  const log = deps.log ?? ((...a) => console.warn(...a));
  const onChange = deps.onChange ?? (() => {});

  let room = null;            // 방장 1명당 방 1개
  const buckets = new Map();  // peerId → { tokens, at }
  const graceTimers = new Map(); // playerId → timer
  let revealing = false;

  // ── 조회·직렬화 ─────────────────────────────
  function toClient() {
    if (!room) return null;
    const { roomId, caseId, hostId, phase, players, sharedNote, revealedClues, warningUsed } = room;
    return {
      roomId, caseId, hostId, phase, sharedNote, revealedClues, warningUsed,
      players: players.map(({ id, name, connected }) => ({ id, name, connected })),
    };
  }
  const member = id => room?.players.find(p => p.id === id) ?? null;
  const changed = () => onChange();
  const pushState = () => { deps.broadcast('room:state', toClient()); changed(); };

  function allowed(peerId) {
    const { capacity, refillPerSec } = LIMITS.rate;
    const t = now();
    const b = buckets.get(peerId) ?? { tokens: capacity, at: t };
    b.tokens = Math.min(capacity, b.tokens + ((t - b.at) / 1000) * refillPerSec);
    b.at = t;
    if (b.tokens < 1) { buckets.set(peerId, b); return false; }
    b.tokens -= 1;
    buckets.set(peerId, b);
    return true;
  }

  // 전원 제출 판정: 연결 중이거나 유예 중인 플레이어 모두 제출해야 공개
  function allSubmitted() {
    const t = now();
    const active = room.players.filter(p => p.connected || (p.graceUntil ?? 0) > t);
    return active.length > 0 && active.every(p => room.playerAnswers[p.id]);
  }

  async function reveal() {
    if (!room || room.phase !== 'playing' || revealing) return;
    revealing = true;
    try {
      const caseAnswer = await deps.loadAnswer(room.caseId);
      room.phase = 'revealed';
      const scores = {};
      for (const [pid, answers] of Object.entries(room.playerAnswers)) {
        scores[pid] = caseAnswer ? scoreAll(answers, caseAnswer) : null;
      }
      deps.broadcast('game:revealed', {
        caseAnswer, playerAnswers: room.playerAnswers, scores,
        caseId: room.caseId, revealedClues: room.revealedClues, warningUsed: room.warningUsed,
        players: room.players.map(p => ({ id: p.id, name: p.name })),
      });
      changed();
    } catch (e) {
      log('[host] reveal failed', e);
    } finally {
      revealing = false;
    }
  }

  // ── 이벤트 핸들러 ─────────────────────────────
  const handlers = {
    'room:create'(from, { roomId, caseId, playerName }, ack) {
      if (!deps.getCase(caseId)) return ack?.({ ok: false, error: 'CASE_NOT_FOUND' });
      room = {
        roomId, caseId, hostId: from, phase: 'lobby',
        players: [{ id: from, name: str(playerName, LIMITS.nameLen) || '익명', connected: true }],
        sharedNote: '', playerAnswers: {}, revealedClues: [], warningUsed: false,
      };
      ack?.({ ok: true, roomId });
      deps.send(from, 'room:state', toClient());
      changed();
    },

    'room:join'(from, { roomId, playerName }, ack) {
      if (!room || roomId !== room.roomId) return ack?.({ ok: false, error: 'ROOM_NOT_FOUND' });
      const name = str(playerName, LIMITS.nameLen) || '익명';

      const existing = member(from);
      if (existing) { existing.connected = true; cancelGrace(existing.id); ack?.({ ok: true }); return pushState(); }

      // 재접속: 연결이 끊긴 같은 이름 플레이어 → 새 peer id로 교체 (방장 권한 포함)
      const away = room.players.find(p => !p.connected && p.name === name);
      if (away) {
        cancelGrace(away.id);
        const oldId = away.id;
        away.id = from;
        away.connected = true;
        delete away.graceUntil;
        if (room.playerAnswers[oldId]) { room.playerAnswers[from] = room.playerAnswers[oldId]; delete room.playerAnswers[oldId]; }
        ack?.({ ok: true });
        return pushState();
      }

      if (room.phase !== 'lobby') return ack?.({ ok: false, error: 'GAME_ALREADY_STARTED' });
      if (room.players.length >= LIMITS.maxPlayers) return ack?.({ ok: false, error: 'ROOM_FULL' });
      // 같은 이름이 접속 중이면 거부 — 이름 기반 재접속이 다른 사람과 섞이지 않게
      if (room.players.some(p => p.name === name)) return ack?.({ ok: false, error: 'NAME_TAKEN' });

      room.players.push({ id: from, name, connected: true });
      ack?.({ ok: true });
      pushState();
    },

    'room:get'(from, { roomId }, ack) {
      if (!ack) return;
      if (!room || room.roomId !== roomId || !member(from)) return ack({ ok: false, error: 'ROOM_NOT_FOUND' });
      ack({ ok: true, room: toClient() });
    },

    'game:start'(from) {
      if (room?.hostId !== from || room.phase !== 'lobby') return;
      room.phase = 'playing';
      deps.broadcast('game:started', { caseId: room.caseId });
      pushState();
    },

    'note:update'(from, { text }) {
      if (room?.phase !== 'playing') return;
      const t = (typeof text === 'string' ? text : '').slice(0, LIMITS.noteLen);
      room.sharedNote = t;
      deps.broadcast('note:synced', { text: t }, from);
      changed();
    },

    'clue:reveal'(from, { clueId }) {
      if (room?.phase !== 'playing') return;
      const c = deps.getCase(room.caseId);
      if (!c?.clueCards.some(cc => cc.id === clueId)) return;
      if (!room.revealedClues.includes(clueId)) {
        room.revealedClues.push(clueId);
        deps.broadcast('clue:revealed', { clueId, revealedClues: room.revealedClues });
        changed();
      }
      deps.broadcast('clue:focused', { playerId: from, clueId }, from);
    },

    'clue:focus'(from, { clueId }) {
      if (room?.phase !== 'playing') return;
      const id = clueId === null ? null : str(clueId, 8);
      deps.broadcast('clue:focused', { playerId: from, clueId: id }, from);
    },

    'warning:use'() {
      if (room?.phase !== 'playing' || room.warningUsed) return;
      room.warningUsed = true;
      deps.broadcast('warning:used');
      changed();
    },

    'pointer:move'(from, { x, y }) {
      if (room?.phase !== 'playing' || !Number.isFinite(x) || !Number.isFinite(y)) return;
      const clamp = v => Math.min(1, Math.max(0, v));
      deps.broadcast('pointer:moved', { playerId: from, x: clamp(x), y: clamp(y) }, from);
    },

    'pointer:leave'(from) {
      if (room?.phase !== 'playing') return;
      deps.broadcast('pointer:cleared', { playerId: from }, from);
    },

    'answer:submit'(from, { answers }, ack) {
      const reply = ack ?? (() => {});
      if (room?.phase !== 'playing') return reply({ ok: false, error: 'NOT_PLAYING' });
      const src = answers && typeof answers === 'object' ? answers : {};
      const clean = Object.fromEntries(QUESTION_IDS.map(q => [q, str(src[q], LIMITS.answerLen)]));
      room.playerAnswers[from] = clean;
      deps.broadcast('answer:submitted', { playerId: from });
      reply({ ok: true });
      changed();
      if (allSubmitted()) reveal();
    },

    'game:reveal'(from) {
      if (room?.hostId === from && room.phase === 'playing') reveal();
    },
  };

  const OPEN_EVENTS = new Set(['room:create', 'room:join', 'room:get']); // 방 인원이 아니어도 받는 이벤트

  /** 전송 계층이 받은 이벤트 처리. 예외는 격리(방장 브라우저가 멈추지 않게). */
  function handle(from, ev, payload, ack) {
    const reply = typeof ack === 'function' ? ack : undefined;
    const fn = Object.hasOwn(handlers, ev) ? handlers[ev] : null;
    if (!fn) return reply?.({ ok: false, error: 'UNKNOWN_EVENT' });
    if (!allowed(from)) return reply?.({ ok: false, error: 'RATE_LIMITED' });
    if (!OPEN_EVENTS.has(ev) && !member(from)) return reply?.({ ok: false, error: 'NOT_IN_ROOM' });
    const data = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
    try {
      fn(from, data, reply);
    } catch (e) {
      log(`[host] ${ev} handler error from=${from}`, e);
      reply?.({ ok: false, error: 'INTERNAL' });
    }
  }

  // ── 연결 끊김 (유예 후 퇴장) ─────────────────────
  function cancelGrace(id) {
    const t = graceTimers.get(id);
    if (t) { clearTimer(t); graceTimers.delete(id); }
  }

  function peerDisconnected(peerId) {
    buckets.delete(peerId);
    const p = member(peerId);
    if (!p || !p.connected) return;
    p.connected = false;
    p.graceUntil = now() + LIMITS.graceMs;
    deps.broadcast('player:left', { playerId: peerId }, peerId);
    pushState();
    cancelGrace(peerId);
    graceTimers.set(peerId, setTimer(() => {
      graceTimers.delete(peerId);
      const q = member(peerId);
      if (q && !q.connected) {
        delete q.graceUntil;
        changed();
        // 유예 만료로 남은 인원이 모두 제출한 상태가 됐으면 공개
        if (room?.phase === 'playing' && allSubmitted()) reveal();
      }
    }, LIMITS.graceMs));
  }

  // ── 방장 새로고침 복구 ─────────────────────────
  function snapshot() {
    return room ? JSON.parse(JSON.stringify(room)) : null;
  }

  /** 저장된 방 상태로 복구. 방장 본인(newHostId)은 연결, 나머지는 끊김+유예로 표시. */
  function restore(saved, newHostId) {
    if (!saved?.roomId) return false;
    room = saved;
    const oldHost = room.hostId;
    const hostPlayer = member(oldHost);
    if (hostPlayer) hostPlayer.id = newHostId;
    if (room.playerAnswers[oldHost] && oldHost !== newHostId) {
      room.playerAnswers[newHostId] = room.playerAnswers[oldHost];
      delete room.playerAnswers[oldHost];
    }
    room.hostId = newHostId;
    for (const p of room.players) {
      if (p.id === newHostId) { p.connected = true; delete p.graceUntil; continue; }
      if (p.connected) { p.connected = false; p.graceUntil = now() + LIMITS.graceMs; }
      const pid = p.id;
      cancelGrace(pid);
      graceTimers.set(pid, setTimer(() => {
        graceTimers.delete(pid);
        const q = member(pid);
        if (q && !q.connected) { delete q.graceUntil; changed(); if (room?.phase === 'playing' && allSubmitted()) reveal(); }
      }, LIMITS.graceMs));
    }
    changed();
    return true;
  }

  function dispose() {
    for (const t of graceTimers.values()) clearTimer(t);
    graceTimers.clear();
    room = null;
  }

  return { handle, peerDisconnected, snapshot, restore, dispose, getRoom: toClient, members: () => room?.players.map(p => p.id) ?? [] };
}
