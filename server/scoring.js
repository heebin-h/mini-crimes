function normalize(str) {
  return str.toLowerCase().replace(/\s+/g, '');
}

function scoreItem(userAnswer, keywords) {
  const norm = normalize(userAnswer);
  return keywords.some(kw => norm.includes(normalize(kw)));
}

// choices: { suspect: [{id, text, correct?}], ... } — 있으면 정답 텍스트 exact match, 없으면 keyword fallback
function scoreAll(playerAnswers, caseAnswer, choices) {
  const result = {};
  for (const [qid, { text, keywords }] of Object.entries(caseAnswer)) {
    const choiceList = choices?.[qid];
    let correct;
    if (choiceList) {
      const correctText = choiceList.find(c => c.correct)?.text ?? '';
      correct = (playerAnswers[qid] ?? '') === correctText;
    } else {
      correct = scoreItem(playerAnswers[qid] ?? '', keywords);
    }
    result[qid] = { correct, answerText: text, keywords };
  }
  return result;
}

module.exports = { scoreAll };
