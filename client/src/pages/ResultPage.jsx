import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { socket } from '../socket';

export default function ResultPage() {
  const { roomId } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const isSolo = roomId === 'solo';
  const myId = socket.id;

  if (!state) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="label" style={{ marginBottom: 12 }}>결과 데이터 없음</div>
          <button className="btn-primary" onClick={() => navigate('/')}>처음으로</button>
        </div>
      </div>
    );
  }

  const { caseAnswer, playerAnswers, scores, caseId, revealedClues = [], warningUsed = false, totalClues = 10, players = [], questions: caseQuestions = [] } = state;
  const nameMap = Object.fromEntries(players.map(p => [p.id, p.name]));
  const caseQMap = Object.fromEntries(caseQuestions.map(q => [q.id, q.label]));

  const myAnswers = isSolo ? playerAnswers?.solo : playerAnswers?.[myId];
  const myScores = scores?.[myId] ?? scores?.solo ?? null;

  const Q_LABELS = { suspect: '범인은 누구인가?', weapon: '어떤 수단을 사용했는가?', motive: '범행 동기는 무엇인가?' };
  const questions = caseAnswer
    ? Object.entries(caseAnswer).map(([id, v]) => ({ id, label: caseQMap[id] ?? Q_LABELS[id] ?? id, ...v }))
    : Object.keys(myAnswers ?? {}).map(id => ({ id, label: caseQMap[id] ?? Q_LABELS[id] ?? id, text: '(정답 미확인)', keywords: [] }));

  const correctCount = myScores ? Object.values(myScores).filter(s => s.correct).length : null;
  const total = questions.length;
  const allCorrect = correctCount === total;

  // 효율성 점수: 공개한 단서 비율 (적을수록 좋음), 경고카드 사용 시 페널티
  const efficiencyRaw = totalClues > 0 ? Math.round((1 - revealedClues.length / totalClues) * 100) : 100;
  const efficiencyScore = Math.max(0, warningUsed ? efficiencyRaw - 20 : efficiencyRaw);
  const hasEfficiency = revealedClues.length > 0 || totalClues > 0;

  const overallStamp = !myScores ? null : allCorrect ? 'SOLVED' : correctCount === 0 ? 'FAILED' : 'PARTIAL';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 헤더 */}
      <header style={{ borderBottom: '1px solid var(--border)', padding: '14px 28px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div className="brand-logo">MINI CRIMES</div>
        <span style={{ color: 'var(--border)' }}>|</span>
        <div className="label">CASE CLOSED — FINAL REPORT</div>
        <div style={{ flex: 1 }} />
        {overallStamp && (
          <span className={`stamp ${overallStamp === 'SOLVED' ? 'stamp-green' : overallStamp === 'FAILED' ? 'stamp-red' : 'stamp-amber'}`}>
            {overallStamp}
          </span>
        )}
      </header>

      <div style={{ flex: 1, padding: '32px 28px', maxWidth: 680, margin: '0 auto', width: '100%' }}>

        {/* 최상단 요약 */}
        <div className="panel-evidence" style={{ padding: '20px 24px', marginBottom: 20, display: 'flex', gap: 24, alignItems: 'center' }}>
          <div style={{ fontSize: 48, lineHeight: 1 }}>
            {overallStamp === 'SOLVED' ? '🏆' : overallStamp === 'FAILED' ? '💀' : overallStamp === 'PARTIAL' ? '🔎' : '🔍'}
          </div>
          <div style={{ flex: 1 }}>
            {correctCount !== null ? (
              <>
                <div style={{ fontSize: 22, fontWeight: 700, color: allCorrect ? 'var(--green)' : correctCount === 0 ? 'var(--red)' : 'var(--amber)', marginBottom: 4 }}>
                  {correctCount}/{total} 정답
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                  {allCorrect ? '완벽한 추리 — 모든 항목 일치' : correctCount === 0 ? '아직 멀었습니다. 다시 수사하세요.' : '일부 항목 불일치 — 재검토 필요'}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>케이스 완료</div>
            )}
          </div>

          {/* 효율성 점수 */}
          {hasEfficiency && (
            <div style={{ textAlign: 'center', padding: '12px 20px', background: 'var(--surface)', border: '1px solid var(--border)', minWidth: 100 }}>
              <div className="label" style={{ marginBottom: 6 }}>효율성</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: efficiencyScore >= 70 ? 'var(--green)' : efficiencyScore >= 40 ? 'var(--amber)' : 'var(--red)' }}>
                {efficiencyScore}
              </div>
              <div style={{ fontSize: 10, color: 'var(--ink-muted)', marginTop: 2 }}>/100</div>
            </div>
          )}
        </div>

        {/* 효율성 세부 */}
        {hasEfficiency && (
          <div className="panel" style={{ padding: '14px 16px', marginBottom: 20, display: 'flex', gap: 20, fontSize: 12 }}>
            <EffRow label="공개한 단서" value={`${revealedClues.length} / ${totalClues}`} />
            <EffRow label="미공개 단서" value={totalClues - revealedClues.length} highlight />
            <EffRow label="경고 카드" value={warningUsed ? '사용됨 (-20)' : '미사용'} warn={warningUsed} />
            <EffRow label="효율 점수" value={efficiencyScore} amber />
          </div>
        )}

        {/* 항목별 결과 */}
        <div className="label" style={{ marginBottom: 10 }}>[ 수사 결과 ]</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
          {questions.map((q, i) => {
            const userAnswer = myAnswers?.[q.id] ?? '(미입력)';
            const score = myScores?.[q.id];
            const correct = score?.correct;
            return (
              <div key={q.id} style={{
                background: 'var(--surface)',
                border: `1px solid ${score ? (correct ? 'var(--green)' : 'var(--border-danger)') : 'var(--border)'}`,
                padding: '14px 16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 20, height: 20, border: `1px solid ${score ? (correct ? 'var(--green)' : 'var(--red)') : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: score ? (correct ? 'var(--green)' : 'var(--red)') : 'var(--ink-muted)', flexShrink: 0 }}>
                    {score ? (correct ? '✓' : '✕') : i + 1}
                  </div>
                  <span className="label" style={{ fontSize: 10 }}>{q.id.toUpperCase()}</span>
                  <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>{q.label ?? q.id}</span>
                </div>
                <div style={{ display: 'flex', gap: 20, fontSize: 12 }}>
                  <div>
                    <span style={{ color: 'var(--ink-muted)' }}>내 답: </span>
                    <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{userAnswer}</span>
                  </div>
                  {caseAnswer && (
                    <div>
                      <span style={{ color: 'var(--ink-muted)' }}>정답: </span>
                      <span style={{ fontWeight: 600, color: correct ? 'var(--green)' : 'var(--red)' }}>{q.text}</span>
                      <span style={{ fontSize: 10, color: 'var(--ink-dim)', marginLeft: 8 }}>
                        ({q.keywords?.join(', ')})
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 팀 결과 */}
        {!isSolo && scores && Object.keys(scores).length > 1 && (
          <>
            <div className="label" style={{ marginBottom: 10 }}>[ 팀 결과 ]</div>
            <div className="panel" style={{ padding: '12px 16px', marginBottom: 24 }}>
              {Object.entries(scores).map(([pid, s]) => {
                const c = s ? Object.values(s).filter(x => x.correct).length : 0;
                const isMe = pid === myId;
                return (
                  <div key={pid} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: isMe ? 'var(--amber)' : 'var(--ink-dim)', flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 13, color: isMe ? 'var(--amber)' : 'var(--ink)' }}>
                      {nameMap[pid] ?? (isMe ? '나' : pid.slice(0, 6))}
                      {isMe && <span style={{ fontSize: 10, color: 'var(--ink-dim)', marginLeft: 6 }}>(나)</span>}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>{c}/{total}</span>
                    <div style={{ width: 80, height: 4, background: 'var(--surface3)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(c/total)*100}%`, background: c === total ? 'var(--green)' : 'var(--amber)', borderRadius: 2 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* 액션 버튼 */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-ghost" style={{ flex: 1 }} onClick={() => navigate('/')}>케이스 목록</button>
          {isSolo && (
            <button className="btn-primary" style={{ flex: 1 }} onClick={() => navigate(`/game/solo?caseId=${caseId}`)}>
              다시 수사
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function EffRow({ label, value, highlight, warn, amber }) {
  const color = warn ? 'var(--red)' : amber ? 'var(--amber)' : highlight ? 'var(--green)' : 'var(--ink)';
  return (
    <div style={{ flex: 1 }}>
      <div className="label" style={{ fontSize: 9, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}
