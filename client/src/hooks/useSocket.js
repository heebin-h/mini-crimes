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
// 실패(timeout / ROOM_NOT_FOUND) 시 onError로 알려 호출부가 빈 화면에 멈추지 않게 한다.
export function useRoomSync(roomId, enabled, onRoom, onError) {
  useEffect(() => {
    if (!enabled || !roomId) return;
    let cancelled = false;
    socket.timeout(ROOM_GET_TIMEOUT_MS).emit('room:get', { roomId }, (err, res) => {
      if (cancelled) return;
      if (err) {
        console.warn('[room:get] timeout', err);
        return onError?.('TIMEOUT');
      }
      if (!res?.ok) {
        console.warn('[room:get] failed', res?.error);
        return onError?.(res?.error ?? 'UNKNOWN');
      }
      onRoom(res.room);
    });
    return () => { cancelled = true; };
  }, [roomId, enabled, onRoom, onError]);
}
