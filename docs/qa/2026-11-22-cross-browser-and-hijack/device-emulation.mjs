// Playwright 기기 프로필(터치·UA·DPR·뷰포트) 에뮬레이션으로 솔로 한 판 + 가로 넘침 + 화면 밖 버튼. 실기기가 아니다(실제 iOS/Android 엔진·성능·키보드 동작은 미검증).
import { createRequire } from 'node:module';
import { ALL_CASES } from '/Users/heebiny/diyProj/mini-crimes/client/src/data/cases.js';
import answers from '/Users/heebiny/diyProj/mini-crimes/client/src/data/answers.js';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const BASE = (process.env.BASE_URL || 'http://localhost:5197').replace(/\/$/, '');
const plan = [['iPhone SE', 'webkit'], ['iPhone 13', 'webkit'], ['iPhone 15 Pro Max', 'webkit'], ['iPad (gen 7)', 'webkit'], ['Pixel 5', 'chromium'], ['Galaxy S9+', 'chromium'], ['Galaxy Tab S4', 'chromium'], ['Galaxy S5', 'chromium']];
const c = ALL_CASES[0]; let bad = 0;
for (const [dev, eng] of plan) {
  const d = pw.devices[dev]; if (!d) { console.log('SKIP(없는 프로필)', dev); continue; }
  const b = await pw[eng].launch(); const ctx = await b.newContext({ ...d });
  await ctx.addInitScript(() => { localStorage.setItem('mc:profiles', JSON.stringify([{ id: 'd1', name: '기기', createdAt: '2026-01-01' }])); localStorage.setItem('mc:currentProfile', 'd1'); });
  const P = await ctx.newPage(); const errs = []; P.on('pageerror', e => errs.push(e.message));
  const W = d.viewport.width; const probs = [];
  const ov = async l => { const sw = await P.evaluate(() => document.documentElement.scrollWidth); if (sw > W + 1) probs.push(`${l} 넘침 ${sw}>${W}`); };
  try {
    await P.goto(BASE + '/'); await P.locator('.case-id').first().waitFor(); await ov('목록');
    await P.goto(`${BASE}/game/solo?caseId=${c.id}`); await P.locator('.case-id').waitFor(); await ov('게임');
    await P.locator('button[style*="aspect-ratio"]').first().tap(); await P.waitForTimeout(300); await P.locator('.modal-overlay').first().tap({ position: { x: 5, y: 5 } });
    await P.locator('button.btn-primary', { hasText: '최종 제출' }).first().tap();
    for (const q of ['suspect', 'weapon', 'motive']) await P.locator('.modal-overlay button').filter({ has: P.getByText(answers[c.id][q].text, { exact: true }) }).tap();
    await ov('제출 모달');
    const offscreen = await P.evaluate(() => [...document.querySelectorAll('.modal-overlay button')].filter(e => { const r = e.getBoundingClientRect(); return r.bottom > innerHeight + 1 || r.right > innerWidth + 1; }).length);
    if (offscreen) probs.push(`제출 모달 화면 밖 버튼 ${offscreen}`);
    await P.locator('.modal-overlay button.btn-primary').tap();
    await P.waitForURL(/\/result\/solo/, { timeout: 8000 }); await ov('결과');
    const ok = (await P.locator('body').innerText()).includes('3/3 정답');
    if (!ok) probs.push('결과 3/3 아님');
  } catch (e) { probs.push('예외 ' + e.message.split('\n')[0]); }
  if (errs.length) probs.push('pageerror ' + errs[0]);
  console.log(probs.length ? 'FAIL' : 'PASS', dev, `${W}x${d.viewport.height}`, eng, probs.join(' / ')); if (probs.length) bad++;
  await b.close();
}
console.log(`\n${plan.length - bad}/${plan.length} PASS`);
