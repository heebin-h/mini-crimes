// 전체 게임 브라우저 E2E — 솔로·팀·라우팅·프로필·보안(XSS)·모바일·이미지를 케이스/인원/결과 조합으로 전수 실행.
// 실행: (client) npx vite --port 5173  →  PLAYWRIGHT_MODULE=<경로> BASE_URL=http://localhost:5173 node e2e/full.e2e.mjs
// 배포 base 검증: VITE_BASE=/mini-crimes/ npx vite build && VITE_BASE=/mini-crimes/ npx vite preview --port 4173
//                 → BASE_URL=http://localhost:4173/mini-crimes node e2e/full.e2e.mjs   (SUITE=solo,img,mobile 처럼 일부만 가능)
// 팀(P2P) 시나리오는 0.peerjs.com 접속이 필요하다. SKIP_TEAM=1 이면 건너뜀.
import { createRequire } from 'node:module';
import { ALL_CASES } from '../src/data/cases.js';
import answers from '../src/data/answers.js';

const require = createRequire(import.meta.url);
const _pw = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const chromium = _pw[process.env.BROWSER || 'chromium']; // BROWSER=chromium|firefox|webkit

const BASE = (process.env.BASE_URL || 'http://localhost:5173').replace(/\/$/, '');
const SUITES = (process.env.SUITE || 'solo,img,route,profile,mobile,team').split(',');
const QS = ['suspect', 'weapon', 'motive'];
const PATTERNS = { all: [1, 1, 1], none: [0, 0, 0], first: [1, 0, 0], mid: [0, 1, 0], last: [0, 0, 1], two: [1, 1, 0] };
const PAT_KEYS = Object.keys(PATTERNS);
const results = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const sameOrigin = u => u.startsWith(new URL(BASE).origin);

const answerTexts = (c, pat) => QS.map((q, i) => PATTERNS[pat][i] ? answers[c.id][q].text : c.choices[q].find(o => o.text !== answers[c.id][q].text).text);

async function newPlayer(browser, name, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, ...opts });
  const id = `e2e-${name.replace(/\W/g, '').slice(0, 20)}`;
  await ctx.addInitScript(([id, name, seed]) => {
    if (seed === false) return;
    if (!localStorage.getItem('mc:profiles')) localStorage.setItem('mc:profiles', JSON.stringify([{ id, name, createdAt: '2026-01-01' }]));
    if (!localStorage.getItem('mc:currentProfile')) localStorage.setItem('mc:currentProfile', id);
  }, [id, name, opts.seedProfile]);
  const page = await ctx.newPage();
  page.errors = []; page.badResponses = [];
  page.on('pageerror', e => page.errors.push(`[${name}] ${e.message} | ${(e.stack || '').split('\n').slice(0, 3).join(' ← ').slice(0, 220)}`));
  page.on('response', r => {
    if (!sameOrigin(r.url()) || r.status() < 400) return;
    // ALLOW_404=1: GitHub Pages 모사 서버(딥링크에 404 상태+index 본문)에서 라우트 URL의 404는 정상. 자산(/assets, /cases)의 404는 여전히 결함.
    if (process.env.ALLOW_404 && r.status() === 404 && !/\/(assets|cases)\//.test(r.url()) && !/\.\w{2,5}$/.test(new URL(r.url()).pathname)) return;
    page.badResponses.push(`${r.status()} ${r.url()}`);
  });
  page.on('requestfailed', r => {
    const why = r.failure()?.errorText || '';
    if (/abort|cancel/i.test(why)) return; // 페이지 이동으로 취소된 요청(WebKit은 'Load request cancelled')은 결함이 아님
    if (sameOrigin(r.url())) page.badResponses.push(`FAILED ${r.url()} ${why}`);
  });
  page.pid = id;
  return page;
}
const text = async p => (await p.locator('body').innerText()).replace(/\s+/g, ' ');
const historyOf = p => p.evaluate(() => JSON.parse(localStorage.getItem(`mc:history:${localStorage.getItem('mc:currentProfile')}`) || '[]'));
const closeModal = p => p.locator('.modal-overlay').first().click({ position: { x: 5, y: 5 }, timeout: 3000 }).catch(() => {});
const tiles = p => p.locator('button[style*="aspect-ratio"]');
const evidence = async p => (await text(p)).match(/EVIDENCE (\d+)\/(\d+)/)?.slice(1).map(Number) ?? null;

async function pickAnswers(p, c, pat) {
  await p.locator('button.btn-primary', { hasText: '최종 제출' }).first().click();
  const texts = answerTexts(c, pat);
  for (const t of texts) await p.locator('.modal-overlay button').filter({ has: p.getByText(t, { exact: true }) }).click();
  await p.locator('.modal-overlay button.btn-primary').click();
}

async function scenario(name, fn) {
  if (process.env.ONLY && !name.includes(process.env.ONLY)) return; // 일부 시나리오만: ONLY=<이름 일부>
  const t0 = Date.now();
  try {
    const detail = await fn();
    results.push({ name, pass: detail.pass !== false, ms: Date.now() - t0, detail });
  } catch (e) {
    results.push({ name, pass: false, ms: Date.now() - t0, detail: { error: e.message.split('\n')[0], at: (e.stack?.split('\n').find(l => l.includes('full.e2e.mjs')) ?? '').trim().replace(/^.*\/e2e\//, '') } });
  }
  const r = results.at(-1);
  console.log(`${r.pass ? 'PASS' : 'FAIL'} ${name} (${r.ms}ms) ${JSON.stringify(r.detail)}`);
}
const has = n => SUITES.includes(n);
const clean = async (...ps) => { for (const p of ps) await p.context().close().catch(() => {}); };
const errs = (...ps) => ps.flatMap(p => [...p.errors, ...p.badResponses]);

const browser = await chromium.launch();
try {
  // ───────────────────────── 솔로: 10케이스 × 6패턴 ─────────────────────────
  if (has('solo')) {
    for (const [ci, c] of ALL_CASES.entries()) {
      for (const [pi, pat] of PAT_KEYS.entries()) {
        await scenario(`solo ${c.id} 패턴=${pat}`, async () => {
          const P = await newPlayer(browser, `솔로${ci}${pi}`);
          await P.goto(`${BASE}/game/solo?caseId=${c.id}`);
          await P.locator('.case-id').waitFor({ timeout: 10_000 });
          const nTiles = await tiles(P).count();
          const scene = await P.locator('img[alt="범죄 현장"]').evaluate(i => i.naturalWidth, null, { timeout: 5000 }).catch(() => 0);
          const k = (ci * 3 + pi) % 11;         // 공개할 단서 수 0~10
          const useWarning = (ci + pi) % 2 === 0;
          const imgFail = [];
          for (let i = 0; i < k; i++) {
            await tiles(P).nth(i).click();
            await P.locator('.modal-overlay img').first().waitFor({ timeout: 3000 }).catch(() => {});
            const w = await P.locator('.modal-overlay img').first().evaluate(im => im.naturalWidth).catch(() => -1);
            if (w <= 0) imgFail.push(i);
            await closeModal(P);
          }
          if (useWarning) {
            await P.getByText('경고 카드 사용', { exact: true }).first().click();
            await P.locator('.modal-overlay button', { hasText: '⚠ 경고 카드 사용 (효율성 감점)' }).click();
          }
          const ev = await evidence(P);
          await P.locator('textarea').fill(`메모 ${c.id} <b>${pat}</b>`);
          await pickAnswers(P, c, pat);
          await P.waitForURL(/\/result\/solo/, { timeout: 10_000 });
          await P.getByText(/효율 점수/).first().waitFor({ timeout: 5000 }); // URL 전환 직후 렌더 전 읽기 방지(미재현 일시 실패의 유력 원인)
          const t = await text(P);
          const want = PATTERNS[pat].filter(Boolean).length;
          const stamp = want === 3 ? 'SOLVED' : want === 0 ? 'FAILED' : 'PARTIAL';
          const effRaw = Math.round((1 - k / 10) * 100);
          const eff = Math.max(0, useWarning ? effRaw - 20 : effRaw);
          const h = (await historyOf(P))[0];
          const fails = errs(P);
          await clean(P);
          const checks = {
            tiles: nTiles === 10, evidence: ev?.[0] === k && ev?.[1] === 10, score: t.includes(`${want}/3 정답`), stamp: t.includes(stamp),
            revealedRow: t.includes(`공개한 단서 ${k} / 10`), warningRow: useWarning ? t.includes('사용됨 (-20)') : t.includes('미사용'), effRow: t.includes(`효율 점수 ${eff}`),
            history: h?.mode === 'solo' && h.caseId === c.id && h.stamp === stamp && h.correct === want && h.total === 3,
            scene: scene > 0, images: !imgFail.length, noErrors: !fails.length,
          };
          return {
            pass: Object.values(checks).every(Boolean),
            k, useWarning, want, stamp, eff, ev, failedChecks: Object.entries(checks).filter(([, v]) => !v).map(([n]) => n), imgFail, fails,
          };
        });
      }
    }
  }

  // ───────────────────────── 이미지 전수 (DOM 기준) ─────────────────────────
  if (has('img')) {
    await scenario('이미지 전수: 10케이스 × 13장 — fetch 200·image/webp·크기>0', async () => {
      const P = await newPlayer(browser, '이미지');
      await P.goto(BASE + '/');
      await P.locator('.mc-header, header').first().waitFor();
      const bad = [];
      let checked = 0;
      for (const c of ALL_CASES) {
        const paths = [c.sceneImage, c.thumbnail, c.warningCard.image, ...c.clueCards.map(x => x.image)];
        for (const path of paths) {
          const rel = path.replace(/^\//, '');
          const url = `${BASE}/${rel}`;
          const r = await P.evaluate(async u => { const x = await fetch(u); const b = await x.blob(); return { s: x.status, t: x.headers.get('content-type'), n: b.size }; }, url);
          checked++;
          if (r.s !== 200 || !/image\/webp/.test(r.t ?? '') || r.n <= 0) bad.push({ url, ...r });
        }
      }
      await clean(P);
      return { pass: checked === 130 && !bad.length, checked, bad: bad.slice(0, 5) };
    });
    await scenario('목록 화면: 시즌 탭(7/0/3)·썸네일 로드·COMING SOON', async () => {
      const P = await newPlayer(browser, '목록');
      await P.goto(BASE + '/');
      await P.locator('.case-id').first().waitFor();
      const t1 = await text(P);
      const thumbs1 = await P.locator('main img').evaluateAll(a => a.map(i => i.naturalWidth));
      await P.getByRole('button', { name: /SPECIAL/ }).click();
      await sleep(300);
      const thumbs3 = await P.locator('main img').evaluateAll(a => a.map(i => i.naturalWidth));
      await P.getByRole('button', { name: /SEASON 2/ }).click();
      const t2 = await text(P);
      const f = errs(P);
      await clean(P);
      return { pass: /SEASON 1 ?\(7\)/.test(t1) && /SEASON 2 ?\(0\)/.test(t1) && /SPECIAL ?\(3\)/.test(t1) && thumbs1.length === 7 && thumbs1.every(w => w > 0)
        && thumbs3.length === 3 && thumbs3.every(w => w > 0) && t2.includes('COMING SOON') && !f.length, thumbs1, thumbs3, f };
    });
  }

  // ───────────────────────── 라우팅·직접 URL ─────────────────────────
  if (has('route')) {
    await scenario('프로필 없을 때 모든 경로가 /profile로', async () => {
      const out = {};
      for (const path of ['/', '/lobby/ABC123', '/game/solo?caseId=s1e01', '/game/ABC123', '/result/solo', '/zzz']) {
        const P = await newPlayer(browser, '무프로필', { seedProfile: false });
        await P.goto(BASE + path);
        await sleep(500);
        out[path] = new URL(P.url()).pathname.replace(new URL(BASE).pathname.replace(/\/$/, ''), '');
        await clean(P);
      }
      return { pass: Object.values(out).every(v => v === '/profile'), out };
    });
    await scenario('프로필 있을 때 비정상 URL 처리 (없는 케이스·결과 데이터 없음·없는 방·알 수 없는 경로)', async () => {
      const P = await newPlayer(browser, '라우트');
      const out = {};
      await P.goto(`${BASE}/game/solo?caseId=nope`); await P.getByText('케이스를 찾을 수 없습니다').waitFor({ timeout: 5000 }); out.badCase = true;
      await P.goto(`${BASE}/game/solo`); await P.getByText('케이스를 찾을 수 없습니다').waitFor({ timeout: 5000 }); out.noCase = true;
      await P.goto(`${BASE}/result/solo`); await P.getByText('결과 데이터 없음').waitFor({ timeout: 5000 }); out.noResult = true;
      await P.goto(`${BASE}/result/ABC123`); await P.getByText('결과 데이터 없음').waitFor({ timeout: 5000 }); out.noResultTeam = true;
      await P.goto(`${BASE}/lobby/ABC123`); await P.waitForURL(u => !new URL(u).pathname.includes('/lobby/'), { timeout: 20_000 }); out.noLobby = true;
      await P.goto(`${BASE}/game/ABC123`); await P.waitForURL(u => !new URL(u).pathname.includes('/game/'), { timeout: 20_000 }); out.noGame = true;
      await P.goto(`${BASE}/zzz/yyy`); await P.waitForURL(u => new URL(u).pathname.replace(new URL(BASE).pathname.replace(/\/$/, ''), '') === '/', { timeout: 5000 }); out.unknown = true;
      const f = errs(P);
      await clean(P);
      return { pass: Object.keys(out).length === 7 && !f.length, out, f };
    });
    await scenario('솔로 결과 화면 새로고침 → 점수 유지 / 게임 화면 새로고침 → 메모 유지·단서 초기화', async () => {
      const c = ALL_CASES[2];
      const P = await newPlayer(browser, '새로고침솔로');
      await P.goto(`${BASE}/game/solo?caseId=${c.id}`); await P.locator('.case-id').waitFor();
      await P.locator('textarea').fill('새로고침 메모');
      await sleep(600); // 노트는 300ms 디바운스 후 저장 — 경계는 별도 시나리오
      await tiles(P).first().click(); await closeModal(P);
      await P.reload(); await P.locator('.case-id').waitFor();
      const note = await P.locator('textarea').inputValue();
      const ev = await evidence(P);
      await pickAnswers(P, c, 'two'); await P.waitForURL(/\/result\/solo/);
      await P.reload(); await sleep(800);
      const t = await text(P);
      await clean(P);
      return { pass: note === '새로고침 메모' && ev?.[0] === 0 && t.includes('2/3 정답') && t.includes('PARTIAL'), note, ev, hasScore: t.includes('2/3 정답') };
    });
    await scenario('메모 디바운스 경계: 입력 직후 새로고침해도 마지막 입력 보존(F1 수정 후) / 600ms 후도 보존', async () => {
      const c = ALL_CASES[0];
      const P = await newPlayer(browser, '디바운스');
      const trial = async (wait) => {
        await P.goto(`${BASE}/game/solo?caseId=${c.id}`); await P.locator('.case-id').waitFor();
        await P.evaluate(id => localStorage.removeItem(`note:${id}`), c.id);
        await P.reload(); await P.locator('.case-id').waitFor();
        await P.locator('textarea').fill(`메모-${wait}`);
        if (wait) await sleep(wait);
        await P.reload(); await P.locator('.case-id').waitFor();
        return P.locator('textarea').inputValue();
      };
      const immediate = await trial(0), after600 = await trial(600);
      await clean(P);
      // 합격 기준은 "600ms 후에는 보존". 즉시 새로고침 결과(immediate)는 현재 동작을 기록하는 관찰값이다
      return { pass: after600 === '메모-600' && immediate.startsWith('메모-'), immediate, after600, immediateLost: immediate === '' };
    });
    await scenario('뒤로가기·앞으로가기: 결과→게임→목록에서 빈 화면·오류 없음', async () => {
      const c = ALL_CASES[0];
      const P = await newPlayer(browser, '뒤로가기');
      await P.goto(BASE + '/'); await P.locator('.case-id').first().waitFor();
      await P.goto(`${BASE}/game/solo?caseId=${c.id}`); await P.locator('.case-id').waitFor();
      await pickAnswers(P, c, 'all'); await P.waitForURL(/\/result\/solo/);
      const seen = [];
      for (const step of ['back', 'back', 'forward', 'forward']) {
        await (step === 'back' ? P.goBack() : P.goForward()); await sleep(700);
        const t = await text(P);
        seen.push({ step, path: new URL(P.url()).pathname.split('/').slice(-2).join('/'), blank: t.length < 20 });
      }
      const f = errs(P);
      await clean(P);
      return { pass: seen.every(s => !s.blank) && !f.length, seen, f };
    });
    await scenario('입력 경계: 이름 공백·방 코드 비움·소문자+공백 코드', async () => {
      const P = await newPlayer(browser, '입력경계');
      await P.goto(BASE + '/'); await P.getByPlaceholder('이름을 입력하세요').fill('   ');
      await P.getByPlaceholder('방 코드').fill('ABC123'); await P.getByText('→ 참가').click();
      await P.getByText('이름을 입력하세요', { exact: false }).first().waitFor({ timeout: 3000 });
      await P.getByPlaceholder('이름을 입력하세요').fill('경계');
      await P.getByPlaceholder('방 코드').fill('   '); await P.getByText('→ 참가').click();
      await P.getByText('방 코드를 입력하세요').waitFor({ timeout: 3000 });
      const lenLimit = await P.getByPlaceholder('이름을 입력하세요').evaluate(i => i.maxLength);
      await clean(P);
      return { pass: lenLimit === 20, lenLimit };
    });
  }

  // ───────────────────────── 프로필·전적 ─────────────────────────
  if (has('profile')) {
    await scenario('프로필: 생성·중복·공백·20자 절단·XSS 이름·삭제(확인 2단계)', async () => {
      const ctx = await browser.newContext(); const P = await ctx.newPage(); P.errors = [];
      P.on('pageerror', e => P.errors.push(e.message));
      await P.goto(BASE + '/'); await P.waitForURL(/\/profile/);
      const input = P.getByLabel('새 프로필 이름');
      await input.fill('   '); await P.getByText('▶ 만들고 시작').click();
      await P.getByText('이름을 입력하세요').waitFor({ timeout: 3000 });
      await input.fill('<svg onload=__x=1>'); await P.getByText('▶ 만들고 시작').click();
      await P.waitForURL(u => !new URL(u).pathname.endsWith('/profile'));
      await sleep(300);
      const xss1 = await P.evaluate(() => window.__x ?? null);
      const shown = (await text(P)).includes('<svg onload=__x=1>');
      await P.getByText('프로필 변경').click(); await P.waitForURL(/\/profile/);
      await P.getByLabel('새 프로필 이름').fill('<svg onload=__x=1>'); await P.getByText('▶ 만들고 시작').click();
      const dup = (await P.getByRole('alert').innerText().catch(() => '')).includes('이미 있는');
      await P.getByLabel('새 프로필 이름').fill('가'.repeat(40)); await P.getByText('▶ 만들고 시작').click();
      await P.waitForURL(u => !new URL(u).pathname.endsWith('/profile'));
      const stored = await P.evaluate(() => JSON.parse(localStorage.getItem('mc:profiles')).map(p => p.name.length));
      await P.getByText('프로필 변경').click(); await P.waitForURL(/\/profile/);
      await P.getByLabel(/프로필 삭제/).first().click();
      const confirmShown = await P.getByText('삭제 확인').count();
      const beforeDel = (await P.evaluate(() => JSON.parse(localStorage.getItem('mc:profiles')).length));
      await P.getByText('삭제 확인').click();
      const afterDel = (await P.evaluate(() => JSON.parse(localStorage.getItem('mc:profiles')).length));
      await ctx.close();
      return { pass: xss1 === null && shown && dup && stored.includes(20) && confirmShown === 1 && beforeDel === 2 && afterDel === 1 && !P.errors.length, xss1, shown, dup, stored, beforeDel, afterDel, errors: P.errors };
    });
    await scenario('전적: 100건 상한(최신순)·손상된 저장값 복구·저장소 비어도 동작', async () => {
      const c = ALL_CASES[1];
      const P = await newPlayer(browser, '전적');
      await P.goto(BASE + '/');
      await P.evaluate(() => {
        const id = localStorage.getItem('mc:currentProfile');
        localStorage.setItem(`mc:history:${id}`, JSON.stringify(Array.from({ length: 100 }, (_, i) => ({ caseId: 's1e01', caseTitle: `old${i}`, mode: 'solo', correct: 3, total: 3, stamp: 'SOLVED', playedAt: `2026-01-01T00:00:${String(i % 60).padStart(2, '0')}Z` }))));
      });
      await P.goto(`${BASE}/game/solo?caseId=${c.id}`); await P.locator('.case-id').waitFor();
      await pickAnswers(P, c, 'none'); await P.waitForURL(/\/result\/solo/);
      const h = await historyOf(P);
      // 손상값
      await P.evaluate(() => { const id = localStorage.getItem('mc:currentProfile'); localStorage.setItem(`mc:history:${id}`, '{not json'); });
      await P.goto(BASE + '/'); await P.locator('.case-id').first().waitFor();
      const okAfterCorrupt = (await text(P)).includes('MINI CRIMES');
      await P.goto(`${BASE}/game/solo?caseId=${c.id}`); await P.locator('.case-id').waitFor();
      await pickAnswers(P, c, 'all'); await P.waitForURL(/\/result\/solo/);
      const h2 = await historyOf(P);
      const backups = await P.evaluate(() => Object.keys(localStorage).filter(k => /bak|corrupt|backup/i.test(k)).length);
      const f = errs(P);
      await clean(P);
      return { pass: h.length === 100 && h[0].stamp === 'FAILED' && h[0].caseId === c.id && h.at(-1).caseTitle === 'old98' && okAfterCorrupt && h2.length === 1 && h2[0].stamp === 'SOLVED' && backups >= 1 && !f.length,
        len: h.length, newest: h[0]?.stamp, oldest: h.at(-1)?.caseTitle, okAfterCorrupt, h2len: h2.length, backups, f };
    });
  }

  // ───────────────────────── 모바일 ─────────────────────────
  if (has('mobile')) {
    for (const [name, vp] of [['iPhone13', { width: 390, height: 844 }], ['SE', { width: 320, height: 568 }], ['태블릿', { width: 768, height: 1024 }]]) {
      await scenario(`모바일 ${name} (${vp.width}x${vp.height}): 10케이스 게임·제출 모달·결과 가로 스크롤/화면 밖 컨트롤 0`, async () => {
        const P = await newPlayer(browser, `모바일${vp.width}`, { viewport: vp, isMobile: true, hasTouch: true });
        const probs = [];
        const overflow = async label => {
          const o = await P.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
          // isMobile 에뮬레이션은 넘침이 있으면 innerWidth가 같이 커지므로 선언한 뷰포트 너비(vp.width)와 비교한다.
          if (o.sw > vp.width + 1 || o.sw > o.iw + 1) probs.push(`${label} 가로 스크롤 ${o.sw}>${vp.width}(iw ${o.iw})`);
        };
        await P.goto(BASE + '/'); await P.locator('.case-id').first().waitFor(); await overflow('목록');
        for (const c of ALL_CASES) {
          await P.goto(`${BASE}/game/solo?caseId=${c.id}`); await P.locator('.case-id').waitFor();
          await overflow(`${c.id} 게임`);
          if ((await tiles(P).count()) !== 10) probs.push(`${c.id} 타일 수`);
          const sub = P.locator('button.btn-primary', { hasText: '최종 제출' }).first();
          const box = await sub.boundingBox();
          if (!box || box.x < 0 || box.x + box.width > vp.width + 1) probs.push(`${c.id} 제출 버튼 화면 밖`);
          await sub.click();
          const mb = await P.locator('.modal-overlay button.btn-primary').boundingBox().catch(() => null);
          if (!mb || mb.x < 0 || mb.x + mb.width > vp.width + 1) probs.push(`${c.id} 모달 제출 버튼 화면 밖`);
          await overflow(`${c.id} 모달`);
          await P.locator('.modal-overlay button', { hasText: '취소' }).click();
        }
        const c = ALL_CASES[0];
        await P.goto(`${BASE}/game/solo?caseId=${c.id}`); await P.locator('.case-id').waitFor();
        await pickAnswers(P, c, 'two'); await P.waitForURL(/\/result\/solo/); await overflow('결과');
        const f = errs(P);
        await clean(P);
        return { pass: !probs.length && !f.length, probs: probs.slice(0, 6), f };
      });
    }
  }

  // ───────────────────────── 팀(P2P, 실제 PeerJS) ─────────────────────────
  if (has('team') && !process.env.SKIP_TEAM) {
    const createRoomFor = async (host, c) => {
      await host.goto(BASE + '/'); await host.locator('.case-id').first().waitFor();
      if (!c.season) await host.getByRole('button', { name: /SPECIAL/ }).click();
      const card = host.getByText(c.title, { exact: true }).first().locator('xpath=ancestor::div[.//button[normalize-space()="팀 수사"]][1]');
      await card.getByText('팀 수사', { exact: true }).click();
      await host.locator('.modal-overlay button.btn-primary').last().click();
      await host.waitForURL(/\/lobby\//, { timeout: 25_000 });
      return host.url().split('/lobby/')[1];
    };
    const joinRoomRaw = async (g, code) => {
      await g.goto(BASE + '/'); await g.locator('.case-id').first().waitFor();
      await g.getByPlaceholder('방 코드').fill(code); await g.getByText('→ 참가').click();
    };
    const gameOk = async (p, c) => {
      await p.locator('.case-id').waitFor({ timeout: 15_000 });
      const scene = await p.locator('img[alt="범죄 현장"]').evaluate(i => i.naturalWidth, null, { timeout: 5000 }).catch(() => 0);
      return (await text(p)).includes(c.id.toUpperCase()) && (await tiles(p).count()) === 10 && scene > 0;
    };

    for (const [ci, c] of ALL_CASES.entries()) {
      await scenario(`팀(1인) ${c.id}: 카드 선택→방 생성→개시→게임 화면·제출→결과`, async () => {
        const A = await newPlayer(browser, `방장${ci}`);
        await createRoomFor(A, c);
        await A.getByText('▶ 수사 개시').click();
        await A.waitForURL(/\/game\//, { timeout: 15_000 });
        const ok = await gameOk(A, c);
        const pat = PAT_KEYS[ci % PAT_KEYS.length];
        await pickAnswers(A, c, pat);
        await A.waitForURL(/\/result\//, { timeout: 15_000 });
        const t = await text(A);
        const want = PATTERNS[pat].filter(Boolean).length;
        const h = (await historyOf(A))[0];
        const f = errs(A);
        await clean(A);
        return { pass: ok && t.includes(`${want}/3 정답`) && h?.mode === 'multi' && h.caseId === c.id && h.correct === want && !f.length, ok, pat, want, f };
      });
    }

    await scenario('팀 8인 만석: 7명 참가·9번째 거부·개시·단서/메모 동기화·8명 각자 패턴 제출·팀 결과·전적 8건', async () => {
      const c = ALL_CASES[0];
      const players = [];
      for (let i = 0; i < 8; i++) players.push(await newPlayer(browser, `수사관${i}`));
      const [H, ...G] = players;
      const code = await createRoomFor(H, c);
      for (const g of G) { await joinRoomRaw(g, code); await g.waitForURL(/\/lobby\//, { timeout: 25_000 }); }
      for (const p of players) await p.getByText('[ 수사 팀 — 8/8 ]').waitFor({ timeout: 30_000 });
      const late = await newPlayer(browser, '아홉째');
      await joinRoomRaw(late, code);
      await late.getByText('방이 꽉 찼습니다').waitFor({ timeout: 25_000 });
      await H.getByText('▶ 수사 개시').click();
      for (const p of players) await p.waitForURL(/\/game\//, { timeout: 20_000 });
      for (const p of players) if (!(await gameOk(p, c))) throw new Error('게임 화면 불완전');
      await G[3].locator('button[style*="aspect-ratio"]').nth(4).click(); await closeModal(G[3]);
      await G[5].locator('textarea').fill('8인 메모 <script>window.__xss=1</script>');
      await sleep(2500);
      const evs = []; const notes = [];
      for (const p of players) { evs.push((await evidence(p))?.[0]); notes.push(await p.locator('textarea').inputValue()); }
      const synced = evs.every(v => v === 1) && notes.filter((n, i) => i !== 5).every(n => n.includes('<script>'));
      const pats = players.map((_, i) => PAT_KEYS[i % PAT_KEYS.length]);
      for (const [i, p] of players.entries()) {
        await pickAnswers(p, c, pats[i]);
        if (i < 7) { await sleep(150); if (/\/result\//.test(p.url())) throw new Error(`제출 ${i + 1}/8에서 조기 공개`); }
      }
      for (const p of players) await p.waitForURL(/\/result\//, { timeout: 25_000 });
      const out = [];
      for (const [i, p] of players.entries()) {
        const t = await text(p);
        const want = PATTERNS[pats[i]].filter(Boolean).length;
        const h = await historyOf(p);
        const xss = await p.evaluate(() => window.__xss ?? null);
        out.push({ score: t.includes(`${want}/3 정답`), teamPanel: t.includes('[ 팀 결과 ]'), hist1: h.length === 1, histOk: h[0]?.correct === want && h[0]?.total === 3 && h[0]?.mode === 'multi', xss: xss === null });
      }
      const f = errs(...players, late);
      await clean(...players, late);
      return { pass: synced && out.every(o => Object.values(o).every(Boolean)) && !f.length, synced, evs, out, f: f.slice(0, 4) };
    });

    await scenario('방 코드 입력 변형: 소문자·앞/뒤 공백 모두 참가 성공(F2 수정 후)', async () => {
      const c = ALL_CASES[0];
      const H = await newPlayer(browser, '코드방장');
      const code = await createRoomFor(H, c);
      const out = {};
      for (const [k, v] of Object.entries({ lower: code.toLowerCase(), trailingSpace: `${code} `, leadingSpace: ` ${code}` })) {
        const G = await newPlayer(browser, `코드${k.length}`);
        await G.goto(BASE + '/'); await G.locator('.case-id').first().waitFor();
        await G.getByPlaceholder('방 코드').fill(v); await G.getByText('→ 참가').click();
        out[k] = await G.waitForURL(/\/lobby\//, { timeout: 12_000 }).then(() => true).catch(() => false);
        await clean(G);
      }
      await clean(H);
      // 합격 기준: 소문자·뒤 공백은 성공. 앞 공백(붙여넣기 시 흔함)은 현재 동작을 기록하는 관찰값
      return { pass: out.lower && out.trailingSpace && out.leadingSpace, ...out };
    });

    await scenario('팀 3인: 방장 수동 공개(일부 제출) → 미제출자도 결과 화면 이동, 점수 없음 / 진행·종료 후 참가 거부', async () => {
      const c = ALL_CASES[3];
      const [H, A, B] = [await newPlayer(browser, '수동방장'), await newPlayer(browser, '제출자'), await newPlayer(browser, '미제출자')];
      const code = await createRoomFor(H, c);
      for (const g of [A, B]) { await joinRoomRaw(g, code); await g.waitForURL(/\/lobby\//, { timeout: 25_000 }); }
      await H.getByText('[ 수사 팀 — 3/8 ]').waitFor({ timeout: 20_000 });
      await H.getByText('▶ 수사 개시').click();
      for (const p of [H, A, B]) await p.waitForURL(/\/game\//, { timeout: 20_000 });
      const late = await newPlayer(browser, '진행중참가');
      await joinRoomRaw(late, code);
      const lateMsg = await late.getByText('이미 진행 중인 게임입니다').waitFor({ timeout: 25_000 }).then(() => true).catch(() => false);
      await pickAnswers(A, c, 'all');
      await sleep(800);
      const guestHasRevealBtn = await B.getByText('정답 공개').count();
      await H.getByText('정답 공개').click();
      for (const p of [H, A, B]) await p.waitForURL(/\/result\//, { timeout: 20_000 });
      const tH = await text(H), tA = await text(A), tB = await text(B);
      const late2 = await newPlayer(browser, '종료후참가');
      await joinRoomRaw(late2, code);
      const late2Msg = await late2.getByText('이미 진행 중인 게임입니다').waitFor({ timeout: 25_000 }).then(() => true).catch(() => false);
      const hB = await historyOf(B);
      const f = errs(H, A, B, late, late2);
      await clean(H, A, B, late, late2);
      return { pass: lateMsg && late2Msg && guestHasRevealBtn === 0 && tA.includes('3/3 정답') && !tH.includes('정답 미확인') && hB.length <= 1 && !f.length, lateMsg, late2Msg, guestHasRevealBtn, hBlen: hB.length, tBhasScore: /\d\/3 정답/.test(tB), f: f.slice(0, 3) };
    });

    await scenario('팀: 소문자 방 코드로 참가, 이름 XSS(방장·게스트)가 화면에서 실행되지 않음', async () => {
      const c = ALL_CASES[4];
      const XSS = '<svg onload=__x=1>';
      const H = await newPlayer(browser, XSS), G = await newPlayer(browser, '<b>굵게</b>');
      const code = await createRoomFor(H, c);
      await G.goto(BASE + '/'); await G.locator('.case-id').first().waitFor();
      await G.getByPlaceholder('방 코드').fill(code.toLowerCase()); await G.getByText('→ 참가').click();
      await G.waitForURL(/\/lobby\//, { timeout: 25_000 });
      await H.getByText('[ 수사 팀 — 2/8 ]').waitFor({ timeout: 20_000 });
      await G.getByText('[ 수사 팀 — 2/8 ]').waitFor({ timeout: 20_000 });
      const lobbyText = await text(G);
      await H.getByText('▶ 수사 개시').click();
      for (const p of [H, G]) await p.waitForURL(/\/game\//, { timeout: 20_000 });
      await pickAnswers(H, c, 'all'); await pickAnswers(G, c, 'none');
      for (const p of [H, G]) await p.waitForURL(/\/result\//, { timeout: 20_000 });
      const tG = await text(G);
      const xss = [await H.evaluate(() => window.__x ?? null), await G.evaluate(() => window.__x ?? null)];
      const bold = await G.locator('b', { hasText: '굵게' }).count();
      const f = errs(H, G);
      await clean(H, G);
      const lobbyHasXss = lobbyText.includes(XSS), teamPanel = tG.includes('팀 결과'), resultHasXss = tG.includes(XSS);
      return { pass: lobbyHasXss && xss.every(v => v === null) && bold === 0 && teamPanel && !f.length, lobbyHasXss, teamPanel, resultHasXss, xss, bold, lobbySnippet: lobbyText.slice(0, 160), f: f.slice(0, 3) };
    });

    await scenario('팀 로비: 게스트 이탈 → 방장 인원 감소(유예 후), 재참가 가능 / 방장 이탈 → 게스트 홈 안내', async () => {
      const c = ALL_CASES[5];
      const H = await newPlayer(browser, '로비방장'), G = await newPlayer(browser, '로비게스트');
      const code = await createRoomFor(H, c);
      await joinRoomRaw(G, code); await G.waitForURL(/\/lobby\//, { timeout: 25_000 });
      await H.getByText('[ 수사 팀 — 2/8 ]').waitFor({ timeout: 20_000 });
      const t0 = Date.now();
      await G.goto('about:blank');
      await H.getByText('[ 수사 팀 — 1/8 ]').waitFor({ timeout: 60_000 });
      const dropMs = Date.now() - t0;
      // 새 탭(토큰 없음)은 유예(20초) 동안 같은 이름이 거부되어야 한다 — 참가 토큰 정책(이름만으로 자리 가로채기 방지)
      const G2 = await newPlayer(browser, '로비게스트');
      await joinRoomRaw(G2, code);
      const takenDuringGrace = await G2.getByText('같은 이름의 수사관').waitFor({ timeout: 25_000 }).then(() => true).catch(() => false);
      await sleep(22_000); // 유예 만료 → 로비 자리 반환
      await joinRoomRaw(G2, code); await G2.waitForURL(/\/lobby\//, { timeout: 25_000 });
      await H.getByText('[ 수사 팀 — 2/8 ]').waitFor({ timeout: 20_000 });
      await H.goto('about:blank');
      await G2.waitForURL(u => !new URL(u).pathname.includes('/lobby/'), { timeout: 60_000 });
      const notice = await G2.getByText('방장과의 연결이 끊겨').waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
      await clean(H, G, G2);
      return { pass: dropMs < 40_000 && notice && takenDuringGrace, dropMs, takenDuringGrace, notice };
    });

    await scenario('팀 진행 중: 게스트 새로고침 후 제출 → 결과 화면 새로고침해도 점수·팀 결과 유지', async () => {
      const c = ALL_CASES[6];
      const H = await newPlayer(browser, '결과방장'), G = await newPlayer(browser, '결과게스트');
      const code = await createRoomFor(H, c);
      await joinRoomRaw(G, code); await G.waitForURL(/\/lobby\//, { timeout: 25_000 });
      await H.getByText('[ 수사 팀 — 2/8 ]').waitFor({ timeout: 20_000 });
      await H.getByText('▶ 수사 개시').click();
      for (const p of [H, G]) await p.waitForURL(/\/game\//, { timeout: 20_000 });
      await G.reload(); await sleep(7000);
      try { await pickAnswers(G, c, 'two'); } catch { // 실패 시 게스트 화면 상태를 오류에 남긴다(진단용)
        throw new Error(`게스트 제출 조작 실패 url=${new URL(G.url()).pathname} ui="${(await text(G)).slice(0, 160)}" modal=${await G.locator('.modal-overlay').count()}`);
      }
      await pickAnswers(H, c, 'last');
      for (const p of [H, G]) await p.waitForURL(/\/result\//, { timeout: 25_000 });
      await G.reload(); await sleep(1500);
      const tG = await text(G);
      const tH = await text(H);
      const hG = await historyOf(G);
      const f = errs(H, G);
      await clean(H, G);
      return { pass: tG.includes('2/3 정답') && tH.includes('1/3 정답') && hG.length === 1 && hG[0].correct === 2 && !f.length, scoreAfterReload: tG.includes('2/3 정답'), teamPanelAfterReload: tG.includes('팀 결과'), hist: hG.length, f: f.slice(0, 3) };
    });
  }
} finally {
  await browser.close();
}
const failed = results.filter(r => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
if (failed.length) console.log('FAILED:\n' + failed.map(r => ` - ${r.name}: ${JSON.stringify(r.detail).slice(0, 300)}`).join('\n'));
process.exit(failed.length ? 1 : 0);
