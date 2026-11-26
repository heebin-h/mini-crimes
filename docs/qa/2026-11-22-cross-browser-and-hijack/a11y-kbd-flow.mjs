// 키보드만으로 솔로 한 판 완주 가능 여부(포커스 이동 추적). Escape 닫기 지원 여부도 본다.
import { createRequire } from 'node:module';
import { ALL_CASES } from '/Users/heebiny/diyProj/mini-crimes/client/src/data/cases.js';
import answers from '/Users/heebiny/diyProj/mini-crimes/client/src/data/answers.js';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const BASE = (process.env.BASE_URL || 'http://localhost:5197').replace(/\/$/, '');
const b = await pw.chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1200, height: 800 } });
await ctx.addInitScript(() => { localStorage.setItem('mc:profiles', JSON.stringify([{ id: 'a1', name: '접근성', createdAt: '2026-01-01' }])); localStorage.setItem('mc:currentProfile', 'a1'); });
const P = await ctx.newPage(); const c = ALL_CASES[0]; const log = [];
await P.goto(`${BASE}/game/solo?caseId=${c.id}`); await P.locator('.case-id').waitFor();
const act = () => P.evaluate(() => { const e = document.activeElement; return `${e?.tagName}:${(e?.textContent || '').trim().slice(0, 22)}`; });
const modals = () => P.locator('.modal-overlay').count();
// 1) 단서 모달 열고 Escape
await P.locator('button[style*="aspect-ratio"]').first().focus(); await P.keyboard.press('Enter'); await P.waitForTimeout(400);
log.push(['단서 Enter 후 모달', await modals()]);
await P.keyboard.press('Escape'); await P.waitForTimeout(300); log.push(['Escape 후 모달(0이면 닫힘 지원)', await modals()]);
if (await modals()) { await P.keyboard.press('Tab'); log.push(['모달 안 Tab 포커스', await act()]); await P.locator('.modal-overlay').first().click({ position: { x: 5, y: 5 } }); }
// 2) 제출 버튼까지 Tab으로
await P.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => {});
let reached = null; for (let i = 1; i <= 60; i++) { await P.keyboard.press('Tab'); if ((await act()).includes('최종 제출')) { reached = i; break; } }
log.push(['최종 제출까지 Tab 횟수', reached]); await P.keyboard.press('Enter'); await P.waitForTimeout(600);
log.push(['제출 Enter 후 모달', await modals()]);
// 3) 모달 안에서 Tab/Enter로 정답 선택
for (const q of ['suspect', 'weapon', 'motive']) {
  const t = answers[c.id][q].text; let ok = false;
  for (let i = 0; i < 40; i++) { await P.keyboard.press('Tab'); if ((await act()).includes(t.slice(0, 8))) { await P.keyboard.press('Enter'); ok = true; break; } }
  log.push([`선택 ${q}`, ok]);
}
let submitted = false; for (let i = 0; i < 30; i++) { await P.keyboard.press('Tab'); const a = await act(); if (/제출|확정|BUTTON:▶/.test(a) && (await P.evaluate(() => !document.activeElement.disabled))) { log.push(['모달 제출 포커스', a]); await P.keyboard.press('Enter'); submitted = true; break; } }
await P.waitForURL(/\/result\/solo/, { timeout: 5000 }).then(() => log.push(['결과 도달', true])).catch(async () => log.push(['결과 도달', false, await act()]));
if (log.at(-1)[1] === true) log.push(['3/3 정답 표시', (await P.locator('body').innerText()).includes('3/3 정답')]);
console.log(log.map(l => l.join(' | ')).join('\n')); await b.close();
