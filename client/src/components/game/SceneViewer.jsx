import { useRef } from 'react';
import { useZoom } from '../../hooks/useZoom';

export default function SceneViewer({ imageUrl, caseId, caseTitle, remotePointers = [], onPointerMove, onPointerLeave }) {
  const containerRef = useRef(null);
  const { transform, handlers, zoom, reset } = useZoom();

  function handleMouseMove(e) {
    if (!onPointerMove || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    onPointerMove({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    });
  }

  const imgStyle = {
    position: 'absolute',
    top: 0, left: 0,
    width: '100%', height: '100%',
    objectFit: 'contain',
    transformOrigin: '0 0',
    transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
    userSelect: 'none',
    cursor: transform.scale > 1 ? 'grab' : 'default',
    touchAction: 'none',
    draggable: false,
  };

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#040404', cursor: 'crosshair', touchAction: 'none' }}
      {...handlers}
      onMouseMove={handleMouseMove}
      onMouseLeave={onPointerLeave}
    >
      {imageUrl ? (
        <img src={imageUrl} alt="범죄 현장" style={imgStyle} />
      ) : (
        <NoSceneImage />
      )}

      {/* 타인 포인터 오버레이 */}
      {remotePointers.map(p => (
        <div key={p.playerId} style={{
          position: 'absolute',
          left: `${p.x * 100}%`,
          top: `${p.y * 100}%`,
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          zIndex: 10,
        }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--amber)', boxShadow: '0 0 6px var(--amber)', opacity: .9 }} />
          <div style={{
            position: 'absolute', top: 13, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,.85)', color: 'var(--amber)',
            fontSize: 9, padding: '1px 5px',
            letterSpacing: '.06em', whiteSpace: 'nowrap',
            border: '1px solid var(--amber-dim)',
          }}>
            {p.name}
          </div>
        </div>
      ))}

      {/* 줌 컨트롤 — 우하단 */}
      <div style={{
        position: 'absolute', bottom: 12, right: 12,
        display: 'flex', flexDirection: 'column', gap: 4, zIndex: 10,
      }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <ZoomBtn onClick={() => zoom(1.15)} label="+" title="확대" />
          <ZoomBtn onClick={() => zoom(0.87)} label="−" title="축소" />
          <ZoomBtn onClick={reset} label="⊙" title="초기화" />
        </div>
        <div style={{ textAlign: 'right', fontSize: 9, color: 'rgba(255,255,255,.25)', letterSpacing: '.06em' }}>
          {Math.round(transform.scale * 100)}%
        </div>
      </div>

      {/* 케이스 정보 overlay — 좌상단 */}
      {(caseId || caseTitle) && (
        <div style={{
          position: 'absolute', top: 12, left: 12,
          pointerEvents: 'none', zIndex: 10,
          display: 'flex', flexDirection: 'column', gap: 3,
        }}>
          {caseId && (
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.14em', color: 'var(--amber)', background: 'rgba(0,0,0,.75)', padding: '2px 7px', textTransform: 'uppercase' }}>
              {caseId.toUpperCase()}
            </div>
          )}
          {caseTitle && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.7)', background: 'rgba(0,0,0,.65)', padding: '2px 7px', letterSpacing: '.03em' }}>
              {caseTitle}
            </div>
          )}
        </div>
      )}

      {/* 좌하단 힌트 */}
      <div style={{
        position: 'absolute', bottom: 12, left: 12,
        fontSize: 9, color: 'rgba(255,255,255,.2)',
        letterSpacing: '.08em', textTransform: 'uppercase',
        pointerEvents: 'none',
      }}>
        SCROLL TO ZOOM · DRAG TO PAN · DBL-CLICK RESET
      </div>
    </div>
  );
}

function ZoomBtn({ onClick, label, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 28, height: 28,
        background: 'rgba(0,0,0,.7)',
        border: '1px solid var(--border)',
        color: 'var(--ink-muted)',
        fontSize: 13, lineHeight: 1,
        padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        letterSpacing: 0,
      }}
    >
      {label}
    </button>
  );
}

function NoSceneImage() {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 16,
      backgroundImage: `
        linear-gradient(rgba(200,150,10,.04) 1px, transparent 1px),
        linear-gradient(90deg, rgba(200,150,10,.04) 1px, transparent 1px)
      `,
      backgroundSize: '40px 40px',
    }}>
      {/* 황색 테이프 라인 효과 */}
      <div style={{
        position: 'absolute', top: '30%', left: 0, right: 0,
        height: 28, background: 'repeating-linear-gradient(135deg, #c8960a22 0px, #c8960a22 14px, transparent 14px, transparent 28px)',
        borderTop: '1px solid var(--amber-dim)', borderBottom: '1px solid var(--amber-dim)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        letterSpacing: '.3em', fontSize: 10, color: 'var(--amber-dim)', fontWeight: 700,
      }}>
        CRIME SCENE — DO NOT CROSS — CRIME SCENE — DO NOT CROSS — CRIME SCENE
      </div>

      <div style={{ textAlign: 'center', zIndex: 1 }}>
        <div style={{
          fontSize: 11, letterSpacing: '.2em', color: 'var(--ink-dim)',
          textTransform: 'uppercase', marginBottom: 8,
        }}>
          CRIME SCENE PHOTO
        </div>
        <div style={{
          width: 80, height: 1, background: 'var(--border)', margin: '0 auto 8px',
        }} />
        <div style={{ fontSize: 10, color: 'var(--ink-dim)', letterSpacing: '.1em' }}>
          NO IMAGE LOADED
        </div>
      </div>
    </div>
  );
}
