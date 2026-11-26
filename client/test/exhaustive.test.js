// 전수·조합·퍼징 테스트 (node --test, 외부 의존 없음)
//  T1 채점 전수: 10케이스 × 4×4×4=64 선택 조합 = 640건
//  T2 데이터 전수: 단서·선택지 id 유일, 이미지 중복·존재
//  T3 게임 시뮬레이션: 10케이스 × 팀 1~8명 × 5가지 진행 방식 = 400판
//  T4 프로토콜 퍼저: 시드 고정 난수로 이벤트 열(위조·형식 오류 포함) 실행 후 불변식 검사
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHostRoom, LIMITS } from '../src/net/hostRoom.js';
import { ALL_CASES, getCase } from '../src/data/cases.js';
import answers from '../src/data/answers.js';
import { scoreAll, stampOf } from '../src/game/grading.js';

const PUBLIC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const QS = ['suspect', 'weapon', 'motive'];
const tk = n => `tok-${n}`.padEnd(20, '0');

// ── T1 채점 전수 ───────────────────────────────
test('T1 채점 전수: 케이스별 64조합 — 정답 수·도장·SOLVED 1건', () => {
  let combos = 0;
  for (const c of ALL_CASES) {
    const ans = answers[c.id];
    const opts = QS.map(q => c.choices[q]);
    let solved = 0, failed = 0, partial = 0;
    for (const a of opts[0]) for (const b of opts[1]) for (const d of opts[2]) {
      const given = { suspect: a.text, weapon: b.text, motive: d.text };
      const res = scoreAll(given, ans);
      const expected = QS.filter(q => given[q] === ans[q].text).length;
      const got = Object.values(res).filter(v => v.correct).length;
      assert.equal(got, expected, `${c.id} ${JSON.stringify(given)}`);
      const stamp = stampOf(got, 3);
      if (stamp === 'SOLVED') solved++; else if (stamp === 'FAILED') failed++; else partial++;
      combos++;
    }
    assert.deepEqual([solved, failed, partial], [1, 27, 36], `${c.id} 도장 분포`);
  }
  assert.equal(combos, 640);
});

// ── T2 데이터 전수 ─────────────────────────────
test('T2 데이터 전수: id·이미지·선택지 유일성', () => {
  const allImages = new Set();
  for (const c of ALL_CASES) {
    const clueIds = c.clueCards.map(x => x.id);
    assert.equal(new Set(clueIds).size, clueIds.length, `${c.id} 단서 id 중복`);
    assert.ok(clueIds.every(id => typeof id === 'string' && id.length <= 8), `${c.id} 단서 id 형식(clue:focus는 8자 제한)`);
    for (const q of QS) {
      const texts = c.choices[q].map(o => o.text);
      assert.equal(new Set(texts).size, 4, `${c.id} ${q} 선택지 텍스트 중복`);
      assert.equal(new Set(c.choices[q].map(o => o.id)).size, 4, `${c.id} ${q} 선택지 id 중복`);
      assert.ok(texts.every(t => t === t.trim() && t.length > 0 && t.length <= LIMITS.answerLen), `${c.id} ${q} 선택지 공백·길이`);
    }
    const imgs = [c.sceneImage, c.thumbnail, c.warningCard.image, ...c.clueCards.map(x => x.image)];
    assert.equal(new Set(imgs).size, imgs.length, `${c.id} 케이스 내 이미지 경로 중복`);
    for (const img of imgs) {
      assert.ok(!allImages.has(img), `${c.id} 다른 케이스와 이미지 경로 중복 ${img}`);
      allImages.add(img);
      assert.ok(img.startsWith('/cases/') && img.endsWith('.webp'), `${c.id} 이미지 경로 형식 ${img}`);
      assert.ok(fs.statSync(path.join(PUBLIC, img)).size > 0, `${c.id} 빈 이미지 ${img}`);
    }
    assert.equal(c.questions.map(q => q.id).join(), QS.join(), `${c.id} 문항 id·순서`);
  }
  assert.equal(allImages.size, 10 * 13);
});

// ── 공용 하네스 ────────────────────────────────
function harness(opts = {}) {
  let t = 1_000_000;
  const timers = [];
  const sent = [];
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
    ...opts,
  });
  const call = (from, ev, payload) => new Promise(resolve => {
    let done = false;
    h.handle(from, ev, payload, r => { done = true; resolve(r); });
    setImmediate(() => { if (!done) resolve(undefined); });
  });
  const advance = ms => { t += ms; for (const x of [...timers].sort((a, b) => a.at - b.at)) if (x.at <= t && timers.includes(x)) { timers.splice(timers.indexOf(x), 1); x.fn(); } };
  const flush = () => new Promise(r => setImmediate(r));
  const revealed = id => sent.filter(([to, ev]) => to === id && ev === 'game:revealed').map(x => x[2]);
  return { h, call, sent, log, advance, flush, revealed };
}

const wrongOf = (c, q) => c.choices[q].find(o => o.text !== answers[c.id][q].text).text;
// 패턴 → 문항별 정답 여부
const PATTERNS = { all: [1, 1, 1], none: [0, 0, 0], first: [1, 0, 0], last: [0, 0, 1], mid: [0, 1, 0], two: [1, 1, 0] };
function answersFor(c, pat) {
  return Object.fromEntries(QS.map((q, i) => [q, PATTERNS[pat][i] ? answers[c.id][q].text : wrongOf(c, q)]));
}
const PAT_KEYS = Object.keys(PATTERNS);

async function startGame(n, c) {
  const s = harness();
  assert.equal((await s.call('H', 'room:create', { roomId: 'ROOM01', caseId: c.id, playerName: '방장' })).ok, true);
  for (let i = 1; i < n; i++) {
    const r = await s.call(`g${i}`, 'room:join', { roomId: 'ROOM01', playerName: `수사관${i}`, token: tk(i) });
    assert.equal(r.ok, true, `${c.id} join ${i}`);
  }
  assert.equal(s.h.getRoom().players.length, n);
  s.h.handle('H', 'game:start');
  assert.equal(s.h.getRoom().phase, 'playing');
  return s;
}
const ids = n => ['H', ...Array.from({ length: n - 1 }, (_, i) => `g${i + 1}`)];

// ── T3 게임 시뮬레이션 ─────────────────────────
test('T3-A 전원 제출 → 자동 공개: 10케이스 × 1~8명 × 플레이어별 패턴 순환 (80판)', async () => {
  let games = 0;
  for (const c of ALL_CASES) for (let n = 1; n <= 8; n++) {
    const s = await startGame(n, c);
    // 단서 전부 공개(중복 공개 포함) + 경고 카드 2회 + 메모
    for (const cl of c.clueCards) { s.h.handle(ids(n)[cl.id.length % n], 'clue:reveal', { clueId: cl.id }); s.h.handle('H', 'clue:reveal', { clueId: cl.id }); }
    s.h.handle('H', 'warning:use'); s.h.handle('H', 'warning:use');
    s.h.handle('H', 'note:update', { text: '메모' });
    const room = s.h.getRoom();
    assert.equal(room.revealedClues.length, 10, `${c.id} n=${n} 공개 단서`);
    assert.equal(room.warningUsed, true);
    const expected = {};
    ids(n).forEach((id, i) => { const pat = PAT_KEYS[i % PAT_KEYS.length]; expected[id] = { pat, ans: answersFor(c, pat) }; });
    const peerIds = ids(n);
    for (let i = 0; i < n; i++) {
      assert.equal(s.revealed('H').length, 0, `${c.id} n=${n} 마지막 제출 전에 공개됨`);
      assert.deepEqual(await s.call(peerIds[i], 'answer:submit', { answers: expected[peerIds[i]].ans }), { ok: true });
    }
    await s.flush();
    const rev = s.revealed('H');
    assert.equal(rev.length, 1, `${c.id} n=${n} 공개 1회`);
    assert.equal(s.h.getRoom().phase, 'revealed');
    const p = rev[0];
    assert.equal(p.caseId, c.id);
    assert.equal(p.players.length, n);
    for (const id of peerIds) {
      const want = PATTERNS[expected[id].pat].filter(Boolean).length;
      const got = Object.values(p.scores[id]).filter(v => v.correct).length;
      assert.equal(got, want, `${c.id} n=${n} ${id} ${expected[id].pat}`);
      assert.deepEqual(p.playerAnswers[id], expected[id].ans);
    }
    // 모든 인원이 같은 공개 이벤트를 받았다
    for (const id of peerIds) assert.equal(s.revealed(id).length, 1);
    assert.equal(s.log.length, 0, '내부 오류 로그 없음');
    games++;
  }
  assert.equal(games, 80);
});

test('T3-B 모든 정답 패턴 × 케이스 × 1명 (60판) — 도장 판정', async () => {
  for (const c of ALL_CASES) for (const pat of PAT_KEYS) {
    const s = await startGame(1, c);
    await s.call('H', 'answer:submit', { answers: answersFor(c, pat) });
    await s.flush();
    const sc = s.revealed('H')[0].scores.H;
    const n = Object.values(sc).filter(v => v.correct).length;
    const stamp = stampOf(n, 3);
    assert.equal(stamp, pat === 'all' ? 'SOLVED' : pat === 'none' ? 'FAILED' : 'PARTIAL', `${c.id} ${pat}`);
  }
});

test('T3-C 방장 수동 공개: 일부만 제출해도 공개되고 미제출자는 점수 없음 (10케이스 × 2~8명)', async () => {
  for (const c of ALL_CASES) for (let n = 2; n <= 8; n++) {
    const s = await startGame(n, c);
    const peers = ids(n);
    const submitted = peers.slice(1, 1 + Math.ceil((n - 1) / 2)); // 게스트 일부만
    for (const id of submitted) await s.call(id, 'answer:submit', { answers: answersFor(c, 'all') });
    // 게스트의 수동 공개는 무시
    s.h.handle(peers[peers.length - 1], 'game:reveal');
    await s.flush();
    assert.equal(s.h.getRoom().phase, 'playing', `${c.id} n=${n} 게스트가 공개함`);
    s.h.handle('H', 'game:reveal');
    await s.flush();
    const p = s.revealed('H')[0];
    assert.deepEqual(Object.keys(p.scores).sort(), [...submitted].sort(), `${c.id} n=${n}`);
    // 공개 이후 제출·재공개 무시
    assert.equal((await s.call('H', 'answer:submit', { answers: answersFor(c, 'all') })).error, 'NOT_PLAYING');
    s.h.handle('H', 'game:reveal'); await s.flush();
    assert.equal(s.revealed('H').length, 1, '공개는 정확히 1회');
  }
});

test('T3-D 제출 전 연결 끊김: 유예 중엔 대기, 유예 만료 후 남은 인원만으로 공개 (10케이스 × 2~8명)', async () => {
  for (const c of ALL_CASES) for (let n = 2; n <= 8; n++) {
    const s = await startGame(n, c);
    const peers = ids(n);
    const gone = peers[n - 1];
    s.h.peerDisconnected(gone);
    for (const id of peers.slice(0, n - 1)) await s.call(id, 'answer:submit', { answers: answersFor(c, 'two') });
    await s.flush();
    assert.equal(s.revealed('H').length, 0, `${c.id} n=${n} 유예 중 공개됨`);
    s.advance(LIMITS.graceMs - 1000); await s.flush();
    assert.equal(s.revealed('H').length, 0, `${c.id} n=${n} 유예 만료 전 공개됨`);
    s.advance(2000); await s.flush();
    const rev = s.revealed('H');
    assert.equal(rev.length, 1, `${c.id} n=${n} 유예 만료 후 공개`);
    assert.equal(rev[0].scores[gone], undefined);
    assert.equal(Object.keys(rev[0].scores).length, n - 1);
  }
});

test('T3-E 재제출 덮어쓰기·재접속 답안 승계·로비 이탈 자리 반환', async () => {
  const c = getCase('s1e03');
  // 재제출: 마지막 값이 채점된다(공개 전까지)
  let s = await startGame(2, c);
  await s.call('g1', 'answer:submit', { answers: answersFor(c, 'none') });
  await s.call('g1', 'answer:submit', { answers: answersFor(c, 'all') });
  await s.call('H', 'answer:submit', { answers: answersFor(c, 'all') });
  await s.flush();
  assert.equal(Object.values(s.revealed('H')[0].scores.g1).every(v => v.correct), true);

  // 재접속: 같은 이름·토큰이면 새 id가 답안 승계, 다른 토큰은 거부
  s = await startGame(3, c);
  await s.call('g1', 'answer:submit', { answers: answersFor(c, 'all') });
  s.h.peerDisconnected('g1');
  assert.equal((await s.call('evil', 'room:join', { roomId: 'ROOM01', playerName: '수사관1', token: tk(999) })).ok, false);
  assert.equal((await s.call('g1b', 'room:join', { roomId: 'ROOM01', playerName: '수사관1', token: tk(1) })).ok, true);
  await s.call('H', 'answer:submit', { answers: answersFor(c, 'all') });
  await s.call('g2', 'answer:submit', { answers: answersFor(c, 'none') });
  await s.flush();
  const p = s.revealed('H')[0];
  assert.deepEqual(Object.keys(p.scores).sort(), ['H', 'g1b', 'g2'].sort());
  assert.equal(Object.values(p.scores.g1b).every(v => v.correct), true, '끊기기 전 제출 답안 승계');

  // 로비에서 끊긴 게스트: 유예 후 자리 반환 → 정원 재사용
  s = harness();
  await s.call('H', 'room:create', { roomId: 'ROOM01', caseId: c.id, playerName: '방장' });
  for (let i = 1; i <= 7; i++) await s.call(`g${i}`, 'room:join', { roomId: 'ROOM01', playerName: `p${i}`, token: tk(i) });
  assert.equal((await s.call('x', 'room:join', { roomId: 'ROOM01', playerName: 'p8', token: tk(8) })).error, 'ROOM_FULL');
  s.h.peerDisconnected('g3');
  s.advance(LIMITS.graceMs + 1);
  assert.equal(s.h.getRoom().players.length, 7);
  assert.equal((await s.call('x', 'room:join', { roomId: 'ROOM01', playerName: 'p8', token: tk(8) })).ok, true);
});

test('T3-F 동시성·경계: 마지막 제출 직후 수동 공개 경합, 포인터 좌표 보정, 답안·메모 길이 제한', async () => {
  const c = getCase('s1e05');
  // 마지막 제출이 자동 공개를 시작한 같은 틱에 방장이 수동 공개해도 공개는 1회
  let s = await startGame(2, c);
  await s.call('g1', 'answer:submit', { answers: answersFor(c, 'all') });
  s.h.handle('H', 'answer:submit', { answers: answersFor(c, 'none') });
  s.h.handle('H', 'game:reveal'); s.h.handle('H', 'game:reveal');
  await s.flush(); await s.flush();
  assert.equal(s.revealed('H').length, 1, '동시 공개 경합 시 1회');
  assert.equal(s.revealed('g1').length, 1);

  // 포인터: 범위 밖은 0~1로 보정, 숫자가 아니면 무시
  s = await startGame(2, c);
  s.h.handle('H', 'pointer:move', { x: 5, y: -3 });
  s.h.handle('H', 'pointer:move', { x: NaN, y: 0 });
  s.h.handle('H', 'pointer:move', { x: '0.5', y: 0.5 });
  const moves = s.sent.filter(x => x[1] === 'pointer:moved').map(x => x[2]);
  assert.deepEqual(moves, [{ playerId: 'H', x: 1, y: 0 }]);

  // 답안·메모: 길이 제한, 비문자열·누락은 빈 문자열로 정규화
  s = await startGame(1, c);
  s.h.handle('H', 'note:update', { text: 'n'.repeat(99999) });
  assert.equal(s.h.getRoom().sharedNote.length, LIMITS.noteLen);
  await s.call('H', 'answer:submit', { answers: { suspect: 'a'.repeat(99999), weapon: 7 } });
  const a = s.h.snapshot().playerAnswers.H;
  assert.equal(a.suspect.length, LIMITS.answerLen);
  assert.deepEqual([a.weapon, a.motive], ['', '']);
});

// ── T4 프로토콜 퍼저 ───────────────────────────
function rng(seed) { // mulberry32
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const PEERS = ['H', ...Array.from({ length: 11 }, (_, i) => `g${i + 1}`)];
const NAMES = ['', ' ', '익명', '수사관', 'a'.repeat(100), '<img src=x onerror=alert(1)>', '__proto__', 'constructor', '한글이름', '😀😀', ' pad ', 'dup', 'dup', 'x'.repeat(21)];
const BIG = 'z'.repeat(9000);
const GARBAGE = [undefined, null, 0, 1, -1, NaN, Infinity, '', 'str', true, [], [1, 2], {}, { __proto__: { x: 1 } }, { roomId: 'ROOM01' }, { clueId: {} }, { text: 5 }, { answers: null }, { answers: [] }, { x: 'a', y: {} }];

function genEvent(r, caseObj) {
  const pick = a => a[Math.floor(r() * a.length)];
  const from = pick(PEERS);
  // 정상 형식 75% / 위조·오류 형식 25% — 정상 흐름이 후반(공개) 상태까지 가야 불변식이 의미를 갖는다
  const mix = (valid, bad) => (r() < 0.75 ? pick(valid) : pick(bad));
  const tokens = [tk(1), tk(2), tk(3), 'bad', '', 42, tk(4)];
  const clue = () => pick([...caseObj.clueCards.map(c => c.id), 'nope', '', 5, null, 'c'.repeat(50)]);
  const ans = () => pick([answersFor(caseObj, 'all'), answersFor(caseObj, 'all'), answersFor(caseObj, 'none'), answersFor(caseObj, 'two'), { suspect: BIG }, { suspect: 1, weapon: null }, {}, null, 'x', { __proto__: null, suspect: 'a' }]);
  const evs = [
    () => ['room:create', mix([{ roomId: 'ROOM02', caseId: caseObj.id, playerName: pick(NAMES) }], [{ roomId: 'ROOM02', caseId: 'nope' }, ...GARBAGE])],
    () => ['room:join', mix([{ roomId: 'ROOM01', playerName: pick(NAMES), token: pick(tokens) }], [{ roomId: 'WRONG', playerName: 'a', token: tk(1) }, ...GARBAGE])],
    () => ['room:join', { roomId: 'ROOM01', playerName: pick(NAMES), token: pick([tk(1), tk(2), tk(3), tk(4), tk(5), tk(6)]) }], // 정상 참가 가중
    () => ['room:get', mix([{ roomId: 'ROOM01' }], [{ roomId: 'X' }, ...GARBAGE])],
    () => ['game:start', mix([{}], GARBAGE)],
    () => ['note:update', mix([{ text: 'hi' }], [{ text: BIG }, { text: 5 }, ...GARBAGE])],
    () => ['clue:reveal', { clueId: clue() }],
    () => ['clue:focus', mix([{ clueId: clue() }, { clueId: null }], GARBAGE)],
    () => ['warning:use', mix([{}], GARBAGE)],
    () => ['pointer:move', mix([{ x: r() * 2 - 0.5, y: r() }], [{ x: NaN, y: 0 }, { x: '1', y: 0 }, ...GARBAGE])],
    () => ['pointer:leave', mix([{}], GARBAGE)],
    () => ['answer:submit', mix([{ answers: ans() }], GARBAGE)],
    () => ['game:reveal', mix([{}], GARBAGE)],
    () => [pick(['nope', '__proto__', 'constructor', 'toString', 'hasOwnProperty', '', 7, null]), pick(GARBAGE)],
  ];
  return { from, kind: r() < 0.08 ? 'disc' : r() < 0.06 ? 'time' : 'ev', ev: pick(evs)() };
}

function checkInvariants(s, caseObj, tokens, ctx) {
  const room = s.h.getRoom();
  if (!room) return;
  assert.ok(['lobby', 'playing', 'revealed'].includes(room.phase), `${ctx} phase`);
  assert.ok(room.players.length >= 1 && room.players.length <= LIMITS.maxPlayers, `${ctx} 인원 ${room.players.length}`);
  const pids = room.players.map(p => p.id);
  assert.equal(new Set(pids).size, pids.length, `${ctx} player id 중복`);
  assert.ok(pids.includes(room.hostId), `${ctx} 방장이 인원에 없음`);
  assert.equal(room.hostId, 'H', `${ctx} 방장 변경됨`);
  const names = room.players.map(p => p.name);
  assert.equal(new Set(names).size, names.length, `${ctx} 이름 중복 ${JSON.stringify(names)}`);
  assert.ok(names.every(n => n.length >= 1 && n.length <= LIMITS.nameLen), `${ctx} 이름 길이`);
  assert.ok(room.sharedNote.length <= LIMITS.noteLen, `${ctx} 메모 길이`);
  const cids = new Set(caseObj.clueCards.map(c => c.id));
  assert.ok(room.revealedClues.every(id => cids.has(id)), `${ctx} 알 수 없는 단서 공개`);
  assert.equal(new Set(room.revealedClues).size, room.revealedClues.length, `${ctx} 단서 중복 공개`);
  for (const p of room.players) assert.deepEqual(Object.keys(p).sort(), ['connected', 'id', 'name'], `${ctx} room:state에 불필요 필드`);
  assert.equal(room.caseId, caseObj.id, `${ctx} 케이스 변경됨(방 덮어쓰기)`);
  const snap = s.h.snapshot();
  for (const [pid, a] of Object.entries(snap.playerAnswers)) {
    assert.ok(pids.includes(pid), `${ctx} 인원 아닌 id의 답안 ${pid}`);
    assert.deepEqual(Object.keys(a).sort(), [...QS].sort(), `${ctx} 답안 키`);
    assert.ok(Object.values(a).every(v => typeof v === 'string' && v.length <= LIMITS.answerLen), `${ctx} 답안 길이·형식`);
  }
}

test('T4 프로토콜 퍼저: 3000열 × 최대 80이벤트 — 예외·불변식 위반 0', async () => {
  const SEQS = 3000;
  let events = 0, reveals = 0, internal = 0;
  for (let seed = 1; seed <= SEQS; seed++) {
    const r = rng(seed);
    const caseObj = ALL_CASES[seed % ALL_CASES.length];
    const s = harness();
    const used = new Set();
    await s.call('H', 'room:create', { roomId: 'ROOM01', caseId: caseObj.id, playerName: '방장' });
    const len = 20 + Math.floor(r() * 61);
    const startAt = Math.floor(len * (0.25 + r() * 0.25)); // 방장이 중간에 개시 — 이후 진행·공개 단계의 불변식도 검사
    const revealAt = r() < 0.5 ? Math.floor(len * 0.9) : -1;
    for (let k = 0; k < len; k++) {
      const e = k === startAt ? { from: 'H', kind: 'ev', ev: ['game:start', {}] }
        : k === revealAt ? { from: 'H', kind: 'ev', ev: ['game:reveal', {}] }
        : genEvent(r, caseObj);
      const ctx = `seed=${seed} step=${k} ${e.kind} ${e.from} ${String(e.ev[0])}`;
      if (e.kind === 'disc') s.h.peerDisconnected(e.from === 'H' ? 'g1' : e.from);
      else if (e.kind === 'time') { s.advance(Math.floor(r() * 30_000)); await s.flush(); }
      else {
        const [ev, payload] = e.ev;
        if (payload && typeof payload === 'object' && typeof payload.token === 'string') used.add(payload.token);
        const ackKind = r();
        const ack = ackKind < 0.6 ? () => {} : ackKind < 0.8 ? undefined : 123; // 함수·없음·비함수
        s.h.handle(e.from, ev, payload, ack);
        events++;
      }
      await s.flush();
      checkInvariants(s, caseObj, used, ctx);
      // 스냅샷 복구도 불변식을 깨지 않아야 한다
      if (r() < 0.02) {
        const s2 = harness();
        assert.equal(s2.h.restore(s.h.snapshot(), 'H'), true, `${ctx} restore`);
        checkInvariants(s2, caseObj, used, `${ctx} (restored)`);
        s2.h.dispose();
      }
    }
    reveals += s.sent.filter(x => x[1] === 'game:revealed').length > 0 ? 1 : 0;
    // 토큰·내부 필드가 어떤 전송에도 노출되지 않는다
    const wire = JSON.stringify(s.sent);
    for (const tkn of [tk(1), tk(2), tk(3), tk(4)]) assert.equal(wire.includes(tkn), false, `seed=${seed} 토큰 노출`);
    internal += s.log.length;
    assert.equal(s.log.length, 0, `seed=${seed} 내부 오류 로그: ${JSON.stringify(s.log[0]?.slice(0, 1))}`);
    s.h.dispose();
  }
  console.log(`# T4: ${SEQS}열, 이벤트 ${events}건, 공개까지 간 열 ${reveals}, 내부 오류 ${internal}`);
  assert.ok(reveals > 500, `공개 단계까지 도달한 열이 너무 적음(${reveals}) — 퍼저가 후반 상태를 못 건드림`);
});
