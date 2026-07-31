import { useState } from 'react';

// revealedClues: string[]  — 공개된 clueId 목록
// focusedBy: { clueId -> playerName }
// warningUsed: boolean
export default function CluePanel({ clueCards = [], warningCard, revealedClues = [], focusedBy = {}, warningUsed, onReveal, onFocus, onWarning }) {
  const [modal, setModal] = useState(null); // { card, isWarning }

  function openCard(card, isWarning = false) {
    if (isWarning) {
      setModal({ card, isWarning: true });
      return;
    }
    const isRevealed = revealedClues.includes(card.id);
    if (!isRevealed) onReveal?.(card.id);   // 최초 공개
    onFocus?.(card.id);
    setModal({ card, isWarning: false });
  }

  function closeModal() {
    setModal(null);
    onFocus?.(null);
  }

  const revealed = revealedClues.length;
  const total = clueCards.length;

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 10 }}>

        {/* 진행 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div className="label">[ 단서 카드 ]</div>
          <div style={{ fontSize: 11, color: revealed === total ? 'var(--amber)' : 'var(--ink-muted)' }}>
            {revealed}/{total} 공개
          </div>
        </div>

        {/* 진행 바 */}
        <div style={{ height: 2, background: 'var(--surface3)', borderRadius: 1, flexShrink: 0 }}>
          <div style={{ height: '100%', background: 'var(--amber)', borderRadius: 1, width: `${total ? (revealed/total)*100 : 0}%`, transition: 'width .3s' }} />
        </div>

        {/* 카드 그리드 */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, alignContent: 'start' }}>
          {clueCards.map((card, i) => {
            const isRevealed = revealedClues.includes(card.id);
            const viewer = focusedBy[card.id];
            return (
              <ClueCardTile
                key={card.id}
                card={card}
                index={i + 1}
                isRevealed={isRevealed}
                viewer={viewer}
                onClick={() => openCard(card)}
              />
            );
          })}
        </div>

        {/* 경고 카드 */}
        {warningCard && (
          <div style={{ flexShrink: 0 }}>
            <div className="divider" style={{ marginBottom: 10 }} />
            <div className="label" style={{ marginBottom: 8 }}>[ 경고 카드 ]</div>
            <button
              onClick={() => openCard(warningCard, true)}
              disabled={warningUsed}
              style={{
                width: '100%',
                background: warningUsed ? 'var(--surface2)' : 'transparent',
                border: `1px solid ${warningUsed ? 'var(--border)' : 'var(--border-danger)'}`,
                borderRadius: 2,
                padding: '10px 12px',
                color: warningUsed ? 'var(--ink-muted)' : 'var(--red)',
                display: 'flex', alignItems: 'center', gap: 10,
                cursor: warningUsed ? 'not-allowed' : 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 16 }}>{warningUsed ? '🔓' : '⚠️'}</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                  {warningUsed ? '경고 카드 사용됨' : '경고 카드 사용'}
                </div>
                <div style={{ fontSize: 10, color: 'var(--ink-muted)', marginTop: 2 }}>
                  {warningUsed ? '효율성 점수 감점 적용됨' : '막힐 때 사용 · 효율성 점수 감점'}
                </div>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* 카드 확대 모달 */}
      {modal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface)',
              border: `1px solid ${modal.isWarning ? 'var(--border-danger)' : 'var(--border-evidence)'}`,
              padding: 0,
              width: 'min(680px, 95vw)',
              maxHeight: '90vh',
              display: 'flex', flexDirection: 'column',
              position: 'relative',
            }}
          >
            {/* 모달 상단 바 */}
            <div style={{
              height: 2,
              background: modal.isWarning ? 'var(--red)' : 'var(--amber)',
            }} />
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div className="label" style={{ marginBottom: 2 }}>
                  {modal.isWarning ? '⚠ WARNING CARD' : `EVIDENCE #${String(clueCards.findIndex(c => c.id === modal.card.id) + 1).padStart(2,'0')}`}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: modal.isWarning ? 'var(--red)' : 'var(--amber)' }}>
                  {modal.card.label}
                </div>
              </div>
              <button
                className="btn-ghost"
                style={{ padding: '4px 12px', fontSize: 11 }}
                onClick={closeModal}
              >
                CLOSE ✕
              </button>
            </div>

            {/* 이미지 */}
            <div style={{ overflow: 'auto', background: '#050505', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 160 }}>
              {modal.card.image ? (
                <img
                  src={modal.card.image}
                  alt={modal.card.label}
                  style={{ maxWidth: '100%', maxHeight: '55vh', objectFit: 'contain' }}
                />
              ) : (
                <NoImage isWarning={modal.isWarning} />
              )}
            </div>

            {/* description / hint 텍스트 */}
            {(modal.card.description || modal.card.hint) && (
              <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border)', background: 'var(--surface2)', fontSize: 14, lineHeight: 1.75, color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>
                {modal.isWarning && modal.card.hint
                  ? <><span style={{ color: 'var(--red)', fontWeight: 700, letterSpacing: '.06em', fontSize: 11 }}>HINT &mdash; </span>{modal.card.hint}</>
                  : modal.card.description
                }
              </div>
            )}

            {/* 경고 카드 사용 버튼 */}
            {modal.isWarning && !warningUsed && (
              <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
                <button
                  className="btn-danger"
                  style={{ width: '100%' }}
                  onClick={() => { onWarning?.(); closeModal(); }}
                >
                  ⚠ 경고 카드 사용 (효율성 감점)
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ClueCardTile({ card, index, isRevealed, viewer, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: isRevealed ? 'var(--surface2)' : 'var(--surface)',
        border: `1px solid ${viewer ? 'var(--amber)' : isRevealed ? 'var(--border-evidence)' : 'var(--border)'}`,
        borderRadius: 2,
        padding: 0,
        aspectRatio: '4/3',
        overflow: 'hidden',
        cursor: 'pointer',
        position: 'relative',
        display: 'flex', flexDirection: 'column',
        transition: 'border-color .15s',
      }}
    >
      {isRevealed ? (
        <>
          {card.image ? (
            <img src={card.image} alt={card.label} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: .75 }} />
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-muted)', fontSize: 18 }}>📄</div>
          )}
          {/* 하단 그라디언트 + 라벨 */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,.92))', padding: '18px 6px 6px' }}>
            <div style={{ fontSize: 9, color: 'var(--amber)', letterSpacing: '.1em', textTransform: 'uppercase', fontFamily: 'var(--mono)', lineHeight: 1.3, padding: '0 2px' }}>
              {card.label}
            </div>
          </div>
        </>
      ) : (
        /* 미공개 — 봉인 상태 */
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'var(--surface)' }}>
          <div style={{ fontSize: 11, color: 'var(--amber)', letterSpacing: '.1em' }}>#{String(index).padStart(2,'0')}</div>
          <div style={{ width: 20, height: 1, background: 'var(--border)' }} />
          <div style={{ fontSize: 9, color: 'var(--ink-dim)', letterSpacing: '.12em', textTransform: 'uppercase' }}>SEALED</div>
        </div>
      )}

      {/* 타인 포커스 표시 */}
      {viewer && (
        <div style={{ position: 'absolute', top: 4, right: 4, background: 'var(--amber)', color: '#000', fontSize: 8, padding: '1px 4px', fontWeight: 700, letterSpacing: '.06em' }}>
          {viewer}
        </div>
      )}

      {/* 증거 번호 (공개 상태) */}
      {isRevealed && (
        <div style={{ position: 'absolute', top: 4, left: 4, background: 'rgba(0,0,0,.7)', color: 'var(--amber)', fontSize: 9, padding: '1px 5px', letterSpacing: '.06em' }}>
          #{String(index).padStart(2,'0')}
        </div>
      )}
    </button>
  );
}

function NoImage({ isWarning }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '28px 40px', textAlign: 'center' }}>
      <div style={{ fontSize: 32 }}>{isWarning ? '⚠️' : '📄'}</div>
      <div style={{ fontSize: 10, color: 'var(--ink-dim)', letterSpacing: '.08em' }}>NO IMAGE</div>
    </div>
  );
}
