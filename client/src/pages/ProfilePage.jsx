import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '../ProfileContext';
import { NAME_MAX } from '../profile/store';

const ERR_MAP = {
  NAME_REQUIRED: '이름을 입력하세요',
  NAME_EXISTS: '이미 있는 프로필 이름입니다',
  STORAGE_FAILED: '브라우저 저장소를 사용할 수 없습니다 (시크릿 모드·저장소 차단 확인)',
};

// 기기별 로컬 프로필 선택·생성·삭제 (비밀번호 없음, 이 브라우저에만 저장)
export default function ProfilePage() {
  const { profiles, select, create, remove } = useProfile();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [confirmId, setConfirmId] = useState(null);

  function handleCreate(e) {
    e.preventDefault();
    const res = create(name);
    if (!res.ok) return setError(ERR_MAP[res.error] ?? '오류가 발생했습니다');
    navigate('/');
  }

  function handleSelect(id) {
    select(id);
    navigate('/');
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ marginBottom: 40, textAlign: 'center' }}>
        <div className="brand-logo" style={{ fontSize: 22, marginBottom: 8 }}>MINI CRIMES</div>
        <div className="label">Digital Investigation System</div>
      </div>

      <div style={{ width: 'min(380px, 100%)', background: 'var(--surface)', border: '1px solid var(--border-evidence)' }}>
        <div style={{ height: 2, background: 'var(--amber)' }} />

        {profiles.length > 0 && (
          <div style={{ padding: '20px 24px 4px' }}>
            <div className="label" style={{ marginBottom: 10 }}>[ 수사관 선택 ]</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {profiles.map(p => (
                <div key={p.id} style={{ display: 'flex', gap: 6 }}>
                  <button className="btn-ghost" style={{ flex: 1, textAlign: 'left', padding: '10px 12px' }} onClick={() => handleSelect(p.id)}>
                    ▶ {p.name}
                  </button>
                  {confirmId === p.id ? (
                    <button className="btn-ghost" style={{ padding: '0 10px', fontSize: 11, color: 'var(--red)', borderColor: 'var(--border-danger)' }}
                      onClick={() => { remove(p.id); setConfirmId(null); }}>
                      삭제 확인
                    </button>
                  ) : (
                    <button className="btn-ghost" aria-label={`${p.name} 프로필 삭제`} style={{ padding: '0 10px', fontSize: 11 }} onClick={() => setConfirmId(p.id)}>
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleCreate} style={{ padding: '20px 24px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="label">[ 새 수사관 ]</div>
          <input
            value={name}
            onChange={e => { setName(e.target.value); setError(''); }}
            placeholder="이름 (게임 내 표시)"
            maxLength={NAME_MAX}
            autoFocus={profiles.length === 0}
            aria-label="새 프로필 이름"
          />
          {error && (
            <div role="alert" style={{ padding: '8px 12px', background: 'var(--surface2)', border: '1px solid var(--border-danger)', color: 'var(--red)', fontSize: 12 }}>
              ⚠ {error}
            </div>
          )}
          <button type="submit" className="btn-primary">▶ 만들고 시작</button>
          <div style={{ fontSize: 11, color: 'var(--ink-muted)', lineHeight: 1.6 }}>
            프로필과 전적은 이 브라우저에만 저장됩니다. 다른 기기·브라우저와 공유되지 않으며, 사이트 데이터를 지우면 함께 삭제됩니다.
          </div>
        </form>
      </div>
    </div>
  );
}
