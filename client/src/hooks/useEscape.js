import { useEffect } from 'react';

// 모달이 열려 있는 동안 Escape 키로 닫는다 (active=false면 리스너를 달지 않음)
export default function useEscape(onClose, active = true) {
  useEffect(() => {
    if (!active) return undefined;
    const onKey = e => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, active]);
}
