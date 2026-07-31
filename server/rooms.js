const { scoreAll } = require('./scoring');
const { getCaseAnswer, getChoices } = require('./db');

// Map<roomId, GameRoom>
const rooms = new Map();

function genRoomId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function createRoom(caseId, hostSocketId, hostName) {
  const roomId = genRoomId();
  const room = {
    roomId,
    caseId,
    hostId: hostSocketId,
    phase: 'lobby', // lobby | playing | revealed
    players: [{ id: hostSocketId, name: hostName, connected: true }],
    sharedNote: '',
    playerAnswers: {},    // { socketId: { suspect, weapon, motive } }
    revealedClues: [],    // 공개된 단서카드 id 목록 (순서 포함)
    warningUsed: false,   // 경고 카드 사용 여부
  };
  rooms.set(roomId, room);
  return room;
}

function joinRoom(roomId, socketId, playerName) {
  const room = rooms.get(roomId);
  if (!room) return { ok: false, error: 'ROOM_NOT_FOUND' };
  if (room.phase !== 'lobby') return { ok: false, error: 'GAME_ALREADY_STARTED' };
  if (room.players.length >= 8) return { ok: false, error: 'ROOM_FULL' };

  const existing = room.players.find(p => p.id === socketId);
  if (!existing) {
    room.players.push({ id: socketId, name: playerName, connected: true });
  } else {
    existing.connected = true;
  }
  return { ok: true };
}

function leaveRoom(roomId, socketId) {
  const room = rooms.get(roomId);
  if (!room) return;

  const player = room.players.find(p => p.id === socketId);
  if (player) player.connected = false;

  // 전원 연결 끊기면 방 삭제
  if (room.players.every(p => !p.connected)) {
    rooms.delete(roomId);
    return;
  }

  // 방장 이탈 시 다음 연결된 플레이어에게 위임
  if (room.hostId === socketId) {
    const next = room.players.find(p => p.connected);
    if (next) room.hostId = next.id;
  }
}

function getRoom(roomId) {
  return rooms.get(roomId) ?? null;
}

function updateNote(roomId, text) {
  const room = rooms.get(roomId);
  if (room) room.sharedNote = text;
}

// 단서 카드 공개 (중복 무시, 순서 기록)
function revealClue(roomId, clueId) {
  const room = rooms.get(roomId);
  if (!room || room.revealedClues.includes(clueId)) return false;
  room.revealedClues.push(clueId);
  return true;
}

// 경고 카드 사용
function useWarning(roomId) {
  const room = rooms.get(roomId);
  if (!room || room.warningUsed) return false;
  room.warningUsed = true;
  return true;
}

// returns true if all connected players have submitted
function submitAnswer(roomId, socketId, answers) {
  const room = rooms.get(roomId);
  if (!room) return false;
  room.playerAnswers[socketId] = answers;
  const connected = room.players.filter(p => p.connected);
  return connected.every(p => room.playerAnswers[p.id]);
}

function revealRoom(roomId) {
  const room = rooms.get(roomId);
  if (!room) return null;
  room.phase = 'revealed';

  const caseAnswer = getCaseAnswer(room.caseId);
  const scores = {};
  for (const [pid, answers] of Object.entries(room.playerAnswers)) {
    scores[pid] = caseAnswer ? scoreAll(answers, caseAnswer, getChoices(room.caseId)) : null;
  }

  return {
    caseAnswer, playerAnswers: room.playerAnswers, scores,
    caseId: room.caseId, revealedClues: room.revealedClues, warningUsed: room.warningUsed,
    players: room.players.map(p => ({ id: p.id, name: p.name })),
  };
}

// 클라이언트에 보내도 안전한 room 상태 (answer 제외)
function roomToClient(room) {
  return {
    roomId: room.roomId,
    caseId: room.caseId,
    hostId: room.hostId,
    phase: room.phase,
    players: room.players,
    sharedNote: room.sharedNote,
    revealedClues: room.revealedClues,
    warningUsed: room.warningUsed,
  };
}

module.exports = {
  createRoom, joinRoom, leaveRoom, getRoom,
  updateNote, revealClue, useWarning,
  submitAnswer, revealRoom, roomToClient,
};
