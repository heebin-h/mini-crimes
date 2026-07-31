import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { socket } from '../socket';
import { api } from '../api';
import { useSocketEvent } from '../hooks/useSocket';
import SceneViewer from '../components/game/SceneViewer';
import CluePanel from '../components/game/CluePanel';
import SharedNote from '../components/game/SharedNote';
import AnswerModal from '../components/game/AnswerModal';

export default function GamePage() {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isSolo = roomId === 'solo';
  const caseId = isSolo ? searchParams.get('caseId') : null;

  const [caseData, setCaseData] = useState(null);
  const [room, setRoom] = useState(null);
  const [note, setNote] = useState('');
  const noteRef = useRef('');
  const [focusedBy, setFocusedBy] = useState({});
  const [remotePointers, setRemotePointers] = useState([]);
  const [submittedPlayers, setSubmittedPlayers] = useState([]);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  // 단서 공개 + 경고 카드 상태
  const [revealedClues, setRevealedClues] = useState([]);
  const [warningUsed, setWarningUsed] = useState(false);
  const myId = socket.id;

  const allCasesRef = useRef([]);

  // 케이스 메타 로드
  useEffect(() => {
    fetch(api('/api/cases'))
      .then(r => r.json())
      .then(cases => {
        allCasesRef.current = cases;
        if (isSolo) setCaseData(cases.find(c => c.id === caseId) ?? null);
        else setCaseData(cases); // 배열로 저장; activeCaseData가 room.caseId로 resolve
      })
      .catch(() => setCaseData(null))
      .finally(() => setLoading(false));
  }, [isSolo, caseId]);

  // 멀티: room 상태로 케이스 결정 + revealedClues/warningUsed 동기화
  const onRoomState = useCallback((r) => {
    setRoom(r);
    setRevealedClues(r.revealedClues ?? []);
    setWarningUsed(r.warningUsed ?? false);
  }, []);

  const onNoteSynced = useCallback(({ text }) => {
    noteRef.current = text;
    setNote(text);
  }, []);

  const onClueFocused = useCallback(({ playerId, clueId }) => {
    const player = room?.players.find(p => p.id === playerId);
    setFocusedBy(prev => {
      const next = { ...prev };
      for (const [k, v] of Object.entries(next)) {
        if (v === (player?.name ?? playerId)) delete next[k];
      }
      if (clueId) next[clueId] = player?.name ?? playerId;
      return next;
    });
  }, [room]);

  // 서버로부터 단서 공개 확정 수신
  const onClueRevealed = useCallback(({ revealedClues: updated }) => {
    setRevealedClues(updated);
  }, []);

  // 경고 카드 사용 확정 수신
  const onWarningUsed = useCallback(() => {
    setWarningUsed(true);
  }, []);

  const onPointerMoved = useCallback(({ playerId, x, y }) => {
    const player = room?.players.find(p => p.id === playerId);
    setRemotePointers(prev => {
      const filtered = prev.filter(p => p.playerId !== playerId);
      return [...filtered, { playerId, name: player?.name ?? playerId, x, y }];
    });
  }, [room]);

  const onPointerCleared = useCallback(({ playerId }) => {
    setRemotePointers(prev => prev.filter(p => p.playerId !== playerId));
  }, []);

  const onAnswerSubmitted = useCallback(({ playerId }) => {
    setSubmittedPlayers(prev => [...new Set([...prev, playerId])]);
  }, []);

  const onGameRevealed = useCallback((data) => {
    const caseRef = activeCaseDataRef.current;
    navigate(`/result/${roomId}`, {
      state: {
        ...data,
        revealedClues: revealedCluesRef.current,
        warningUsed: warningUsedRef.current,
        totalClues: caseRef?.clueCards?.length ?? 10,
        questions: caseRef?.questions ?? [],
      },
    });
  }, [navigate, roomId]);

  useSocketEvent('room:state', onRoomState);
  useSocketEvent('note:synced', onNoteSynced);
  useSocketEvent('clue:focused', onClueFocused);
  useSocketEvent('clue:revealed', onClueRevealed);
  useSocketEvent('warning:used', onWarningUsed);
  useSocketEvent('pointer:moved', onPointerMoved);
  useSocketEvent('pointer:cleared', onPointerCleared);
  useSocketEvent('answer:submitted', onAnswerSubmitted);
  useSocketEvent('game:revealed', onGameRevealed);

  // activeCaseData ref (onGameRevealed 클로저에서 최신값 참조)
  // 멀티: caseData가 배열이면 room.caseId로 resolve — 두 상태 중 어느 쪽이 먼저 와도 대응
  const activeCaseData = isSolo
    ? caseData
    : (Array.isArray(caseData) ? (caseData.find(c => c.id === room?.caseId) ?? null) : caseData);
  const totalClues = activeCaseData?.clueCards?.length ?? 10;
  const activeCaseDataRef = useRef(activeCaseData);
  useEffect(() => { activeCaseDataRef.current = activeCaseData; }, [activeCaseData]);
  const revealedCluesRef = useRef(revealedClues);
  useEffect(() => { revealedCluesRef.current = revealedClues; }, [revealedClues]);
  const warningUsedRef = useRef(warningUsed);
  useEffect(() => { warningUsedRef.current = warningUsed; }, [warningUsed]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  const onPlayerLeft = useCallback(({ playerId }) => {
    if (room?.hostId === playerId) showToast('방장이 변경되었습니다');
  }, [room]);

  useSocketEvent('player:left', onPlayerLeft);

  function handleNoteChange(text) {
    noteRef.current = text;
    setNote(text);
    if (!isSolo) socket.emit('note:update', { text });
    else localStorage.setItem(`note:${caseId}`, text);
  }

  function handleRevealClue(clueId) {
    if (isSolo) {
      setRevealedClues(prev => prev.includes(clueId) ? prev : [...prev, clueId]);
    } else {
      socket.emit('clue:reveal', { clueId });
    }
  }

  function handleClueFocus(clueId) {
    if (!isSolo) socket.emit('clue:focus', { clueId });
  }

  function handleWarning() {
    if (isSolo) {
      setWarningUsed(true);
    } else {
      socket.emit('warning:use');
    }
  }

  function handlePointerMove({ x, y }) {
    if (!isSolo) socket.emit('pointer:move', { x, y });
  }

  function handlePointerLeave() {
    if (!isSolo) socket.emit('pointer:leave');
  }

  async function submitAnswers(answers) {
    setShowAnswer(false);
    if (isSolo) {
      const token = localStorage.getItem('mc_token');
      const res = await fetch(api('/api/score'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ caseId, answers }),
      });
      if (!res.ok) { setToast('채점 오류가 발생했습니다'); return; }
      const { caseAnswer, scores } = await res.json();
      navigate(`/result/solo`, {
        state: { playerAnswers: { solo: answers }, caseAnswer, scores: { solo: scores }, caseId, revealedClues, warningUsed, totalClues, questions: activeCaseData?.questions ?? [] },
      });
    } else {
      socket.emit('answer:submit', { answers }, () => {});
    }
  }

  // 솔로 노트 로드
  useEffect(() => {
    if (isSolo && caseId) {
      const saved = localStorage.getItem(`note:${caseId}`) || '';
      setNote(saved);
      noteRef.current = saved;
    }
  }, [isSolo, caseId]);

  const players = room?.players ?? [];
  const isHost = room?.hostId === myId;

  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-muted)', fontFamily: 'var(--mono)', letterSpacing: '.1em' }}>
      LOADING...
    </div>
  );

  if (isSolo && !activeCaseData) return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div className="label" style={{ color: 'var(--red)' }}>케이스를 찾을 수 없습니다</div>
      <button className="btn-ghost" onClick={() => navigate('/')}>목록으로</button>
    </div>
  );

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 헤더 */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <span className="brand-logo">MINI CRIMES</span>
        {activeCaseData && (
          <>
            <span style={{ color: 'var(--border)' }}>|</span>
            <span className="case-id">{activeCaseData.id?.toUpperCase()}</span>
            <span style={{ color: 'var(--ink-muted)', fontSize: 12 }}>{activeCaseData.title}</span>
          </>
        )}
        <div style={{ flex: 1 }} />

        {/* 단서 공개 현황 */}
        <div style={{ fontSize: 11, color: 'var(--ink-muted)', letterSpacing: '.04em' }}>
          EVIDENCE {revealedClues.length}/{totalClues}
        </div>

        {!isSolo && isHost && (
          <button className="btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => socket.emit('game:reveal')}>
            정답 공개
          </button>
        )}
        <button className="btn-primary" style={{ fontSize: 13 }} onClick={() => setShowAnswer(true)}>
          ▶ 최종 제출
        </button>
      </div>

      {/* 메인 레이아웃 */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* 범죄 현장 뷰어 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <SceneViewer
            imageUrl={activeCaseData?.sceneImage}
            caseId={activeCaseData?.id}
            caseTitle={activeCaseData?.titleKo}
            remotePointers={remotePointers}
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
          />
        </div>

        {/* 우측 패널 */}
        <div style={{ width: 290, flexShrink: 0, borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--surface)', overflow: 'hidden' }}>
          {/* 단서 카드 */}
          <div style={{ flex: 1, padding: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <CluePanel
              clueCards={activeCaseData?.clueCards ?? []}
              warningCard={activeCaseData?.warningCard ?? null}
              revealedClues={revealedClues}
              warningUsed={warningUsed}
              focusedBy={focusedBy}
              onReveal={handleRevealClue}
              onFocus={handleClueFocus}
              onWarning={handleWarning}
            />
          </div>

          {/* 구분선 */}
          <div style={{ height: 1, background: 'var(--border)', flexShrink: 0 }} />

          {/* 공유 노트 */}
          <div style={{ height: 180, padding: 14, flexShrink: 0 }}>
            <SharedNote value={note} onChange={handleNoteChange} />
          </div>

          {/* 플레이어 바 */}
          {players.length > 0 && (
            <>
              <div style={{ height: 1, background: 'var(--border)', flexShrink: 0 }} />
              <div style={{ padding: '10px 14px', display: 'flex', flexWrap: 'wrap', gap: 6, flexShrink: 0 }}>
                {players.filter(p => p.connected).map(p => (
                  <span key={p.id} style={{
                    fontSize: 10, padding: '2px 8px',
                    background: submittedPlayers.includes(p.id) ? 'var(--green)' : 'transparent',
                    color: submittedPlayers.includes(p.id) ? '#0a1a0a' : 'var(--ink-muted)',
                    border: `1px solid ${p.id === myId ? 'var(--amber)' : submittedPlayers.includes(p.id) ? 'var(--green)' : 'var(--border)'}`,
                    letterSpacing: '.04em',
                  }}>
                    {submittedPlayers.includes(p.id) ? '✓ ' : ''}{p.name}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'var(--surface2)', border: '1px solid var(--amber)', color: 'var(--amber)', padding: '8px 20px', fontFamily: 'var(--mono)', fontSize: 12, letterSpacing: '.06em', zIndex: 300 }}>
          {toast}
        </div>
      )}

      {showAnswer && (
        <AnswerModal
          questions={activeCaseData?.questions ?? []}
          choices={activeCaseData?.choices ?? {}}
          players={players}
          submittedPlayers={submittedPlayers}
          onSubmit={submitAnswers}
          onClose={() => setShowAnswer(false)}
        />
      )}
    </div>
  );
}
