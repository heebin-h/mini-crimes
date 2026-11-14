// 방장 방 로직 단위 테스트 — node --test (외부 의존 없음)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHostRoom, LIMITS } from '../src/net/hostRoom.js';
import { getCase } from '../src/data/cases.js';
import answers from '../src/data/answers.js';

const HOST = 'host-peer';
const CORRECT = { suspect: answers.s1e01.suspect.text, weapon: answers.s1e01.weapon.text, motive: answers.s1e01.motive.text };

function setup() {
  let t = 1_000_000;
  const timers = [];
  const sent = [];      // [to, ev, payload]
  const log = [];
  const h = createHostRoom({
    getCase,
    loadAnswer: async id => answers[id] ?? null,
    send: (to, ev, p) => sent.push([to, ev, p]),
    broadcast: (ev, p, except) => { for (const id of h.members()) if (id !== except) sent.push([id, ev, p]); },
    now: () => t,
    setTimer: (fn, ms) => { const x = { fn, at: t + ms }; timers.push(x); return x; },
    clearTimer: x => { const i = timers.indexOf(x); if (i >= 0) timers.splice(i, 1); },
    log: (...a) => log.push(a),
  });
  const call = (from, ev, payload) => new Promise(resolve => {
    let done = false;
    h.handle(from, ev, payload, r => { done = true; resolve(r); });
    setImmediate(() => { if (!done) resolve(undefined); });
  });
  const advance = ms => { t += ms; for (const x of [...timers]) if (x.at <= t) { timers.splice(timers.indexOf(x), 1); x.fn(); } };
  const got = (to, ev) => sent.filter(([id, e]) => id === to && e === ev);
  return { h, call, sent, got, advance, log, tick: ms => { t += ms; } };
}
const flush = () => new Promise(r => setImmediate(r));

async function lobbyWith(n = 1) {
  const s = setup();
  assert.deepEqual(await s.call(HOST, 'room:create', { roomId: 'ABC123', caseId: 's1e01', playerName: '호스트' }), { ok: true, roomId: 'ABC123' });
  for (let i = 1; i <= n; i++) assert.equal((await s.call(`g${i}`, 'room:join', { roomId: 'ABC123', playerName: `게스트${i}` })).ok, true);
  return s;
}

test('방 생성: 없는 케이스 거부, 이름 길이 제한', async () => {
  const s = setup();
  assert.deepEqual(await s.call(HOST, 'room:create', { roomId: 'R', caseId: 'NOPE', playerName: 'x' }), { ok: false, error: 'CASE_NOT_FOUND' });
  await s.call(HOST, 'room:create', { roomId: 'R', caseId: 's1e01', playerName: 'x'.repeat(5000) });
  assert.equal(s.h.getRoom().players[0].name.length, LIMITS.nameLen);
});

test('참가: 잘못된 방·이름 중복·정원·진행 중 신규 거부', async () => {
  const s = await lobbyWith(1);
  assert.equal((await s.call('x', 'room:join', { roomId: 'WRONG', playerName: 'a' })).error, 'ROOM_NOT_FOUND');
  assert.equal((await s.call('x', 'room:join', { roomId: 'ABC123', playerName: '게스트1' })).error, 'NAME_TAKEN');
  for (let i = 2; i <= 7; i++) assert.equal((await s.call(`g${i}`, 'room:join', { roomId: 'ABC123', playerName: `p${i}` })).ok, true);
  assert.equal((await s.call('g9', 'room:join', { roomId: 'ABC123', playerName: 'p9' })).error, 'ROOM_FULL');
  const s2 = await lobbyWith(1);
  s2.h.handle(HOST, 'game:start');
  assert.equal((await s2.call('late', 'room:join', { roomId: 'ABC123', playerName: 'late' })).error, 'GAME_ALREADY_STARTED');
});

test('방 인원이 아니면 이벤트 무시, room:get은 방 ID·인원 검증', async () => {
  const s = await lobbyWith(1);
  assert.equal((await s.call('stranger', 'answer:submit', { answers: {} })).error, 'NOT_IN_ROOM');
  assert.equal((await s.call('stranger', 'room:get', { roomId: 'ABC123' })).error, 'ROOM_NOT_FOUND');
  assert.equal((await s.call('g1', 'room:get', { roomId: 'OTHER' })).error, 'ROOM_NOT_FOUND');
  assert.equal((await s.call('g1', 'room:get', { roomId: 'ABC123' })).room.players.length, 2);
});

test('이상 payload 전 이벤트에서 예외 없음', async () => {
  const s = await lobbyWith(1);
  const evs = ['room:create', 'room:join', 'room:get', 'game:start', 'note:update', 'clue:reveal', 'clue:focus', 'warning:use', 'pointer:move', 'pointer:leave', 'answer:submit', 'game:reveal', 'nope', '__proto__', 'constructor'];
  for (const ev of evs) for (const p of [undefined, null, 'str', 42, [1], () => {}, { answers: 'x', text: 1, clueId: {}, x: 'a' }]) {
    s.advance(10_000); // 빈도 제한 토큰 회복
    assert.doesNotThrow(() => s.h.handle('g1', ev, p));
  }
  assert.equal(s.log.length, 0, JSON.stringify(s.log));
});

test('개시는 방장·로비에서만, 로비 제출·공개 거부(정답 유출 방지)', async () => {
  const s = await lobbyWith(1);
  assert.equal((await s.call('g1', 'answer:submit', { answers: CORRECT })).error, 'NOT_PLAYING');
  s.h.handle(HOST, 'game:reveal'); await flush();
  assert.equal(s.got(HOST, 'game:revealed').length, 0);
  s.h.handle('g1', 'game:start');
  assert.equal(s.h.getRoom().phase, 'lobby');
  s.h.handle(HOST, 'game:start');
  assert.equal(s.h.getRoom().phase, 'playing');
});

test('제출·채점·공개 후 재개시 차단', async () => {
  const s = await lobbyWith(1);
  s.h.handle(HOST, 'game:start');
  assert.deepEqual(await s.call(HOST, 'answer:submit', { answers: CORRECT }), { ok: true });
  assert.deepEqual(await s.call('g1', 'answer:submit', { answers: { suspect: 'x'.repeat(999), weapon: 7 } }), { ok: true });
  await flush();
  const [, , res] = s.got('g1', 'game:revealed')[0];
  assert.equal(Object.values(res.scores[HOST]).every(v => v.correct), true);
  assert.equal(Object.values(res.scores.g1).some(v => v.correct), false);
  assert.equal(res.playerAnswers.g1.suspect.length, LIMITS.answerLen);
  assert.equal(res.playerAnswers.g1.weapon, '');
  s.h.handle(HOST, 'game:start');
  assert.equal(s.h.getRoom().phase, 'revealed');
});

test('단서: 케이스에 없는 id 무시, 노트 길이 제한, 포인터 범위 보정', async () => {
  const s = await lobbyWith(1);
  s.h.handle(HOST, 'game:start');
  s.h.handle('g1', 'clue:reveal', { clueId: 'c99' });
  s.h.handle('g1', 'clue:reveal', { clueId: 'c01' });
  s.h.handle('g1', 'clue:reveal', { clueId: 'c01' });
  assert.deepEqual(s.h.getRoom().revealedClues, ['c01']);
  s.h.handle('g1', 'note:update', { text: 'n'.repeat(9999) });
  assert.equal(s.h.getRoom().sharedNote.length, LIMITS.noteLen);
  assert.equal(s.got('g1', 'note:synced').length, 0, '보낸 사람에게는 다시 보내지 않음');
  s.h.handle('g1', 'pointer:move', { x: 5, y: -1 });
  assert.deepEqual(s.got(HOST, 'pointer:moved').at(-1)[2], { playerId: 'g1', x: 1, y: 0 });
});

test('빈도 제한: 버킷 소진 시 RATE_LIMITED', async () => {
  const s = await lobbyWith(1);
  let limited = 0;
  for (let i = 0; i < LIMITS.rate.capacity + 5; i++) s.h.handle('g1', 'clue:focus', { clueId: 'c01' }, r => { if (r?.error === 'RATE_LIMITED') limited++; });
  assert.ok(limited >= 4);
});

test('끊김 유예: 유예 중에는 공개 대기, 만료 후 남은 인원 제출 완료면 공개', async () => {
  const s = await lobbyWith(1);
  s.h.handle(HOST, 'game:start');
  s.h.peerDisconnected('g1');
  await s.call(HOST, 'answer:submit', { answers: CORRECT });
  await flush();
  assert.equal(s.got(HOST, 'game:revealed').length, 0, '유예 중인 g1을 기다려야 함');
  s.advance(LIMITS.graceMs + 1);
  await flush();
  assert.equal(s.got(HOST, 'game:revealed').length, 1);
});

test('재접속: 같은 이름이면 새 id로 자리·답안 승계', async () => {
  const s = await lobbyWith(1);
  s.h.handle(HOST, 'game:start');
  await s.call('g1', 'answer:submit', { answers: CORRECT });
  s.h.peerDisconnected('g1');
  assert.equal((await s.call('g1-new', 'room:join', { roomId: 'ABC123', playerName: '게스트1' })).ok, true);
  const p = s.h.getRoom().players.find(x => x.name === '게스트1');
  assert.equal(p.id, 'g1-new');
  assert.equal(p.connected, true);
  await s.call(HOST, 'answer:submit', { answers: CORRECT });
  await flush();
  const [, , res] = s.got(HOST, 'game:revealed')[0];
  assert.ok(res.scores['g1-new'], '이전 답안이 새 id로 승계');
});

test('방장 새로고침 복구: snapshot → restore', async () => {
  const s = await lobbyWith(1);
  s.h.handle(HOST, 'game:start');
  s.h.handle('g1', 'clue:reveal', { clueId: 'c02' });
  const snap = s.h.snapshot();
  const s2 = setup();
  assert.equal(s2.h.restore(snap, HOST), true);
  const r = s2.h.getRoom();
  assert.equal(r.phase, 'playing');
  assert.deepEqual(r.revealedClues, ['c02']);
  assert.equal(r.players.find(p => p.id === HOST).connected, true);
  assert.equal(r.players.find(p => p.id === 'g1').connected, false);
  assert.equal((await s2.call('g1', 'room:join', { roomId: 'ABC123', playerName: '게스트1' })).ok, true);
  assert.equal(s2.h.getRoom().players.find(p => p.id === 'g1').connected, true);
});

test('기존 방이 있으면 room:create 거부 (방장 권한 탈취 방지)', async () => {
  const s = await lobbyWith(1);
  assert.deepEqual(await s.call('g1', 'room:create', { roomId: 'HIJACK', caseId: 's1e02', playerName: 'x' }), { ok: false, error: 'ROOM_EXISTS' });
  const r = s.h.getRoom();
  assert.equal(r.roomId, 'ABC123');
  assert.equal(r.hostId, HOST);
  assert.equal(r.players.length, 2);
});

test('포인터 이벤트는 별도 버킷 — 소진돼도 다른 이벤트는 처리', async () => {
  const s = await lobbyWith(1);
  s.h.handle(HOST, 'game:start');
  for (let i = 0; i < LIMITS.rate.capacity * 3; i++) s.h.handle('g1', 'pointer:move', { x: 0.5, y: 0.5 });
  assert.deepEqual(await s.call('g1', 'answer:submit', { answers: CORRECT }), { ok: true });
  s.h.handle('g1', 'note:update', { text: '노트' });
  assert.equal(s.h.getRoom().sharedNote, '노트');
});

test('로비에서 유예 만료 시 자리 반환, 진행 중에는 유지', async () => {
  const s = await lobbyWith(1);
  s.h.peerDisconnected('g1');
  assert.equal(s.h.getRoom().players.length, 2, '유예 중엔 유지');
  s.advance(LIMITS.graceMs + 1);
  assert.equal(s.h.getRoom().players.length, 1);
  const s2 = await lobbyWith(1);
  s2.h.handle(HOST, 'game:start');
  s2.h.peerDisconnected('g1');
  s2.advance(LIMITS.graceMs + 1);
  assert.equal(s2.h.getRoom().players.length, 2);
});

test('잘못된 스냅샷은 복구 거부', () => {
  const s = setup();
  for (const bad of [null, {}, { roomId: 'R' }, { roomId: 'R', caseId: 'nope', phase: 'lobby', players: [], playerAnswers: {}, revealedClues: [] },
    { roomId: 'R', caseId: 's1e01', phase: 'weird', players: [], playerAnswers: {}, revealedClues: [] }]) {
    assert.equal(s.h.restore(bad, HOST), false, JSON.stringify(bad));
  }
});
