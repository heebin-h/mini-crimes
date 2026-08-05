import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { socket } from '../socket';
import { useSocketEvent } from '../hooks/useSocket';

export default function LobbyPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [room, setRoom] = useState(null);
  const [copied, setCopied] = useState(false);
  const [myId, setMyId] = useState(socket.id ?? '');

  useEffect(() => {
    if (!socket.connected) socket.connect();
    const onConnect = () => setMyId(socket.id);
    socket.on('connect', onConnect);
    return () => socket.off('connect', onConnect);
  }, []);

  // URL 직접 접근 등으로 room:state 미수신 시 홈으로
  useEffect(() => {
    const t = setTimeout(() => {
      if (!room) navigate('/');
    }, 8000);
    return () => clearTimeout(t);
  }, [room, navigate]);

  const onRoomState = useCallback(r => setRoom(r), []);
  const onGameStarted = useCallback(() => navigate(`/game/${roomId}`), [navigate, roomId]);

  useSocketEvent('room:state', onRoomState);
  useSocketEvent('game:started', onGameStarted);

  function copyCode() {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  const isHost = room?.hostId === myId;
  const connected = room?.players.filter(p => p.connected) ?? [];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 헤더 */}
      <header style={{ borderBottom: '1px solid var(--border)', padding: '14px 28px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div className="brand-logo">MINI CRIMES</div>
        <span style={{ color: 'var(--border)' }}>|</span>
        <div className="label">BRIEFING ROOM</div>
        <div style={{ flex: 1 }} />
        <span className="stamp stamp-amber">STANDBY</span>
      </header>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ width: 'min(560px, 100%)', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* 케이스 배지 */}
          {room?.caseId && (
            <div style={{ padding: '10px 16px', background: 'var(--surface)', border: '1px solid var(--border-evidence)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 18 }}>📂</span>
              <div>
                <div className="label" style={{ marginBottom: 2 }}>배정된 케이스</div>
                <div style={{ color: 'var(--amber)', fontWeight: 700, fontSize: 13, letterSpacing: '.04em' }}>{room.caseId.toUpperCase()}</div>
              </div>
            </div>
          )}

          {/* 방 코드 */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="label">[ 방 코드 — 팀원에게 공유 ]</div>
              <button className="btn-ghost" style={{ padding: '3px 10px', fontSize: 11 }} onClick={copyCode}>
                {copied ? '✓ COPIED' : 'COPY'}
              </button>
            </div>
            <div style={{ padding: '20px 16px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 'clamp(24px, 4vw, 40px)', fontWeight: 700, letterSpacing: '.25em', color: 'var(--amber)' }}>
                {roomId}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-muted)', marginTop: 8 }}>
                최대 8명 참가 가능
              </div>
            </div>
          </div>

          {/* 참가자 목록 */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
              <div className="label">[ 수사 팀 — {connected.length}/8 ]</div>
            </div>
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {room?.players.length ? room.players.map(p => (
                <PlayerRow
                  key={p.id}
                  player={p}
                  isMe={p.id === myId}
                  isHost={room.hostId === p.id}
                />
              )) : (
                <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--ink-muted)', fontSize: 12 }}>
                  연결 중...
                </div>
              )}
            </div>
          </div>

          {/* 시작 / 대기 */}
          {isHost ? (
            <div>
              <button
                className="btn-primary"
                style={{ width: '100%', padding: '13px 0', fontSize: 14, letterSpacing: '.1em' }}
                disabled={connected.length < 1}
                onClick={() => socket.emit('game:start')}
              >
                ▶ 수사 개시
              </button>
              {connected.length < 2 && (
                <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--ink-muted)', marginTop: 8 }}>
                  1명으로도 시작 가능합니다
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', textAlign: 'center' }}>
              <div style={{ color: 'var(--ink-muted)', fontSize: 12, letterSpacing: '.06em' }}>
                방장이 수사를 개시할 때까지 대기하세요
              </div>
              <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center', gap: 4 }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{
                    width: 6, height: 6, borderRadius: '50%', background: 'var(--amber)',
                    animation: `pulse 1.2s ${i * 0.4}s ease-in-out infinite`,
                  }} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

function PlayerRow({ player, isMe, isHost }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 10px',
      background: isMe ? 'var(--surface2)' : 'transparent',
      border: `1px solid ${isMe ? 'var(--border-evidence)' : 'transparent'}`,
      opacity: player.connected ? 1 : 0.35,
    }}>
      <div style={{
        width: 8, height: 8, borderRadius: '50%',
        background: player.connected ? 'var(--green)' : 'var(--ink-dim)',
        flexShrink: 0,
      }} />
      <div style={{ fontWeight: isMe ? 700 : 400, color: isMe ? 'var(--amber)' : 'var(--ink)', flex: 1, fontSize: 13 }}>
        {player.name}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {isHost && <span className="stamp stamp-amber" style={{ fontSize: 9, padding: '1px 5px' }}>HOST</span>}
        {isMe  && <span className="stamp stamp-muted"  style={{ fontSize: 9, padding: '1px 5px' }}>YOU</span>}
        {!player.connected && <span style={{ fontSize: 11, color: 'var(--ink-muted)' }}>OFFLINE</span>}
      </div>
    </div>
  );
}
