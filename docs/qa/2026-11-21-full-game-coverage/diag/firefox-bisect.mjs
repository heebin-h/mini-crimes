// 앱 페이지에서만 Firefox ICE 수집이 안 되는 이유 이분 탐색: JS 차단 / 네이티브 여부 / 페이지 이동 후 상태.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const URL0 = process.env.URL || 'http://localhost:4180/';
const probe = () => new Promise(async res => {
  const out = { cands: 0, native: /\[native code\]/.test(String(RTCPeerConnection)) };
  const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
  pc.createDataChannel('x'); pc.onicecandidate = e => e.candidate && out.cands++;
  await pc.setLocalDescription(await pc.createOffer());
  setTimeout(() => { out.state = pc.iceGatheringState; pc.close(); res(out); }, 3500);
});
const b = await pw.firefox.launch();
for (const mode of ['JS 차단', '정상', '정상+about:blank 선행']) {
  const ctx = await b.newContext(); const p = await ctx.newPage();
  if (mode === 'JS 차단') await p.route(/\.js(\?|$)/, r => r.abort());
  if (mode.includes('선행')) { await p.goto('about:blank'); }
  await p.goto(URL0); await p.waitForTimeout(1500);
  console.log(mode, JSON.stringify(await p.evaluate(probe)));
  await ctx.close();
}
await b.close();
