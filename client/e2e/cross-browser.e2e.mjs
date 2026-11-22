// 서로 다른 브라우저 엔진 간 팀 플레이(실제 PeerJS/WebRTC): 방장 Chromium + 게스트 WebKit·Firefox.
// 실행: PLAYWRIGHT_MODULE=<경로> BASE_URL=http://localhost:5173 node e2e/cross-browser.e2e.mjs
// 확인: 방 생성·참가(3인) → 개시 → 노트 동기화(엔진 간) → 단서 공개 동기화 → 전원 제출 → 결과 점수 일치.
import { createRequire } from 'node:module';
import { ALL_CASES } from '../src/data/cases.js';
import answers from '../src/data/answers.js';

const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const BASE = (process.env.BASE_URL || 'http://localhost:5173').replace(/\/$/, '');
const QS = ['suspect', 'weapon', 'motive'];
const c = ALL_CASES.find(x => x.id === (process.env.CASE || 's1e01'));
const text = async p => (await p.locator('body').innerText()).replace(/\s+/g, ' ');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browsers = { host: await pw.chromium.launch(), safari: await pw.webkit.launch(), ff: await pw.firefox.launch() };
const mk = async (b, name) => {
  const ctx = await b.newContext({ viewport: { width: 1200, height: 800 } });
  await ctx.addInitScript(([id, name]) => {
    localStorage.setItem('mc:profiles', JSON.stringify([{ id, name, createdAt: '2026-01-01' }]));
    localStorage.setItem('mc:currentProfile', id);
  }, [`x-${name}`, name]);
  const p = await ctx.newPage(); p.errors = [];
  p.on('pageerror', e => p.errors.push(e.message));
  return p;
};
const out = { case: c.id, steps: [] };
const step = (n, ok, extra) => { out.steps.push({ n, ok, ...extra }); console.log(ok ? 'PASS' : 'FAIL', n, extra ? JSON.stringify(extra) : ''); };
let H, S, F;
try {
  H = await mk(browsers.host, '방장크롬'); S = await mk(browsers.safari, '웹킷'); F = await mk(browsers.ff, '파폭');
  await H.goto(BASE + '/'); await H.locator('.case-id').first().waitFor();
  if (!c.season) await H.getByRole('button', { name: /SPECIAL/ }).click();
  const card = H.getByText(c.title, { exact: true }).first().locator('xpath=ancestor::div[.//button[normalize-space()="팀 수사"]][1]');
  await card.getByText('팀 수사', { exact: true }).click();
  await H.locator('.modal-overlay button.btn-primary').last().click();
  await H.waitForURL(/\/lobby\//, { timeout: 25_000 });
  const code = H.url().split('/lobby/')[1];
  step('방 생성(Chromium 방장)', /^[A-Z0-9]{6}$/.test(code), { code });

  for (const [g, label] of [[S, 'WebKit'], [F, 'Firefox']]) {
    await g.goto(BASE + '/'); await g.locator('.case-id').first().waitFor();
    await g.getByPlaceholder('방 코드').fill(code); await g.getByText('→ 참가').click();
    const ok = await g.waitForURL(/\/lobby\//, { timeout: 30_000 }).then(() => true).catch(() => false);
    step(`${label} 게스트 참가`, ok);
  }
  await H.getByText('3/8').first().waitFor({ timeout: 15_000 }).then(() => step('방장 로비 3/8 반영', true)).catch(() => step('방장 로비 3/8 반영', false));

  await H.getByText('▶ 수사 개시').click();
  for (const [p, l] of [[H, 'Chromium'], [S, 'WebKit'], [F, 'Firefox']]) {
    const ok = await p.waitForURL(/\/game\//, { timeout: 20_000 }).then(() => true).catch(() => false);
    step(`${l} 게임 화면 진입`, ok);
  }

  // 노트: WebKit이 쓰면 Chromium·Firefox에 보여야 한다(300ms 디바운스 + 전송)
  await S.locator('textarea').fill('웹킷에서 작성');
  const sync = async p => p.waitForFunction(() => document.querySelector('textarea')?.value.includes('웹킷에서 작성'), null, { timeout: 8000 }).then(() => true).catch(() => false);
  step('노트 WebKit→Chromium 동기화', await sync(H));
  step('노트 WebKit→Firefox 동기화', await sync(F));

  // 단서 공개: Firefox가 타일을 열면 다른 둘의 EVIDENCE 카운트가 같아져야 한다
  await F.locator('button[style*="aspect-ratio"]').first().click();
  await sleep(1500);
  await F.locator('.modal-overlay').first().click({ position: { x: 5, y: 5 }, timeout: 3000 }).catch(() => {}); // 단서 모달 닫기(제출 버튼 가림 방지)
  const ev =async p => (await text(p)).match(/EVIDENCE (\d+)\/(\d+)/)?.slice(1).map(Number) ?? null;
  const evs = [await ev(H), await ev(S), await ev(F)];
  step('단서 공개 동기화(3엔진 EVIDENCE 동일)', evs.every(e => e && e[0] === evs[0][0]) && evs[0][0] >= 1, { evs });

  // 전원 제출: 정답 3개
  const submit = async p => {
    await p.locator('button.btn-primary', { hasText: '최종 제출' }).first().click();
    for (const q of QS) await p.locator('.modal-overlay button').filter({ has: p.getByText(answers[c.id][q].text, { exact: true }) }).click();
    await p.locator('.modal-overlay button.btn-primary').click();
  };
  for (const [p, l] of [[H, 'Chromium'], [S, 'WebKit'], [F, 'Firefox']]) await submit(p).catch(e => step(`${l} 제출 조작`, false, { e: e.message.split('\n').slice(0, 4).join(' / ') }));
  for (const [p, l] of [[H, 'Chromium'], [S, 'WebKit'], [F, 'Firefox']]) {
    const ok = await p.waitForURL(/\/result\//, { timeout: 25_000 }).then(() => true).catch(() => false);
    const t = ok ? await text(p) : '';
    step(`${l} 결과 화면·3/3 정답·팀 결과`, ok && t.includes('3/3 정답') && t.includes('[ 팀 결과 ]'));
  }
  step('페이지 오류 없음', [H, S, F].every(p => !p.errors.length), { errors: [H, S, F].flatMap(p => p.errors) });
} catch (e) {
  step('예외', false, { e: e.message.split('\n')[0] });
} finally {
  for (const b of Object.values(browsers)) await b.close().catch(() => {});
}
const fail = out.steps.filter(s => !s.ok).length;
console.log(`\n${out.steps.length - fail}/${out.steps.length} PASS`);
process.exit(fail ? 1 : 0);
