import { useEffect, useState } from 'react';

export default function CaseBriefModal({ caseData, mode, onStart, onClose }) {
  const [typed, setTyped] = useState('');
  const synopsis = caseData?.synopsis ?? '';

  // 시놉시스 타이핑 효과
  useEffect(() => {
    setTyped('');
    if (!synopsis) return;
    let i = 0;
    const id = setInterval(() => {
      setTyped(synopsis.slice(0, i + 1));
      i++;
      if (i >= synopsis.length) clearInterval(id);
    }, 18);
    return () => clearInterval(id);
  }, [synopsis]);

  if (!caseData) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ width: 'min(640px, 95vw)', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div className="case-id" style={{ marginBottom: 6 }}>
              {caseData.season ? `SEASON ${caseData.season} · CASE ${String(caseData.episode).padStart(2,'0')}` : 'SPECIAL CASE'}
            </div>
            <h2 style={{ fontSize: 18, color: '#fff', letterSpacing: '.06em' }}>
              {caseData.title}
            </h2>
            <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 2 }}>{caseData.titleKo}</div>
          </div>
          <span className="stamp stamp-red" style={{ marginTop: 4 }}>UNSOLVED</span>
        </div>

        <div className="divider" style={{ marginBottom: 20 }} />

        {/* 시놉시스 */}
        <div style={{ marginBottom: 20 }}>
          <div className="label" style={{ marginBottom: 10 }}>[ 사건 개요 ]</div>
          <p style={{
            color: 'var(--ink)',
            lineHeight: 1.9,
            fontSize: 13,
            whiteSpace: 'pre-wrap',
            minHeight: 80,
          }}>
            {typed}
            <span style={{ animation: 'blink 1s step-end infinite', color: 'var(--amber)' }}>
              {typed.length < synopsis.length ? '█' : ''}
            </span>
          </p>
        </div>

        <div className="divider" style={{ marginBottom: 20 }} />

        {/* 구성물 */}
        <div style={{ marginBottom: 24 }}>
          <div className="label" style={{ marginBottom: 12 }}>[ 케이스 구성 ]</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <ComponentRow icon="🔍" label="범죄 현장 카드" count="×1" color="var(--amber)" />
            <ComponentRow icon="📄" label="단서 카드" count={`×${caseData.clueCards?.length ?? 10}`} color="var(--ink)" />
            <ComponentRow icon="⚠️" label="경고 카드" count="×1" color="var(--red)"
              note="조사가 막힐 때 사용. 효율성 점수 감점." />
          </div>
        </div>

        {/* 질문 항목 */}
        <div style={{ marginBottom: 28 }}>
          <div className="label" style={{ marginBottom: 12 }}>[ 해결해야 할 질문 ]</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {caseData.questions?.map((q, i) => (
              <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--amber)', fontSize: 11, minWidth: 20 }}>0{i+1}</span>
                <span style={{ color: 'var(--ink)' }}>{q.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 버튼 */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-ghost" style={{ flex: 1 }} onClick={onClose}>← 취소</button>
          {mode === 'solo' ? (
            <button className="btn-primary" style={{ flex: 2 }} onClick={() => onStart('solo')}>
              단독 수사 시작
            </button>
          ) : (
            <button className="btn-primary" style={{ flex: 2 }} onClick={() => onStart('multi')}>
              방 생성 → 수사 시작
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
      `}</style>
    </div>
  );
}

function ComponentRow({ icon, label, count, color, note }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '6px 10px', background: 'var(--surface2)', border: '1px solid var(--border)' }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <span style={{ color }}>{label}</span>
        {note && <div style={{ fontSize: 11, color: 'var(--ink-muted)', marginTop: 2 }}>{note}</div>}
      </div>
      <span style={{ color: 'var(--ink-muted)', fontSize: 12 }}>{count}</span>
    </div>
  );
}
