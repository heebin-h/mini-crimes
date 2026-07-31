import { useEffect } from 'react';
import { socket } from '../socket';

// 이벤트 구독 + 언마운트 시 자동 해제
export function useSocketEvent(event, handler) {
  useEffect(() => {
    socket.on(event, handler);
    return () => socket.off(event, handler);
  }, [event, handler]);
}
