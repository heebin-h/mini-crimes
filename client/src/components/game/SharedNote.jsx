import { useState, useEffect, useRef, useCallback } from 'react';

export default function SharedNote({ value, onChange }) {
  const [local, setLocal] = useState(value ?? '');
  const timer = useRef(null);

  // 멀티 플레이: 외부(서버 sync)에서 value 바뀌면 반영
  useEffect(() => { setLocal(value ?? ''); }, [value]);

  // 대기 중인 입력(디바운스 300ms 이내)을 이탈 시 잃지 않도록 최신 값·콜백을 ref로 들고 있다가 flush
  const pending = useRef(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  const flush = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (pending.current !== null) {
      const text = pending.current;
      pending.current = null;
      onChangeRef.current?.(text);
    }
  }, []);

  // 언마운트(제출·이동)와 pagehide(새로고침·탭 닫기) 모두에서 flush
  useEffect(() => {
    window.addEventListener('pagehide', flush);
    return () => { window.removeEventListener('pagehide', flush); flush(); };
  }, [flush]);

  const handleChange = useCallback((e) => {
    const text = e.target.value;
    setLocal(text);
    pending.current = text;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 300);
  }, [flush]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="label">[ 수사 노트 ]</div>
        <div style={{ fontSize: 9, color: 'var(--ink-dim)', letterSpacing: '.06em' }}>SHARED</div>
      </div>
      <textarea
        value={local}
        onChange={handleChange}
        placeholder="추리 내용을 여기에 기록하세요…"
        style={{
          flex: 1,
          resize: 'none',
          background: 'var(--surface2)',
          border: '1px solid var(--border)',
          borderRadius: 0,
          padding: '8px 10px',
          color: 'var(--ink)',
          fontSize: 13,
          lineHeight: 1.7,
          minHeight: 0,
        }}
      />
    </div>
  );
}
