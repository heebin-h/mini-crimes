// Playwright Firefox에서 기본 RTCPeerConnection이 ICE 후보를 모으는지, 설정에 따라 달라지는지 확인.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const sets = {
  '기본': {},
  'mtransport_process=false': { 'media.peerconnection.mtransport_process': false },
  'socket프로세스 끔': { 'media.peerconnection.mtransport_process': false, 'network.process.enabled': false },
  '+obfuscate off': { 'media.peerconnection.mtransport_process': false, 'network.process.enabled': false, 'media.peerconnection.ice.obfuscate_host_addresses': false },
};
for (const [name, prefs] of Object.entries(sets)) {
  const b = await pw.firefox.launch({ firefoxUserPrefs: prefs });
  const p = await (await b.newContext()).newPage();
  await p.goto(process.env.URL || 'about:blank');
  const r = await p.evaluate(async () => {
    const out = { cands: [] };
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    pc.createDataChannel('x'); pc.onicecandidate = e => e.candidate && out.cands.push(e.candidate.candidate.split(' ')[7]);
    await pc.setLocalDescription(await pc.createOffer());
    await new Promise(res => setTimeout(res, 4000)); out.state = pc.iceGatheringState; pc.close(); return out;
  });
  console.log(name, JSON.stringify(r));
  await b.close();
}
