// 시나리오 추리 가능성 '휴리스틱' 점검 (증명 아님). 정답의 키워드가 단서 카드 본문에 몇 장 나오는지 세고,
// 오답 선택지의 핵심어가 단서에 나오는 횟수와 비교한다. 정답 근거가 단서에 0장이면 '추리 불가 의심', 오답이 더 많이 언급되면 '혼동 가능성'.
// 실행: node clue-coverage-heuristic.mjs   (client/ 에서 import 경로 사용)
import { ALL_CASES } from '/Users/heebiny/diyProj/mini-crimes/client/src/data/cases.js';
import answers from '/Users/heebiny/diyProj/mini-crimes/client/src/data/answers.js';
const QS = ['suspect', 'weapon', 'motive'];
const lc = s => String(s || '').toLowerCase();
const stop = new Set(['의', '및', '또는', '직원', '업체', '사업', '파트너']);
const words = t => lc(t).replace(/[()·,]/g, ' ').split(/\s+/).filter(w => w.length >= 2 && !stop.has(w));
const rows = []; const issues = [];
for (const c of ALL_CASES) {
  const corpus = c.clueCards.map(k => lc(`${k.label} ${k.description}`));
  const full = corpus.join(' ') + ' ' + lc(c.warningCard?.hint);
  for (const q of QS) {
    const a = answers[c.id][q];
    const hits = kws => corpus.filter(t => kws.some(k => t.includes(lc(k)))).length;
    const ans = hits(a.keywords);
    const others = c.choices[q].filter(o => o.text !== a.text).map(o => ({ t: o.text, n: hits(words(o.text)) }));
    const maxOther = Math.max(...others.map(o => o.n));
    const warn = a.keywords.some(k => lc(c.warningCard?.hint).includes(lc(k)));
    rows.push({ id: c.id, q, ans, maxOther, warn, clues: corpus.length });
    if (ans === 0 && !a.keywords.some(k => full.includes(lc(k)))) issues.push(`${c.id}/${q}: 정답 키워드가 단서·경고 어디에도 없음(추리 근거 없음 의심) — ${a.text}`);
    else if (ans === 0) issues.push(`${c.id}/${q}: 정답 키워드가 경고 카드에만 있음 — ${a.text}`);
    if (maxOther > ans) issues.push(`${c.id}/${q}: 오답이 정답보다 단서에 더 자주 언급됨(오답 ${maxOther}장 > 정답 ${ans}장) — 혼동 가능, 의도된 미끼일 수 있음`);
  }
}
console.log('case q 정답언급단서수 최다오답언급수 경고카드에정답 단서수');
for (const r of rows) console.log(r.id, r.q.padEnd(7), String(r.ans).padStart(2), String(r.maxOther).padStart(2), r.warn ? 'Y' : '-', r.clues);
console.log(`\n정답 언급 0장: ${rows.filter(r => r.ans === 0).length}/${rows.length} 문항, 오답 > 정답: ${rows.filter(r => r.maxOther > r.ans).length}/${rows.length} 문항`);
console.log(issues.length ? '\n의심 목록:\n' + issues.join('\n') : '\n의심 없음');
