import { useState } from 'react';

const CHOICE_LABELS = ['A', 'B', 'C', 'D'];

export default function AnswerModal({ questions = [], choices = {}, onSubmit, onClose, submittedPlayers = [], players = [] }) {
  const [answers, setAnswers] = useState(() =>
    Object.fromEntries(questions.map(q => [q.id, '']))
  );

  const allFilled = questions.every(q => answers[q.id]);

  function pick(qid, text) {
    setAnswers(prev => ({ ...prev, [qid]: text }));
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-evidence)',
          width: 'min(560px, 95vw)',
          maxHeight: '90vh',
          overflowY: 'auto',
          display: 'flex', flexDirection: 'column',
          position: 'relative',
        }}
      >
        <div style={{ height: 2, background: 'var(--amber)', flexShrink: 0 }} />

        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div className="label" style={{ marginBottom: 4 }}>[ INTERROGATION REPORT ]</div>
            <div style={{ fontSize: 11, color: 'var(--ink-muted)' }}>4개 선택지 중 하나를 선택하세요</div>
          </div>
          <span className="stamp stamp-amber">CONFIDENTIAL</span>
        </div>

        <div style={{ padding: '20px 20px 0', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {questions.map((q, i) => {
            const opts = choices[q.id] ?? [];
            const selected = answers[q.id];
            return (
              <div key={q.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 18, height: 18, border: '1px solid var(--amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--amber)', flexShrink: 0 }}>
                    {i + 1}
                  </div>
                  <span className="label" style={{ fontSize: 11 }}>{q.label}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {opts.map((opt, idx) => {
                    const isSelected = selected === opt.text;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => pick(q.id, opt.text)}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: 10,
                          padding: '10px 12px',
                          background: isSelected ? 'rgba(200,150,10,0.12)' : 'var(--surface2)',
                          border: `1px solid ${isSelected ? 'var(--amber)' : 'var(--border)'}`,
                          color: 'var(--ink)',
                          textAlign: 'left', cursor: 'pointer',
                          transition: 'border-color .1s, background .1s',
                          fontFamily: 'inherit', fontSize: 13,
                        }}
                      >
                        <span style={{
                          fontSize: 10, fontFamily: 'var(--mono)', letterSpacing: '.08em',
                          color: isSelected ? 'var(--amber)' : 'var(--ink-dim)',
                          marginTop: 1, flexShrink: 0, minWidth: 16,
                        }}>
                          {CHOICE_LABELS[idx]}.
                        </span>
                        <span>{opt.text}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {players.length > 1 && (
          <div style={{ margin: '16px 20px 0', padding: '10px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', flexShrink: 0 }}>
            <div className="label" style={{ marginBottom: 8 }}>제출 현황</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {players.map(p => {
                const submitted = submittedPlayers.includes(p.id);
                return (
                  <span key={p.id} style={{
                    fontSize: 11, padding: '2px 8px',
                    background: submitted ? 'var(--green)' : 'transparent',
                    color: submitted ? '#0a1a0a' : 'var(--ink-muted)',
                    border: `1px solid ${submitted ? 'var(--green)' : 'var(--border)'}`,
                    letterSpacing: '.04em',
                  }}>
                    {submitted ? '✓ ' : ''}{p.name}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ padding: 20, display: 'flex', gap: 10, flexShrink: 0 }}>
          <button className="btn-ghost" style={{ flex: 1 }} onClick={onClose}>취소</button>
          <button
            className="btn-primary"
            style={{ flex: 2 }}
            disabled={!allFilled}
            onClick={() => onSubmit(answers)}
          >
            {allFilled ? '▶ 최종 제출' : '모든 항목을 선택하세요'}
          </button>
        </div>
      </div>
    </div>
  );
}
