import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { socket } from '../socket';
import { ALL_CASES, getCase } from '../data/cases';
import { scoreAll, stampOf, loadCaseAnswer } from '../game/grading';
import { useProfile } from '../ProfileContext';
import { profileStore } from '../profile/store';
import { useSocketEvent, useRoomSync } from '../hooks/useSocket';
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

  const { profile } = useProfile();
  // 케이스 메타는 번들에 포함(정적 사이트). 멀티는 room.caseId로 resolve
  const caseData = isSolo ? getCase(caseId) : ALL_CASES;
  const loading = false;
  const [room, setRoom] = useState(null);
  const [note, setNote] = useState('');
  const noteRef = useRef('');
  const [focusedBy, setFocusedBy] = useState({});
  const [remotePointers, setRemotePointers] = useState([]);
  const [submittedPlayers, setSubmittedPlayers] = useState([]);
  const [showAnswer, setShowAnswer] = useState(false);
  const [toast, setToast] = useState('');
  // 단서 공개 + 경고 카드 상태
  const [revealedClues, setRevealedClues] = useState([]);
  const [warningUsed, setWarningUsed] = useState(false);
  const [myId, setMyId] = useState(socket.id ?? '');
  useEffect(() => {
    const onConnect = () => setMyId(socket.id);
    socket.on('connect', onConnect);
    return () => socket.off('connect', onConnect);
  }, []);

  // 멀티: 새로고침 시 P2P 세션 복구(방장 재호스팅 / 게스트 재접속). 방장 연결이 끝내 끊기면 홈으로
  useEffect(() => { if (!isSolo) socket.connect(roomId); }, [isSolo, roomId]);
  const onHostLost = useCallback(() => {
    navigate('/', { replace: true, state: { notice: '방장과의 연결이 끊겨 방이 종료되었습니다' } });
  }, [navigate]);
  useSocketEvent('host:lost', onHostLost);

  // 전적은 이 기기의 현재 프로필에 기록
  const recordHistory = useCallback((cid, title, mode, scores) => {
    if (!profile || !scores) return;
    const list = Object.values(scores);
    const correct = list.filter(s => s.correct).length;
    profileStore.addHistory(profile.id, {
      caseId: cid, caseTitle: title ?? cid, mode, correct, total: list.length,
      stamp: stampOf(correct, list.length), playedAt: new Date().toISOString(),
    });
  }, [profile]);

  // 멀티: room 상태로 케이스 결정 + revealedClues/warningUsed 동기화
  const onRoomState = useCallback((r) => {
    if (r?.roomId !== roomId) return; // 이전 방 push 무시
    setRoom(r);
    setRevealedClues(r.revealedClues ?? []);
    setWarningUsed(r.warningUsed ?? false);
  }, [roomId]);

  // 진입 시 pull 결과에만 sharedNote 반영. push(room:state)마다 덮으면 입력 중 글자가 이전 값으로 되돌아갈 수 있다.
  const onRoomSynced = useCallback((r) => {
    onRoomState(r);
    if (typeof r.sharedNote === 'string') {
      noteRef.current = r.sharedNote;
      setNote(r.sharedNote);
    }
  }, [onRoomState]);

  // 방 상태를 못 받으면 빈 게임 화면에 멈추지 않도록 홈으로 (새로고침 복귀는 P0-2)
  const onRoomSyncError = useCallback(() => navigate('/', { replace: true, state: { notice: '방 정보를 불러오지 못했습니다 (방이 종료됐거나 연결이 끊김)' } }), [navigate]);

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
    recordHistory(data.caseId, caseRef?.titleKo, 'multi', data.scores?.[socket.id]);
    navigate(`/result/${roomId}`, {
      state: {
        ...data,
        myId: socket.id, // 결과 화면 새로고침 시 socket.id가 사라져도 내 점수 표시
        revealedClues: revealedCluesRef.current,
        warningUsed: warningUsedRef.current,
        totalClues: caseRef?.clueCards?.length ?? 10,
        questions: caseRef?.questions ?? [],
      },
    });
  }, [navigate, roomId, recordHistory]);

  useSocketEvent('room:state', onRoomState);
  useSocketEvent('note:synced', onNoteSynced);
  useSocketEvent('clue:focused', onClueFocused);
  useSocketEvent('clue:revealed', onClueRevealed);
  useSocketEvent('warning:used', onWarningUsed);
  useSocketEvent('pointer:moved', onPointerMoved);
  useSocketEvent('pointer:cleared', onPointerCleared);
  useSocketEvent('answer:submitted', onAnswerSubmitted);
  useSocketEvent('game:revealed', onGameRevealed);
  useRoomSync(roomId, !isSolo, onRoomSynced, onRoomSyncError);

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
    const name = room?.players.find(p => p.id === playerId)?.name ?? '수사관';
    showToast(`${name} 연결 끊김 — 20초 안에 돌아오면 복귀`);
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

  // 포인터는 50ms 쓰로틀 — mousemove마다 보내면 방장 쪽 빈도 제한·대역폭 낭비
  const lastPointerAt = useRef(0);
  function handlePointerMove({ x, y }) {
    if (isSolo) return;
    const t = performance.now();
    if (t - lastPointerAt.current < 50) return;
    lastPointerAt.current = t;
    socket.emit('pointer:move', { x, y });
  }

  function handlePointerLeave() {
    if (!isSolo) socket.emit('pointer:leave');
  }

  async function submitAnswers(answers) {
    setShowAnswer(false);
    if (isSolo) {
      let caseAnswer = null;
      try { caseAnswer = await loadCaseAnswer(caseId); } catch (e) { console.error('[grading] answer load failed', e); }
      if (!caseAnswer) { showToast('채점 데이터를 불러오지 못했습니다'); return; }
      const scores = scoreAll(answers, caseAnswer);
      recordHistory(caseId, activeCaseData?.titleKo, 'solo', scores);
      navigate(`/result/solo`, {
        state: { playerAnswers: { solo: answers }, caseAnswer, scores: { solo: scores }, caseId, revealedClues, warningUsed, totalClues, questions: activeCaseData?.questions ?? [] },
      });
    } else {
      socket.emit('answer:submit', { answers }, (res) => {
        // 서버는 진행 중(playing)일 때만 제출을 받는다 — 거부 시 무반응으로 보이지 않게 안내
        if (!res?.ok) showToast(res?.error === 'NOT_PLAYING' ? '진행 중인 게임이 아닙니다' : '제출에 실패했습니다');
      });
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
    <div className="mc-game" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 헤더 */}
      <div className="mc-game-header" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
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
      <div className="mc-game-main" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* 범죄 현장 뷰어 */}
        <div className="mc-game-scene" style={{ flex: 1, minWidth: 0 }}>
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
        <div className="mc-game-panel" style={{ width: 290, flexShrink: 0, borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--surface)', overflow: 'hidden' }}>
          {/* 단서 카드 */}
          <div className="mc-game-clues" style={{ flex: 1, padding: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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
