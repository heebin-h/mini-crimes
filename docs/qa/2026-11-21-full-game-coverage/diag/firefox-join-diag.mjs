// Firefox 게스트가 팀 방에 못 붙는 원인 진단: 콘솔·UI·RTCPeerConnection 동작 수집.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const BASE = process.env.BASE_URL || 'http://localhost:5173';
const GB = process.env.GUEST || 'firefox';
const HB = process.env.HOST || 'chromium';
const hb = await pw[HB].launch(), gb = await pw[GB].launch();
const seed = n => ([id, name]) => { localStorage.setItem('mc:profiles', JSON.stringify([{ id, name, createdAt: '2026-01-01' }])); localStorage.setItem('mc:currentProfile', id); };
const mk = async (b, name) => { const c = await b.newContext(); await c.addInitScript(seed(), [`d-${name}`, name]); const p = await c.newPage(); p.logs = []; p.on('console', m => p.logs.push(`[${m.type()}] ${m.text()}`.slice(0, 300))); p.on('pageerror', e => p.logs.push(`[pageerror] ${e.message}`.slice(0, 300))); return p; };
const H = await mk(hb, '방장'), G = await mk(gb, '게스트');
await H.goto(BASE + '/'); await H.locator('.case-id').first().waitFor();
await H.getByText('팀 수사', { exact: true }).first().click();
await H.locator('.modal-overlay button.btn-primary').last().click();
await H.waitForURL(/\/lobby\//, { timeout: 25000 });
const code = H.url().split('/lobby/')[1];
// 게스트 브라우저의 WebRTC 기본 동작
await G.goto(BASE + '/'); await G.locator('.case-id').first().waitFor();
const rtc = await G.evaluate(async () => {
  const r = { hasRTC: typeof RTCPeerConnection, cands: [] };
  try {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    pc.createDataChannel('x'); pc.onicecandidate = e => e.candidate && r.cands.push(e.candidate.candidate.split(' ').slice(4, 8).join(' '));
    await pc.setLocalDescription(await pc.createOffer());
    await new Promise(res => setTimeout(res, 4000)); r.state = pc.iceGatheringState; pc.close();
  } catch (e) { r.err = e.message; }
  return r;
});
console.log('guest RTC', JSON.stringify(rtc));
await G.getByPlaceholder('방 코드').fill(code); await G.getByText('→ 참가').click();
await G.waitForTimeout(Number(process.env.WAIT || 20000));
console.log('guest url', G.url());
console.log('guest ui', (await G.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 300));
console.log('guest logs', G.logs.slice(-12).join('\n'));
console.log('host logs', H.logs.slice(-6).join('\n'));
await hb.close(); await gb.close();
