import { useEffect } from 'react';
import { socket } from '../socket';

const ROOM_GET_TIMEOUT_MS = 5000;

// 이벤트 구독 + 언마운트 시 자동 해제
export function useSocketEvent(event, handler) {
  useEffect(() => {
    socket.on(event, handler);
    return () => socket.off(event, handler);
  }, [event, handler]);
}

// 마운트 시 현재 방 상태를 서버에 요청(pull).
// room:state push는 navigate 직후 구독 전에 도착하면 유실되므로 페이지 진입 시 반드시 한 번 동기화한다.
export function useRoomSync(enabled, onRoom) {
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    socket.timeout(ROOM_GET_TIMEOUT_MS).emit('room:get', (err, res) => {
      if (cancelled) return;
      if (err) return console.warn('[room:get] timeout', err);
      if (!res?.ok) return console.warn('[room:get] failed', res?.error);
      onRoom(res.room);
    });
    return () => { cancelled = true; };
  }, [enabled, onRoom]);
}
