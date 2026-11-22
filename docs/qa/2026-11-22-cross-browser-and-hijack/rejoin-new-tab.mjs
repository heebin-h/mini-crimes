// F3의 미실행 경로: 게임 진행 중 게스트가 탭을 닫고 같은 이름으로 새 탭(새 context=새 sessionStorage)에서 재참가하면 어떻게 되나.
// 비교: 같은 탭 새로고침(복귀 기대), 새 탭 즉시(유예 중), 새 탭 유예(20초) 뒤.
import { createRequire } from 'node:module';
import { ALL_CASES } from '/Users/heebiny/diyProj/mini-crimes/client/src/data/cases.js';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const BASE = (process.env.BASE_URL || 'http://localhost:5197').replace(/\/$/, '');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const b = await pw.chromium.launch(); const c = ALL_CASES[0];
const mk = async (name, sameCtx) => { const ctx = sameCtx || await b.newContext(); if (!sameCtx) await ctx.addInitScript(([id, n]) => { localStorage.setItem('mc:profiles', JSON.stringify([{ id, name: n, createdAt: '2026-01-01' }])); localStorage.setItem('mc:currentProfile', id); }, [`r-${name}`, name]); return ctx.newPage(); };
const text = async p => (await p.locator('body').innerText()).replace(/\s+/g, ' ');
const H = await mk('방장'); let G = await mk('게스트');
await H.goto(BASE + '/'); await H.locator('.case-id').first().waitFor(); await H.getByText('팀 수사', { exact: true }).first().click(); await H.locator('.modal-overlay button.btn-primary').last().click(); await H.waitForURL(/\/lobby\//, { timeout: 25000 });
const code = H.url().split('/lobby/')[1];
await G.goto(BASE + '/'); await G.locator('.case-id').first().waitFor(); await G.getByPlaceholder('방 코드').fill(code); await G.getByText('→ 참가').click(); await G.waitForURL(/\/lobby\//, { timeout: 25000 });
await H.getByText('[ 수사 팀 — 2/8 ]').waitFor({ timeout: 20000 }); await H.getByText('▶ 수사 개시').click();
await Promise.all([H, G].map(p => p.waitForURL(/\/game\//, { timeout: 20000 })));
const rows = [];
// A) 같은 탭 새로고침
await G.reload(); await sleep(7000); rows.push(['A 같은 탭 새로고침', new URL(G.url()).pathname.startsWith('/game/') ? '복귀 성공' : `실패 ${new URL(G.url()).pathname}`]);
// B) 탭(컨텍스트) 닫고 새 컨텍스트로 즉시 재참가
await G.context().close(); const G2 = await mk('게스트');
const tryJoin = async P => { await P.goto(BASE + '/'); await P.locator('.case-id').first().waitFor(); await P.getByPlaceholder('방 코드').fill(code); await P.getByText('→ 참가').click(); await sleep(6000); return { path: new URL(P.url()).pathname.replace(code, '<code>'), msg: (await text(P)).match(/⚠[^\[]{0,80}/)?.[0]?.trim() ?? null }; };
rows.push(['B 새 탭(즉시, 유예 중)', JSON.stringify(await tryJoin(G2))]);
await sleep(25000); // 유예(20초) 경과
rows.push(['C 새 탭(25초 뒤, 유예 지남)', JSON.stringify(await tryJoin(G2))]);
rows.push(['방장 화면(게스트 상태)', (await text(H)).match(/게스트[^ ]*[^\[]{0,40}/)?.[0] ?? '?']);
console.log(rows.map(r => r.join(' → ')).join('\n')); await b.close();
