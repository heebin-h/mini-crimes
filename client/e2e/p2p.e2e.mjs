// P2P(PeerJS 공용 시그널링) 브라우저 E2E — 서버 없이 Vite dev/preview만 필요.
// 실행: (client) npx vite --port 5173  →  BASE_URL=http://localhost:5173 node e2e/p2p.e2e.mjs
// playwright 경로: PLAYWRIGHT_MODULE (기본 'playwright'). 네트워크로 0.peerjs.com 접속 필요.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const BASE = (process.env.BASE_URL || 'http://localhost:5173').replace(/\/$/, '');
const results = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function newPlayer(browser, name) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const id = `e2e-${name}`;
  await ctx.addInitScript(([id, name]) => {
    if (!localStorage.getItem('mc:profiles')) localStorage.setItem('mc:profiles', JSON.stringify([{ id, name, createdAt: '2026-01-01' }]));
    if (!localStorage.getItem('mc:currentProfile')) localStorage.setItem('mc:currentProfile', id);
  }, [id, name]);
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  return page;
}
const text = async p => (await p.locator('body').innerText()).replace(/\s+/g, ' ');
const gameState = p => p.evaluate(() => ({
  caseId: document.querySelector('.case-id')?.textContent ?? null,
  tiles: document.querySelectorAll('button[style*="aspect-ratio"]').length,
  scene: document.querySelector('img[alt="범죄 현장"]')?.naturalWidth ?? 0,
  ev: (document.body.innerText.match(/EVIDENCE \d+\/\d+/) || [null])[0],
  note: document.querySelector('textarea')?.value ?? null,
}));
const historyOf = p => p.evaluate(() => {
  const id = localStorage.getItem('mc:currentProfile');
  return JSON.parse(localStorage.getItem(`mc:history:${id}`) || '[]');
});

async function createRoom(host) {
  await host.goto(BASE + '/');
  await host.getByText('팀 수사').first().click();
  await host.locator('.modal-overlay button.btn-primary').last().click();
  await host.waitForURL(/\/lobby\//, { timeout: 20_000 });
  return host.url().split('/lobby/')[1];
}
async function joinRoom(guest, code) {
  await guest.goto(BASE + '/');
  await guest.getByPlaceholder('방 코드').fill(code);
  await guest.getByText('→ 참가').click();
}
const ANS = ['루카 모레노 (조카)', '와인에 탄 청산가리 (시안화칼륨)', '단독 유산 상속'];
async function submit(p) {
  await p.locator('button.btn-primary', { hasText: '최종 제출' }).first().click();
  for (const a of ANS) await p.locator('.modal-overlay button', { hasText: a }).click();
  await p.locator('.modal-overlay button.btn-primary').click();
}
// 단서 모달은 배경 클릭으로 닫힌다
const closeModal = p => p.locator('.modal-overlay').first().click({ position: { x: 5, y: 5 }, timeout: 3000 }).catch(() => {});
const ok = g => g.caseId === 'S1E01' && g.tiles === 10 && g.scene > 0;

async function scenario(name, fn) {
  if (process.env.ONLY && !name.includes(process.env.ONLY)) return; // 일부 시나리오만: ONLY=<이름 일부>
  const t0 = Date.now();
  try {
    const detail = await fn();
    const pass = detail.pass !== false;
    results.push({ name, pass, ms: Date.now() - t0, detail });
  } catch (e) {
    results.push({ name, pass: false, ms: Date.now() - t0, detail: { error: e.message.split('\n')[0] } });
  }
  const r = results.at(-1);
  console.log(`${r.pass ? 'PASS' : 'FAIL'} ${name} (${r.ms}ms) ${JSON.stringify(r.detail)}`);
}

const browser = await chromium.launch();
try {
  await scenario('프로필 없으면 프로필 화면, 생성 후 케이스 목록', async () => {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await p.goto(BASE + '/');
    await p.waitForURL(/\/profile/);
    await p.getByLabel('새 프로필 이름').fill('신규수사관');
    await p.getByText('▶ 만들고 시작').click();
    await p.waitForURL(u => new URL(u).pathname.endsWith('/'));
    const t = await text(p);
    await ctx.close();
    return { pass: t.includes('신규수사관') && t.includes('S1E01') };
  });

  await scenario('2인 전체 흐름: 생성→참가→개시→단서·노트 동기화→제출→결과·전적', async () => {
    const A = await newPlayer(browser, '호스트'), B = await newPlayer(browser, '게스트');
    const code = await createRoom(A);
    await joinRoom(B, code);
    await B.waitForURL(/\/lobby\//, { timeout: 20_000 });
    await A.getByText('[ 수사 팀 — 2/8 ]').waitFor({ timeout: 10_000 });
    await B.getByText('[ 수사 팀 — 2/8 ]').waitFor({ timeout: 10_000 });
    await A.getByText('▶ 수사 개시').click();
    await A.waitForURL(/\/game\//); await B.waitForURL(/\/game\//, { timeout: 10_000 });
    await sleep(1500);
    const gA = await gameState(A), gB = await gameState(B);
    await B.locator('button[style*="aspect-ratio"]').first().click();
    await closeModal(B);
    await A.locator('textarea').fill('범인은 조카');
    await sleep(1500);
    const sA = await gameState(A), sB = await gameState(B);
    await submit(A); await submit(B);
    await A.waitForURL(/\/result\//, { timeout: 15_000 }); await B.waitForURL(/\/result\//, { timeout: 15_000 });
    const rA = await text(A);
    const hA = await historyOf(A), hB = await historyOf(B);
    const errors = [...A.errors, ...B.errors];
    await A.context().close(); await B.context().close();
    return {
      pass: ok(gA) && ok(gB) && sA.ev === 'EVIDENCE 1/10' && sB.note === '범인은 조카' && rA.includes('3/3') && hA[0]?.mode === 'multi' && hB[0]?.stamp === 'SOLVED' && !errors.length,
      code, gA, gB, evA: sA.ev, noteB: sB.note, histA: hA.length, histB: hB.length, errors,
    };
  });

  await scenario('1인 팀 수사', async () => {
    const A = await newPlayer(browser, '혼자');
    await createRoom(A);
    await A.getByText('▶ 수사 개시').click();
    await A.waitForURL(/\/game\//); await sleep(1000);
    const g = await gameState(A);
    await A.context().close();
    return { pass: ok(g), g };
  });

  await scenario('잘못된 방 코드 · 같은 이름 참가 거부', async () => {
    const G = await newPlayer(browser, '나그네');
    await joinRoom(G, 'ZZZZZZ');
    await G.getByText('방을 찾을 수 없습니다').waitFor({ timeout: 20_000 });
    const A = await newPlayer(browser, '같은이름');
    const code = await createRoom(A);
    const C = await newPlayer(browser, '같은이름');
    await joinRoom(C, code);
    await C.getByText('같은 이름의 수사관').waitFor({ timeout: 20_000 });
    for (const p of [G, A, C]) await p.context().close();
    return { pass: true };
  });

  await scenario('게스트 새로고침 → 같은 게임 복귀 (공개 단서·노트 유지)', async () => {
    const A = await newPlayer(browser, '방장1'), B = await newPlayer(browser, '손님1');
    const code = await createRoom(A);
    await joinRoom(B, code); await B.waitForURL(/\/lobby\//, { timeout: 20_000 });
    await A.getByText('[ 수사 팀 — 2/8 ]').waitFor({ timeout: 10_000 });
    await A.getByText('▶ 수사 개시').click();
    await B.waitForURL(/\/game\//, { timeout: 10_000 }); await sleep(1000);
    await A.locator('button[style*="aspect-ratio"]').nth(2).click(); await closeModal(A);
    await A.locator('textarea').fill('메모 유지 확인');
    await sleep(1000);
    await B.reload();
    await sleep(6000);
    const g = await gameState(B);
    // 복귀 후 동기화 계속되는지: 방장이 단서 추가 공개
    await A.locator('button[style*="aspect-ratio"]').nth(4).click(); await closeModal(A);
    await sleep(1500);
    const g2 = await gameState(B);
    const url = new URL(B.url()).pathname;
    await A.context().close(); await B.context().close();
    return { pass: ok(g) && g.ev === 'EVIDENCE 1/10' && g.note === '메모 유지 확인' && g2.ev === 'EVIDENCE 2/10' && url.includes(code), g, g2 };
  });

  await scenario('방장 새로고침 → 같은 방 재호스팅, 게스트 자동 재연결 후 진행', async () => {
    const A = await newPlayer(browser, '방장2'), B = await newPlayer(browser, '손님2');
    const code = await createRoom(A);
    await joinRoom(B, code); await B.waitForURL(/\/lobby\//, { timeout: 20_000 });
    await A.getByText('[ 수사 팀 — 2/8 ]').waitFor({ timeout: 10_000 });
    await A.getByText('▶ 수사 개시').click();
    await B.waitForURL(/\/game\//, { timeout: 10_000 }); await sleep(1000);
    await B.locator('button[style*="aspect-ratio"]').first().click(); await closeModal(B);
    await sleep(800);
    const t0 = Date.now();
    await A.reload();
    await A.locator('.case-id').waitFor({ timeout: 30_000 });
    const gA = await gameState(A);
    const rehostMs = Date.now() - t0;
    // 게스트가 재연결되어 이후 이벤트가 오가는지
    let synced = false;
    for (let i = 0; i < 40 && !synced; i++) {
      await A.locator('button[style*="aspect-ratio"]').nth(5).click().catch(() => {}); await closeModal(A);
      await sleep(1000);
      synced = (await gameState(B)).ev === 'EVIDENCE 2/10';
    }
    await submit(A); await submit(B);
    let resulted = true;
    try { await A.waitForURL(/\/result\//, { timeout: 15_000 }); await B.waitForURL(/\/result\//, { timeout: 15_000 }); } catch { resulted = false; }
    await A.context().close(); await B.context().close();
    return { pass: ok(gA) && gA.ev === 'EVIDENCE 1/10' && synced && resulted, rehostMs, gA, synced, resulted };
  });

  await scenario('방장 5초 이탈 후 같은 탭으로 복귀 → 게스트 재연결 (peer-unavailable 반복에도 생존)', async () => {
    const A = await newPlayer(browser, '방장4'), B = await newPlayer(browser, '손님4');
    const code = await createRoom(A);
    await joinRoom(B, code); await B.waitForURL(/\/lobby\//, { timeout: 20_000 });
    await A.getByText('[ 수사 팀 — 2/8 ]').waitFor({ timeout: 10_000 });
    await A.getByText('▶ 수사 개시').click();
    await B.waitForURL(/\/game\//, { timeout: 10_000 }); await sleep(1500);
    const gameUrl = A.url();
    await A.goto('about:blank');
    await sleep(5000); // 게스트는 이 동안 재연결 시도마다 peer-unavailable
    await A.goto(gameUrl); // 같은 탭 sessionStorage로 재호스팅
    await A.locator('.case-id').waitFor({ timeout: 30_000 });
    let synced = false;
    for (let i = 0; i < 20 && !synced; i++) {
      await A.locator('button[style*="aspect-ratio"]').nth(3).click().catch(() => {}); await closeModal(A);
      await sleep(1000);
      synced = (await gameState(B)).ev === 'EVIDENCE 1/10';
    }
    const onGame = new URL(B.url()).pathname.includes('/game/');
    await A.context().close(); await B.context().close();
    return { pass: synced && onGame, synced, onGame };
  });

  await scenario('방장 이탈(페이지 떠남) → 게스트 재연결 시도 후 안내와 함께 홈', async () => {
    const A = await newPlayer(browser, '방장3'), B = await newPlayer(browser, '손님3');
    const code = await createRoom(A);
    await joinRoom(B, code); await B.waitForURL(/\/lobby\//, { timeout: 20_000 });
    await A.getByText('▶ 수사 개시').click();
    await B.waitForURL(/\/game\//, { timeout: 10_000 }); await sleep(1500);
    const t0 = Date.now();
    await A.goto('about:blank'); // 실제 탭 닫기·이동처럼 pagehide 발생 (context.close()는 pagehide 미발생)
    await B.waitForURL(u => !new URL(u).pathname.includes('/game/'), { timeout: 60_000 });
    const ms = Date.now() - t0;
    let notice = true;
    try { await B.getByText('방장과의 연결이 끊겨').waitFor({ timeout: 5000 }); } catch { notice = false; }
    await A.context().close(); await B.context().close();
    return { pass: notice && ms < 30_000, ms, notice };
  });

  await scenario('솔로: 채점·결과·전적 기록', async () => {
    const S = await newPlayer(browser, '솔로');
    await S.goto(BASE + '/game/solo?caseId=s1e01');
    await S.locator('.case-id').waitFor();
    await submit(S);
    await S.waitForURL(/\/result\/solo/);
    const t = await text(S);
    const h = await historyOf(S);
    await S.context().close();
    return { pass: t.includes('3/3') && h[0]?.mode === 'solo' && h[0]?.stamp === 'SOLVED', hist: h[0] };
  });
} finally {
  await browser.close();
}
const failed = results.filter(r => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} PASS`);
process.exit(failed ? 1 : 0);
