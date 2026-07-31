import { useState, useEffect, useRef, useCallback } from 'react';

export default function SharedNote({ value, onChange }) {
  const [local, setLocal] = useState(value ?? '');
  const timer = useRef(null);

  // 멀티 플레이: 외부(서버 sync)에서 value 바뀌면 반영
  useEffect(() => { setLocal(value ?? ''); }, [value]);

  const handleChange = useCallback((e) => {
    const text = e.target.value;
    setLocal(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange(text), 300);
  }, [onChange]);

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
