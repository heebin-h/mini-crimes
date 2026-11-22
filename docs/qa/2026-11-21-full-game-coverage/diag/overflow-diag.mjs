// 목록 화면 320px 가로 넘침 원인 요소 찾기. BROWSER=webkit|firefox|chromium
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const BASE = process.env.BASE_URL || 'http://localhost:5173';
const b = await pw[process.env.BROWSER || 'webkit'].launch();
for (const w of [320, 360]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 568 } });
  const P = await ctx.newPage();
  await P.addInitScript(() => localStorage.setItem('mini-crimes-profiles', '[]'));
  await P.goto(BASE + '/profile'); await P.locator('input').first().fill('진단'); await P.getByRole('button').first().click();
  await P.waitForURL(u => !u.pathname.endsWith('/profile'));
  await P.waitForTimeout(800);
  const r = await P.evaluate(() => {
    const W = document.documentElement.clientWidth;
    const over = [...document.querySelectorAll('body *')].map(e => ({ e, r: e.getBoundingClientRect() })).filter(x => x.r.right > W + 0.5)
      .map(x => `${x.e.tagName}.${(x.e.className || '').toString().slice(0, 40)} "${(x.e.textContent||'').trim().slice(0,20)}" parent=${x.e.parentElement.className} right=${Math.round(x.r.right)} w=${Math.round(x.r.width)}`);
    return { clientW: W, scrollW: document.documentElement.scrollWidth, over: over.slice(0, 8) };
  });
  console.log(process.env.BROWSER || 'webkit', w, JSON.stringify(r));
  await ctx.close();
}
await b.close();
