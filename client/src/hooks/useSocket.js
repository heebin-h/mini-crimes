import { useEffect } from 'react';
import { socket } from '../socket';

// P2P 새로고침 복구(방장 재등록 최대 20초) 동안 첫 동기화가 기다릴 수 있도록 넉넉히
const ROOM_GET_TIMEOUT_MS = 25_000;

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
// P2P 재연결('connect') 때도 다시 동기화한다 — 끊긴 동안 놓친 이벤트 보정.
export function useRoomSync(roomId, enabled, onRoom, onError) {
  useEffect(() => {
    if (!enabled || !roomId) return;
    let cancelled = false;
    const sync = (isRetry) => {
      socket.timeout(ROOM_GET_TIMEOUT_MS).emit('room:get', { roomId }, (err, res) => {
        if (cancelled) return;
        if (err) {
          console.warn('[room:get] timeout', err);
          return isRetry ? undefined : onError?.('TIMEOUT'); // 재연결 후 재동기화 실패는 다음 'connect'에서 재시도
        }
        if (!res?.ok) {
          console.warn('[room:get] failed', res?.error);
          return onError?.(res?.error ?? 'UNKNOWN');
        }
        onRoom(res.room);
      });
    };
    sync(false);
    const onConnect = () => sync(true);
    socket.on('connect', onConnect);
    return () => { cancelled = true; socket.off('connect', onConnect); };
  }, [roomId, enabled, onRoom, onError]);
}
