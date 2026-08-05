import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../socket';
import CaseBriefModal from '../components/CaseBriefModal';
import { api } from '../api';
import { useAuth } from '../AuthContext';

const SEASONS = [1, 2, 'Special'];

export default function CaseSelectPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [cases, setCases] = useState([]);
  const [season, setSeason] = useState(1);
  const [playerName, setPlayerName] = useState(() => user?.name || localStorage.getItem('playerName') || '');
  const [brief, setBrief] = useState(null); // { caseData, mode }
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);
  const [recentHistory, setRecentHistory] = useState([]);

  useEffect(() => {
    fetch(api('/api/cases')).then(r => r.json()).then(setCases).catch(() => setCases([]));
  }, []);

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('mc_token');
    fetch(api('/api/history'), { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setRecentHistory(Array.isArray(d) ? d.slice(0, 5) : []))
      .catch(() => {});
  }, [user]);

  const filtered = cases.filter(c =>
    season === 'Special' ? c.season == null : c.season === season
  );

  function saveName(name) {
    setPlayerName(name);
    localStorage.setItem('playerName', name);
  }

  function handleStart(mode) {
    if (!brief) return;
    setBrief(null);
    if (mode === 'solo') {
      navigate(`/game/solo?caseId=${brief.caseData.id}`);
      return;
    }
    if (!playerName.trim()) { setError('이름을 입력하세요'); return; }
    socket.connect();
    socket.emit('room:create', { caseId: brief.caseData.id, playerName: playerName.trim() }, ({ roomId }) => {
      navigate(`/lobby/${roomId}`);
    });
  }

  function joinRoom() {
    if (!playerName.trim()) { setError('이름을 입력하세요'); return; }
    const code = joinCode.trim().toUpperCase();
    if (!code) { setError('방 코드를 입력하세요'); return; }
    setJoining(true);
    socket.connect();
    socket.emit('room:join', { roomId: code, playerName: playerName.trim() }, (res) => {
      setJoining(false);
      if (!res.ok) {
        setError({ ROOM_NOT_FOUND: '방을 찾을 수 없습니다', ROOM_FULL: '방이 꽉 찼습니다', GAME_ALREADY_STARTED: '이미 진행 중인 게임입니다' }[res.error] ?? res.error);
        return;
      }
      navigate(`/lobby/${code}`);
    });
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* 상단 헤더 */}
      <header style={{ borderBottom: '1px solid var(--border)', padding: '16px 32px', display: 'flex', alignItems: 'center', gap: 20, flexShrink: 0 }}>
        <div>
          <div className="brand-logo">MINI CRIMES</div>
          <div className="label" style={{ marginTop: 2 }}>Classified Case Files — Digital Investigation System</div>
        </div>
        <div style={{ flex: 1 }} />
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
              <span style={{ color: 'var(--amber)' }}>{user.name}</span>
            </span>
            <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }} onClick={logout}>
              LOGOUT
            </button>
          </div>
        )}
        <span className="stamp stamp-red">Restricted Access</span>
      </header>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* 사이드바 */}
        <aside style={{ width: 280, borderRight: '1px solid var(--border)', padding: 24, display: 'flex', flexDirection: 'column', gap: 24, overflowY: 'auto', flexShrink: 0 }}>
          {/* 수사관 정보 */}
          <section>
            <div className="label" style={{ marginBottom: 10 }}>[ 수사관 정보 ]</div>
            <input
              value={playerName}
              onChange={e => { saveName(e.target.value); setError(''); }}
              placeholder="이름을 입력하세요"
              maxLength={20}
            />
            {playerName && (
              <div style={{ marginTop: 8, padding: '8px 10px', background: 'var(--surface2)', border: '1px solid var(--border-evidence)', fontSize: 12 }}>
                <span className="label">수사관: </span>
                <span style={{ color: 'var(--amber)' }}>{playerName}</span>
              </div>
            )}
          </section>

          {/* 방 참가 */}
          <section>
            <div className="label" style={{ marginBottom: 10 }}>[ 기존 방 참가 ]</div>
            <input
              value={joinCode}
              onChange={e => { setJoinCode(e.target.value.toUpperCase()); setError(''); }}
              placeholder="방 코드 (예: XK83PQ)"
              maxLength={6}
              style={{ letterSpacing: '.1em' }}
              onKeyDown={e => e.key === 'Enter' && joinRoom()}
            />
            <button
              className="btn-ghost"
              style={{ width: '100%', marginTop: 8 }}
              onClick={joinRoom}
              disabled={joining}
            >
              {joining ? 'CONNECTING...' : '→ 참가'}
            </button>
          </section>

          {error && (
            <div style={{ padding: '8px 10px', background: 'var(--surface2)', border: '1px solid var(--border-danger)', color: 'var(--red)', fontSize: 12 }}>
              ⚠ {error}
            </div>
          )}

          {/* 최근 수사 기록 */}
          {recentHistory.length > 0 && (
            <section>
              <div className="label" style={{ marginBottom: 10 }}>[ 최근 수사 기록 ]</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {recentHistory.map(r => {
                  const color = r.stamp === 'SOLVED' ? 'var(--green)' : r.stamp === 'FAILED' ? 'var(--red)' : 'var(--amber)';
                  return (
                    <div key={r.id} style={{ padding: '7px 10px', background: 'var(--surface2)', border: '1px solid var(--border)', fontSize: 11 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ color: 'var(--ink)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>{r.caseTitle}</span>
                        <span style={{ color, fontWeight: 700, flexShrink: 0, marginLeft: 6 }}>{r.correct}/{r.total}</span>
                      </div>
                      <div style={{ color: 'var(--ink-dim)', fontSize: 10 }}>
                        {r.mode === 'solo' ? '단독' : '팀'} · {r.stamp}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* 통계 */}
          <section style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <div className="label" style={{ marginBottom: 8 }}>[ 케이스 현황 ]</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <StatRow label="전체 케이스" value={cases.length} />
              <StatRow label="시즌 1" value={cases.filter(c => c.season === 1).length} />
              <StatRow label="시즌 2" value={cases.filter(c => c.season === 2).length} />
              <StatRow label="스페셜" value={cases.filter(c => c.season == null).length} />
            </div>
          </section>
        </aside>

        {/* 케이스 목록 */}
        <main style={{ flex: 1, padding: 28, overflowY: 'auto' }}>
          {/* 시즌 탭 */}
          <div style={{ display: 'flex', gap: 1, marginBottom: 24, borderBottom: '1px solid var(--border)' }}>
            {SEASONS.map(s => {
              const active = season === s;
              return (
                <button
                  key={s}
                  onClick={() => setSeason(s)}
                  style={{
                    background: active ? 'var(--surface2)' : 'transparent',
                    color: active ? 'var(--amber)' : 'var(--ink-muted)',
                    border: 'none',
                    borderBottom: active ? '2px solid var(--amber)' : '2px solid transparent',
                    borderRadius: 0,
                    padding: '8px 20px',
                    fontSize: 12,
                    letterSpacing: '.1em',
                    textTransform: 'uppercase',
                    marginBottom: -1,
                  }}
                >
                  {s === 'Special' ? 'SPECIAL' : `SEASON ${s}`}
                  <span style={{ marginLeft: 8, color: 'var(--ink-dim)' }}>
                    ({cases.filter(c => s === 'Special' ? c.season == null : c.season === s).length})
                  </span>
                </button>
              );
            })}
          </div>

          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--ink-muted)' }}>
              {season === 2 ? (
                <>
                  <div className="label" style={{ fontSize: 13, marginBottom: 8, color: 'var(--amber)' }}>[ COMING SOON ]</div>
                  <div style={{ fontSize: 12 }}>시즌 2 케이스 준비 중</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>🗄</div>
                  <div>케이스 없음</div>
                </>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
              {filtered.map((c, idx) => (
                <CaseCard
                  key={c.id}
                  caseData={c}
                  index={idx + 1}
                  onSolo={() => setBrief({ caseData: c, mode: 'solo' })}
                  onMulti={() => setBrief({ caseData: c, mode: 'multi' })}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {brief && (
        <CaseBriefModal
          caseData={brief.caseData}
          mode={brief.mode}
          onStart={handleStart}
          onClose={() => setBrief(null)}
        />
      )}
    </div>
  );
}

function CaseCard({ caseData, index, onSolo, onMulti }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* 상단 컬러 바 */}
      <div style={{ height: 2, background: 'var(--border-evidence)' }} />

      {/* 씬 이미지 자리 */}
      <div style={{ height: 110, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
        {caseData.thumbnail ? (
          <img src={caseData.thumbnail} alt={caseData.title} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: .6 }} />
        ) : (
          <CasePlaceholder caseId={caseData.id} title={caseData.title} />
        )}
        <div style={{ position: 'absolute', top: 8, left: 8 }}>
          <span className="stamp stamp-red" style={{ fontSize: 9 }}>UNSOLVED</span>
        </div>
      </div>

      {/* 케이스 정보 */}
      <div style={{ padding: '12px 14px', flex: 1 }}>
        <div className="case-id" style={{ marginBottom: 4 }}>
          {caseData.season ? `S${caseData.season}E${String(caseData.episode).padStart(2,'0')}` : 'SP'}
          {' '}·{' '}
          <span style={{ color: 'var(--ink-muted)' }}>{caseData.clueCards?.length ?? 10} CLUES</span>
        </div>
        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', marginBottom: 2, lineHeight: 1.4 }}>
          {caseData.title}
        </div>
        <div style={{ fontSize: 11, color: 'var(--ink-muted)', marginBottom: 14 }}>{caseData.titleKo}</div>

        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn-ghost" style={{ flex: 1, padding: '6px 0', fontSize: 11 }} onClick={onSolo}>
            단독
          </button>
          <button className="btn-primary" style={{ flex: 1, padding: '6px 0', fontSize: 11 }} onClick={onMulti}>
            팀 수사
          </button>
        </div>
      </div>
    </div>
  );
}

const CASE_THEMES = {
  s1e01: { icon: '🍷', label: 'POISONING',  bg: '#1a0a0a' },
  s1e02: { icon: '⚓', label: 'DROWNING',   bg: '#060e1a' },
  s1e03: { icon: '🚢', label: 'SHIPWRECK',  bg: '#04121a' },
  s1e04: { icon: '🎨', label: 'GALLERY',    bg: '#100a1a' },
  s1e05: { icon: '🎮', label: 'E-SPORTS',   bg: '#0a1a08' },
  s1e06: { icon: '⚖️', label: 'JUDICIARY',  bg: '#1a1206' },
  s1e07: { icon: '🖌️', label: 'ATELIER',    bg: '#0f0a1a' },
  s1e08: { icon: '💉', label: 'MEDICAL',    bg: '#0a1a14' },
  s1e09: { icon: '🔥', label: 'ARSON',      bg: '#1a0e04' },
  s1e10: { icon: '🏛️', label: 'POLITICS',   bg: '#0a0a1a' },
  sp01:  { icon: '🎭', label: 'MASQUERADE', bg: '#1a0a14' },
  sp02:  { icon: '🚂', label: 'TRANSIT',    bg: '#0a0e1a' },
  sp03:  { icon: '🏝️', label: 'ISLAND',     bg: '#041410' },
};

function CasePlaceholder({ caseId }) {
  const { icon, label, bg } = CASE_THEMES[caseId] ?? { icon: '📂', label: 'CASE FILE', bg: '#111' };
  return (
    <div style={{ width: '100%', height: '100%', background: bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
      <div style={{ fontSize: 30, filter: 'grayscale(0.3)' }}>{icon}</div>
      <div style={{ fontSize: 9, letterSpacing: '.15em', color: 'var(--ink-dim)', fontFamily: 'var(--mono)' }}>{label}</div>
    </div>
  );
}

function StatRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0' }}>
      <span style={{ color: 'var(--ink-muted)' }}>{label}</span>
      <span style={{ color: 'var(--amber)', fontWeight: 700 }}>{value}</span>
    </div>
  );
}
