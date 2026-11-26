// F8 수정 검증: 이미 방에 있던 게스트의 재접속 때, 방장 id를 선점한 공격자에게 토큰이 가지 않는가.
// 공격자 변형 A: 쓰레기 proof / B: 자기 키로 만든 '유효한 서명'(pin과 다른 키) / C: 응답 없음.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const BASE = (process.env.BASE_URL || 'http://localhost:5197').replace(/\/$/, '');
const PEERJS = '/Users/heebiny/diyProj/mini-crimes/client/node_modules/peerjs/dist/peerjs.min.js';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const b = await pw.chromium.launch();
const app = async name => { const c = await b.newContext(); await c.addInitScript(([id, n]) => { localStorage.setItem('mc:profiles', JSON.stringify([{ id, name: n, createdAt: '2026-01-01' }])); localStorage.setItem('mc:currentProfile', id); }, [`p-${name}`, name]); return c.newPage(); };
const rows = [];
for (const variant of ['A', 'B', 'C']) {
  const H = await app('방장'), G = await app('게스트');
  await H.goto(BASE + '/'); await H.locator('.case-id').first().waitFor(); await H.getByText('팀 수사', { exact: true }).first().click(); await H.locator('.modal-overlay button.btn-primary').last().click(); await H.waitForURL(/\/lobby\//, { timeout: 25000 });
  const code = H.url().split('/lobby/')[1];
  await G.goto(BASE + '/'); await G.locator('.case-id').first().waitFor(); await G.getByPlaceholder('방 코드').fill(code); await G.getByText('→ 참가').click(); await G.waitForURL(/\/lobby\//, { timeout: 25000 });
  await H.getByText('[ 수사 팀 — 2/8 ]').waitFor({ timeout: 20000 });
  // 공격자 준비(방장이 사라진 직후 선점)
  const actx = await b.newContext(); const A = await actx.newPage(); await A.setContent('<!doctype html><body></body>'); await A.addScriptTag({ path: PEERJS });
  await H.context().close();
  const reg = await (async () => { for (let i = 0; i < 12; i++) { const r = await A.evaluate(([id, variant, code]) => new Promise(res => {
    window.__log = []; const p = new Peer(id); window.__p = p;
    p.on('open', () => res('OPEN')); p.on('error', e => res('ERR:' + e.type));
    p.on('connection', c => c.on('data', async d => {
      window.__log.push(d.t + (d.ev ? ':' + d.ev : ''));
      if (d.t !== 'hello' || variant === 'C') return;
      if (variant === 'A') return c.send({ t: 'proof', pub: { kty: 'EC', crv: 'P-256', x: 'AAAA', y: 'BBBB' }, sig: 'AAAA' });
      const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
      const pub = await crypto.subtle.exportKey('jwk', kp.publicKey);
      const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, kp.privateKey, new TextEncoder().encode(`mc-host-proof|${code}|${d.n}`));
      const s = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      c.send({ t: 'proof', pub: { kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y }, sig: s });
    }));
  }), [`mini-crimes-v1-${code}`, variant, code]); if (r === 'OPEN') return r; await A.evaluate(() => window.__p?.destroy()); await sleep(400); } return 'FAIL'; })();
  // 게스트의 재연결 창(20초)이 끝날 때까지 관찰
  await sleep(50000);
  const log = await A.evaluate(() => window.__log);
  const gPath = new URL(G.url()).pathname;
  const notice = (await G.locator('body').innerText()).replace(/\s+/g, ' ').match(/⚠[^\[]{0,90}/)?.[0] ?? null;
  const leakedJoin = log.some(x => x.startsWith('req:room:join'));
  rows.push({ variant, squatted: reg, attackerSaw: [...new Set(log)], leakedJoin, guestPath: gPath, notice });
  console.log(JSON.stringify(rows.at(-1)));
  await actx.close(); await G.context().close();
}
console.log(`\n토큰 유출(room:join 수신) ${rows.filter(r => r.leakedJoin).length}/${rows.length}, 게스트가 안내와 함께 홈으로 ${rows.filter(r => r.guestPath === '/' && r.notice).length}/${rows.length}`);
await b.close();
