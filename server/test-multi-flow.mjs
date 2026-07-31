/**
 * 멀티플레이어 전체 플로우 검증 스크립트
 * 1. 회원가입(A, B) → 로그인
 * 2. A: 방 생성 → B: 방 참가
 * 3. A: 게임 시작
 * 4. 양쪽에서 단서 공개 이벤트 수신
 * 5. 양쪽 답변 제출
 * 6. game:revealed 수신 + 채점 결과 확인
 */

import { io } from 'socket.io-client';

const BASE = 'http://localhost:3001';
const CASE_ID = 's1e01';

let pass = 0, fail = 0;
function ok(label) { console.log('  ✓', label); pass++; }
function ng(label, detail) { console.log('  ✗', label, detail ?? ''); fail++; }

async function apiPost(path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function apiGet(path, token) {
  const res = await fetch(`${BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return res.json();
}

function socketClient(name) {
  const s = io(BASE, { autoConnect: false, transports: ['websocket'] });
  s._name = name;
  return s;
}

function waitEvent(socket, event, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout: ${event}`)), timeoutMs);
    socket.once(event, (data) => { clearTimeout(t); resolve(data); });
  });
}

function emitAck(socket, event, data, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`ack timeout: ${event}`)), timeoutMs);
    socket.emit(event, data, (ack) => { clearTimeout(t); resolve(ack); });
  });
}

async function run() {
  console.log('\n── 1. AUTH ──────────────────────────────');

  // 회원가입 A
  const regA = await apiPost('/api/auth/register', { email: `a_${Date.now()}@test.com`, password: 'pass1234', name: '형사A' });
  regA.token ? ok('A 회원가입') : ng('A 회원가입', regA.error);

  // 회원가입 B
  const regB = await apiPost('/api/auth/register', { email: `b_${Date.now()}@test.com`, password: 'pass1234', name: '형사B' });
  regB.token ? ok('B 회원가입') : ng('B 회원가입', regB.error);

  // /me 검증
  const meA = await apiGet('/api/auth/me', regA.token);
  meA.name === '형사A' ? ok('/me 토큰 검증') : ng('/me 토큰 검증', meA);

  // 중복 이메일
  const dup = await apiPost('/api/auth/register', { email: regA.email, password: 'pass1234', name: 'dup' });
  dup.error === 'EMAIL_EXISTS' ? ok('중복 이메일 거부') : ng('중복 이메일 거부', dup);

  // 잘못된 비밀번호
  const badPw = await apiPost('/api/auth/login', { email: regA.email, password: 'wrongpw' });
  badPw.error === 'INVALID_CREDENTIALS' ? ok('잘못된 비번 거부') : ng('잘못된 비번 거부', badPw);

  console.log('\n── 2. 케이스 API ─────────────────────────');
  const cases = await apiGet('/api/cases');
  Array.isArray(cases) && cases.length === 10 ? ok(`케이스 ${cases.length}개 로드`) : ng('케이스 로드', cases);
  const c = cases.find(c => c.id === CASE_ID);
  c ? ok(`${CASE_ID} 케이스 존재`) : ng(`${CASE_ID} 케이스 없음`);
  !c?.answer ? ok('answer 클라이언트 전달 안 됨') : ng('answer 노출 위험');
  c?.choices?.suspect?.length === 4 ? ok('choices 포함 (4개)') : ng('choices 누락', c?.choices);
  c?.choices?.suspect?.every(x => !('correct' in x)) ? ok('correct 플래그 제거됨') : ng('correct 노출 위험');

  console.log('\n── 3. 소켓 멀티 플로우 ─────────────────────');
  const sockA = socketClient('A');
  const sockB = socketClient('B');

  await new Promise(r => { sockA.connect(); sockA.once('connect', r); });
  ok('A 소켓 연결');
  await new Promise(r => { sockB.connect(); sockB.once('connect', r); });
  ok('B 소켓 연결');

  // A: 방 생성
  const { roomId } = await emitAck(sockA, 'room:create', { caseId: CASE_ID, playerName: '형사A' });
  roomId ? ok(`방 생성: ${roomId}`) : ng('방 생성 실패');

  // A: room:state 수신
  const stateA = await waitEvent(sockA, 'room:state');
  stateA.phase === 'lobby' ? ok('A — phase: lobby') : ng('A — phase 오류', stateA.phase);
  stateA.players.length === 1 ? ok('A — 플레이어 1명') : ng('A — 플레이어 수 오류');

  // B: 방 참가
  const joinAck = await emitAck(sockB, 'room:join', { roomId, playerName: '형사B' });
  joinAck.ok ? ok('B 방 참가 성공') : ng('B 방 참가 실패', joinAck.error);

  // B 참가 후 A에게 room:state 업데이트
  const stateAfterJoin = await waitEvent(sockA, 'room:state');
  stateAfterJoin.players.length === 2 ? ok('A — 참가 후 플레이어 2명') : ng('A — 참가 후 플레이어 수', stateAfterJoin.players.length);

  // A: 게임 시작 — game:started 와 room:state 가 거의 동시 도착하므로 미리 등록
  const gameStartedB = waitEvent(sockB, 'game:started');
  const playingStateB = waitEvent(sockB, 'room:state');
  sockA.emit('game:start');
  const started = await gameStartedB;
  started.caseId === CASE_ID ? ok(`game:started 수신 (caseId: ${started.caseId})`) : ng('game:started 오류', started);

  const playingState = await playingStateB;
  playingState.phase === 'playing' ? ok('phase: playing') : ng('phase 오류', playingState.phase);

  // A: 단서 공개 → B가 수신
  const clueRevealedB = waitEvent(sockB, 'clue:revealed');
  sockA.emit('clue:reveal', { clueId: 'c01' });
  const revealed = await clueRevealedB;
  revealed.revealedClues.includes('c01') ? ok('clue:revealed B에 전파됨') : ng('clue:revealed 전파 실패', revealed);

  // B: 단서 공개 → A가 수신
  const clueRevealedA = waitEvent(sockA, 'clue:revealed');
  sockB.emit('clue:reveal', { clueId: 'c02' });
  const rev2 = await clueRevealedA;
  rev2.revealedClues.includes('c02') ? ok('B→A 단서 공개 전파') : ng('B→A 단서 공개 실패');

  // 경고 카드 사용
  const warningB = waitEvent(sockB, 'warning:used');
  sockA.emit('warning:use');
  await warningB;
  ok('warning:used 전파됨');

  // 공유 노트 동기화
  const noteB = waitEvent(sockB, 'note:synced');
  sockA.emit('note:update', { text: '피해자 - 알베르토 모레노' });
  const synced = await noteB;
  synced.text === '피해자 - 알베르토 모레노' ? ok('note:synced 전파됨') : ng('note 동기화 실패', synced);

  // 양쪽 답변 제출 + game:revealed 수신
  const revealedA = waitEvent(sockA, 'game:revealed', 6000);
  const revealedBEv = waitEvent(sockB, 'game:revealed', 6000);

  const correctAnswers = { suspect: '루카 모레노 (조카)', weapon: '와인에 탄 청산가리 (시안화칼륨)', motive: '단독 유산 상속' };
  const wrongAnswers   = { suspect: '마르코 베르디 (정원사)', weapon: '음식에 비소 혼합', motive: '생명보험 수령' };

  sockA.emit('answer:submit', { answers: correctAnswers }, () => {});
  sockB.emit('answer:submit', { answers: wrongAnswers }, () => {});

  const [revA, revB] = await Promise.all([revealedA, revealedBEv]);
  ok('game:revealed 양쪽 수신');

  // 채점 결과 검증
  const scoresA = revA.scores?.[sockA.id];
  const scoresB = revA.scores?.[sockB.id];

  scoresA?.suspect?.correct === true  ? ok('A suspect 정답') : ng('A suspect 채점 오류', scoresA?.suspect);
  scoresA?.weapon?.correct === true   ? ok('A weapon 정답')  : ng('A weapon 채점 오류', scoresA?.weapon);
  scoresA?.motive?.correct === true   ? ok('A motive 정답')  : ng('A motive 채점 오류', scoresA?.motive);
  scoresB?.suspect?.correct === false ? ok('B suspect 오답') : ng('B suspect 채점 오류', scoresB?.suspect);
  scoresB?.weapon?.correct === false  ? ok('B weapon 오답')  : ng('B weapon 채점 오류', scoresB?.weapon);

  // caseAnswer 클라이언트에 전달됨 (결과 페이지 표시용)
  revA.caseAnswer?.suspect?.text ? ok('caseAnswer 포함됨') : ng('caseAnswer 누락');
  revA.caseId === CASE_ID ? ok('caseId 포함됨') : ng('caseId 누락', revA.caseId);

  // 효율성 계산용 데이터
  revA.revealedClues?.length === 2 ? ok('revealedClues 2개 기록') : ng('revealedClues 오류', revA.revealedClues);
  revA.warningUsed === true ? ok('warningUsed 기록됨') : ng('warningUsed 누락');

  sockA.disconnect();
  sockB.disconnect();

  console.log(`\n── 결과: ${pass} 통과 / ${fail} 실패 ─────────────────`);
  if (fail > 0) process.exit(1);
}

run().catch(e => { console.error('스크립트 오류:', e.message); process.exit(1); });
