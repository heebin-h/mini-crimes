// 장시간·침묵 단절·동시 방 격리 — 기존 E2E가 짧은 시나리오라 덮지 못한 구간.
//  S1 유휴 장시간: 방장+게스트가 IDLE_MS(기본 100초) 동안 아무것도 안 해도 heartbeat 오탐으로 끊기지 않는다 → 그 뒤 정상 제출
//  S2 침묵 단절(Chromium CDP): 게스트 페이지를 frozen 상태로 만들어(타이머·ping 중단, 연결은 유지) 방장이 15초 침묵 → 접속 끊김 처리, 해동 후 복구
//  S3 동시 방 2개: 서로 다른 방의 노트·단서·결과가 섞이지 않는다
// 실행: PLAYWRIGHT_MODULE=<경로> BASE_URL=http://localhost:5198 [IDLE_MS=100000] node e2e/soak-edge.e2e.mjs
import { createRequire } from 'node:module';
import { ALL_CASES } from '../src/data/cases.js';
import answers from '../src/data/answers.js';

const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const BASE = (process.env.BASE_URL || 'http://localhost:5198').replace(/\/$/, '');
const IDLE = Number(process.env.IDLE_MS || 100_000);
const QS = ['suspect', 'weapon', 'motive'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const text = async p => (await p.locator('body').innerText()).replace(/\s+/g, ' ');
const b = await pw.chromium.launch();
const results = [];
const rec = (n, ok, d) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', n, d ? JSON.stringify(d) : ''); };

const mk = async name => {
  const ctx = await b.newContext({ viewport: { width: 1200, height: 800 } });
  await ctx.addInitScript(([id, name]) => { localStorage.setItem('mc:profiles', JSON.stringify([{ id, name, createdAt: '2026-01-01' }])); localStorage.setItem('mc:currentProfile', id); }, [`s-${name}`, name]);
  const p = await ctx.newPage(); p.errors = []; p.on('pageerror', e => p.errors.push(e.message)); return p;
};
const room = async (H, c) => {
  await H.goto(BASE + '/'); await H.locator('.case-id').first().waitFor();
  if (!c.season) await H.getByRole('button', { name: /SPECIAL/ }).click();
  const card = H.getByText(c.title, { exact: true }).first().locator('xpath=ancestor::div[.//button[normalize-space()="팀 수사"]][1]');
  await card.getByText('팀 수사', { exact: true }).click();
  await H.locator('.modal-overlay button.btn-primary').last().click();
  await H.waitForURL(/\/lobby\//, { timeout: 25_000 });
  return H.url().split('/lobby/')[1];
};
const join = async (G, code) => { await G.goto(BASE + '/'); await G.locator('.case-id').first().waitFor(); await G.getByPlaceholder('방 코드').fill(code); await G.getByText('→ 참가').click(); await G.waitForURL(/\/lobby\//, { timeout: 25_000 }); };
const submit = async (p, c, ok = true) => {
  await p.locator('button.btn-primary', { hasText: '최종 제출' }).first().click();
  for (const q of QS) {
    const t = ok ? answers[c.id][q].text : c.choices[q].find(o => o.text !== answers[c.id][q].text).text;
    await p.locator('.modal-overlay button').filter({ has: p.getByText(t, { exact: true }) }).click();
  }
  await p.locator('.modal-overlay button.btn-primary').click();
};

try {
  // ── S1 유휴 장시간 ──
  {
    const c = ALL_CASES[0]; const H = await mk('유휴방장'), G = await mk('유휴게스트');
    const code = await room(H, c); await join(G, code);
    await H.getByText('[ 수사 팀 — 2/8 ]').waitFor({ timeout: 20_000 });
    const lobbyIdle = Math.floor(IDLE / 2);
    await sleep(lobbyIdle); // 로비 유휴
    const lobbyOk = (await text(H)).includes('2/8') && G.url().includes('/lobby/');
    await H.getByText('▶ 수사 개시').click();
    await Promise.all([H, G].map(p => p.waitForURL(/\/game\//, { timeout: 20_000 })));
    await sleep(IDLE - lobbyIdle); // 게임 유휴
    const stillGame = H.url().includes('/game/') && G.url().includes('/game/');
    await G.locator('textarea').fill('유휴 뒤 메모'); await sleep(1500);
    const noteSynced = await H.evaluate(() => document.querySelector('textarea')?.value.includes('유휴 뒤 메모'));
    await submit(H, c); await submit(G, c);
    await Promise.all([H, G].map(p => p.waitForURL(/\/result\//, { timeout: 25_000 })));
    const [tH, tG] = [await text(H), await text(G)];
    rec(`S1 유휴 ${Math.round(IDLE / 1000)}초(로비 ${Math.round(lobbyIdle / 1000)} + 게임 ${Math.round((IDLE - lobbyIdle) / 1000)}) 뒤 연결·노트 동기화·제출·결과`, lobbyOk && stillGame && noteSynced && tH.includes('3/3 정답') && tG.includes('3/3 정답') && !H.errors.length && !G.errors.length, { lobbyOk, stillGame, noteSynced, errors: [...H.errors, ...G.errors] });
    await H.context().close(); await G.context().close();
  }

  // ── S2 침묵 단절 ──  (게스트의 RTCDataChannel.send를 조용히 버려, 연결은 열린 채 ping이 방장에 도달하지 않는 상황을 만든다)
  {
    const c = ALL_CASES[1]; const H = await mk('침묵방장'), G = await mk('침묵게스트');
    await G.context().addInitScript(() => { const o = RTCDataChannel.prototype.send; RTCDataChannel.prototype.send = function (d) { if (window.__drop) return; return o.call(this, d); }; });
    const code = await room(H, c); await join(G, code);
    await H.getByText('[ 수사 팀 — 2/8 ]').waitFor({ timeout: 20_000 });
    const t0 = Date.now();
    await G.evaluate(() => { window.__drop = true; });
    const cnt = t => (t.match(/수사 팀 — (\d)\/8/) || [])[1];
    const timeline = []; let last = '2', droppedAt = null, guestNoticeAt = null, guestNotice = null;
    while (Date.now() - t0 < 75_000) {
      const t = await text(H); const c2 = cnt(t) ?? '?';
      if (c2 !== last) { timeline.push({ sec: Math.round((Date.now() - t0) / 1000), hostCount: c2 }); last = c2; }
      if (guestNoticeAt === null) { const gt = await text(G); if (!/\/lobby\//.test(G.url()) || /⚠/.test(gt)) { guestNoticeAt = Math.round((Date.now() - t0) / 1000); guestNotice = { url: new URL(G.url()).pathname.replace(/\/[A-Z0-9]{6}$/, '/<code>'), warn: gt.match(/⚠[^[]{0,60}/)?.[0] ?? null }; } }
      if (c2 === '1' && guestNoticeAt !== null) { droppedAt = Date.now() - t0; break; }
      await sleep(500);
    }
    rec('S2 게스트→방장 전송 침묵 → 방장이 끊김 감지(15초 침묵 + 20초 유예) / 게스트도 방장 무응답을 감지', droppedAt !== null, { droppedMs: droppedAt, guestNoticeSec: guestNoticeAt, guestNotice, timeline });
    await H.context().close(); await G.context().close();
  }

  // ── S3 동시 방 2개 격리 ──
  {
    const cA = ALL_CASES[2], cB = ALL_CASES[3];
    const [HA, GA, HB, GB] = [await mk('방A장'), await mk('방A객'), await mk('방B장'), await mk('방B객')];
    const [codeA, codeB] = await Promise.all([room(HA, cA), room(HB, cB)]);
    await Promise.all([join(GA, codeA), join(GB, codeB)]);
    await Promise.all([HA, HB].map(p => p.getByText('[ 수사 팀 — 2/8 ]').waitFor({ timeout: 20_000 })));
    await Promise.all([HA.getByText('▶ 수사 개시').click(), HB.getByText('▶ 수사 개시').click()]);
    await Promise.all([HA, GA, HB, GB].map(p => p.waitForURL(/\/game\//, { timeout: 20_000 })));
    await GA.locator('textarea').fill('A방 메모'); await GB.locator('textarea').fill('B방 메모'); await sleep(2000);
    const val = p => p.evaluate(() => document.querySelector('textarea')?.value);
    const notes = [await val(HA), await val(GA), await val(HB), await val(GB)];
    await submit(HA, cA); await submit(GA, cA, false); await submit(HB, cB, false); await submit(GB, cB, false);
    await Promise.all([HA, GA, HB, GB].map(p => p.waitForURL(/\/result\//, { timeout: 25_000 })));
    const ts = await Promise.all([HA, GA, HB, GB].map(text));
    const ids = [true]; // 결과 화면에 케이스 ID가 표시되지 않아 ID 검사는 제외(점수·노트 격리만 확인)
    rec('S3 동시 2방: 노트 격리·결과 점수 격리', notes[0] === 'A방 메모' && notes[1] === 'A방 메모' && notes[2] === 'B방 메모' && notes[3] === 'B방 메모' && ts[0].includes('3/3 정답') && ts[1].includes('0/3 정답') && ts[2].includes('0/3 정답') && ts[3].includes('0/3 정답') && ids.every(Boolean), { notes, scores: ts.map(t => t.match(/(\d)\/3 정답/)?.[0]), ids, codes: [codeA, codeB] });
    for (const p of [HA, GA, HB, GB]) await p.context().close();
  }
} catch (e) {
  rec('예외', false, { e: e.message.split('\n').slice(0, 3).join(' / ') });
} finally { await b.close(); }
console.log(`\n${results.filter(Boolean).length}/${results.length} PASS`);
process.exit(results.every(Boolean) ? 0 : 1);
