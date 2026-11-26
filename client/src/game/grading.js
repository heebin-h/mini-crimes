// 채점 — 4지선다 선택지 text와 정답 text의 정확 일치 (이전 server/scoring.js의 choices 경로와 동일).
// 정답 데이터는 별도 청크(../data/answers.js)로 분리되어 채점 시에만 로드된다.

/**
 * @param {Record<string,string>} playerAnswers  { suspect, weapon, motive } — 선택지 text
 * @param {Record<string,{text:string, keywords?:string[]}>} caseAnswer
 */
export function scoreAll(playerAnswers, caseAnswer) {
  const result = {};
  for (const [qid, { text, keywords = [] }] of Object.entries(caseAnswer ?? {})) {
    const given = playerAnswers && typeof playerAnswers[qid] === 'string' ? playerAnswers[qid] : '';
    result[qid] = { correct: given === text, answerText: text, keywords };
  }
  return result;
}

export function stampOf(correct, total) {
  if (total > 0 && correct === total) return 'SOLVED';
  if (correct === 0) return 'FAILED';
  return 'PARTIAL';
}

export async function loadCaseAnswer(caseId) {
  const { default: answers } = await import('../data/answers.js');
  return Object.hasOwn(answers, caseId) ? answers[caseId] : null;
}
