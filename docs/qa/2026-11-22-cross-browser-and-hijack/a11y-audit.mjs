// 접근성 기초 점검(자동 가능한 범위만): 키보드로 닿지 않는 클릭 요소, alt 없는 이미지, 이름 없는 입력/버튼, 키보드만으로 솔로 한 판.
// WCAG 전체 준수 검증이 아니다(대비·스크린리더 실제 낭독·포커스 순서의 적절성은 미검증).
import { createRequire } from 'node:module';
import { ALL_CASES } from '/Users/heebiny/diyProj/mini-crimes/client/src/data/cases.js';
import answers from '/Users/heebiny/diyProj/mini-crimes/client/src/data/answers.js';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const BASE = (process.env.BASE_URL || 'http://localhost:5197').replace(/\/$/, '');
const b = await pw.chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1200, height: 800 } });
await ctx.addInitScript(() => { if (!localStorage.getItem('mc:profiles')) { localStorage.setItem('mc:profiles', JSON.stringify([{ id: 'a1', name: '접근성', createdAt: '2026-01-01' }])); localStorage.setItem('mc:currentProfile', 'a1'); } });
const P = await ctx.newPage();
const audit = () => P.evaluate(() => {
  const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
  const sem = e => e.matches('button,a[href],input,textarea,select,summary,[tabindex],[role=button],[role=link]');
  const clickNoKey = [...document.querySelectorAll('body *')].filter(e => vis(e) && getComputedStyle(e).cursor === 'pointer' && !sem(e) && !e.closest('button,a[href],[role=button]')).map(e => `${e.tagName}.${String(e.className).slice(0, 30)}:"${(e.textContent || '').trim().slice(0, 18)}"`).slice(0, 6);
  const noAlt = [...document.querySelectorAll('img')].filter(i => !i.hasAttribute('alt')).length;
  const unnamedBtn = [...document.querySelectorAll('button')].filter(e => vis(e) && !(e.textContent || '').trim() && !e.getAttribute('aria-label') && !e.title).length;
  const unlabeledInput = [...document.querySelectorAll('input,textarea')].filter(e => vis(e) && !e.getAttribute('aria-label') && !e.getAttribute('placeholder') && !(e.id && document.querySelector(`label[for="${e.id}"]`)) && !e.closest('label')).length;
  return { clickNoKey, noAlt, unnamedBtn, unlabeledInput, lang: document.documentElement.lang };
});
const out = {};
await P.goto(BASE + '/'); await P.locator('.case-id').first().waitFor(); out.list = await audit();
const c = ALL_CASES[0];
await P.goto(`${BASE}/game/solo?caseId=${c.id}`); await P.locator('.case-id').waitFor(); out.game = await audit();
// 키보드만으로 한 판: Tab으로 타일에 도달 → Enter로 열기 → Escape로 닫기 → '최종 제출' 포커스 → Enter → 선택지 포커스·Enter
const focusTo = async (pred, max = 80) => { for (let i = 0; i < max; i++) { await P.keyboard.press('Tab'); if (await P.evaluate(pred)) return i + 1; } return -1; };
out.kbd = {};
out.kbd.tileTabs = await focusTo(() => document.activeElement?.matches('button[style*="aspect-ratio"]'));
await P.keyboard.press('Enter'); await P.waitForTimeout(400);
out.kbd.modalOpened = (await P.locator('.modal-overlay').count()) > 0;
await P.keyboard.press('Escape'); await P.waitForTimeout(300);
out.kbd.escapeCloses = (await P.locator('.modal-overlay').count()) === 0;
if (!out.kbd.escapeCloses) await P.locator('.modal-overlay').first().click({ position: { x: 5, y: 5 } });
out.kbd.submitTabs = await focusTo(() => /최종 제출/.test(document.activeElement?.textContent || ''));
await P.keyboard.press('Enter'); await P.waitForTimeout(400);
out.kbd.answerModal = (await P.locator('.modal-overlay').count()) > 0; out.modal = await audit();
let picked = 0;
for (const q of ['suspect', 'weapon', 'motive']) {
  const t = answers[c.id][q].text;
  const n = await focusTo(t2 => false, 0); // no-op
  for (let i = 0; i < 40; i++) { await P.keyboard.press('Tab'); if (await P.evaluate(t => (document.activeElement?.textContent || '').includes(t), t)) { await P.keyboard.press('Enter'); picked++; break; } }
}
out.kbd.picked = picked;
for (let i = 0; i < 20; i++) { await P.keyboard.press('Tab'); if (await P.evaluate(() => document.activeElement?.matches('.modal-overlay button.btn-primary') && !document.activeElement.disabled)) { await P.keyboard.press('Enter'); break; } }
await P.waitForURL(/\/result\/solo/, { timeout: 5000 }).then(() => out.kbd.reachedResult = true).catch(() => out.kbd.reachedResult = false);
if (out.kbd.reachedResult) { out.kbd.score = (await P.locator('body').innerText()).includes('3/3 정답'); out.result = await audit(); }
console.log(JSON.stringify(out, null, 1));
await b.close();
