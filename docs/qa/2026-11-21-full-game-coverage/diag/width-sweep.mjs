// 뷰포트 너비 280~480 × 화면(프로필·목록·게임·결과)에서 가로 넘침 측정. scrollWidth를 선언 너비와 비교.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const BASE = process.env.BASE_URL || 'http://localhost:5173';
const b = await pw[process.env.BROWSER || 'chromium'].launch();
const rows = [];
for (const w of [280, 300, 320, 340, 360, 375, 390, 412, 430, 480]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 700 } });
  const P = await ctx.newPage();
  const sw = async label => { const v = await P.evaluate(() => document.documentElement.scrollWidth); if (v > w + 1) rows.push(`${w}px ${label}: scrollWidth ${v}`); };
  await P.goto(BASE + '/profile'); await sw('프로필(생성 전)');
  await P.locator('input').first().fill('진단'); await P.getByRole('button').first().click();
  await P.waitForURL(u => !u.pathname.endsWith('/profile')); await P.waitForTimeout(500); await sw('목록');
  await P.getByText(/SPECIAL/).click().catch(() => {}); await P.waitForTimeout(200); await sw('목록(SPECIAL탭)');
  await P.goto(BASE + '/game/solo?caseId=s1e01'); await P.waitForTimeout(800); await sw('게임');
  await ctx.close();
}
console.log(rows.length ? rows.join('\n') : '넘침 없음');
await b.close();
