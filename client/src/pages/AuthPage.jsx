import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

const ERR_MAP = {
  EMAIL_EXISTS: '이미 사용 중인 이메일입니다',
  INVALID_CREDENTIALS: '이메일 또는 비밀번호가 올바르지 않습니다',
  PASSWORD_TOO_SHORT: '비밀번호는 6자 이상이어야 합니다',
  MISSING_FIELDS: '모든 항목을 입력하세요',
};

export default function AuthPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password, name.trim());
      }
      navigate('/');
    } catch (err) {
      setError(ERR_MAP[err.message] ?? '오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      {/* 로고 */}
      <div style={{ marginBottom: 40, textAlign: 'center' }}>
        <div className="brand-logo" style={{ fontSize: 22, marginBottom: 8 }}>MINI CRIMES</div>
        <div className="label">Digital Investigation System</div>
      </div>

      <div style={{ width: 'min(380px, 100%)', background: 'var(--surface)', border: '1px solid var(--border-evidence)' }}>
        <div style={{ height: 2, background: 'var(--amber)' }} />

        {/* 탭 */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          {['login', 'register'].map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); }}
              style={{
                flex: 1, background: mode === m ? 'var(--surface2)' : 'transparent',
                color: mode === m ? 'var(--amber)' : 'var(--ink-muted)',
                border: 'none', borderBottom: mode === m ? '2px solid var(--amber)' : '2px solid transparent',
                borderRadius: 0, padding: '12px 0', fontSize: 12, letterSpacing: '.1em',
              }}
            >
              {m === 'login' ? 'LOGIN' : 'REGISTER'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px 24px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {mode === 'register' && (
            <div>
              <div className="label" style={{ marginBottom: 6 }}>수사관 이름</div>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="이름 (게임 내 표시)"
                maxLength={20}
                required
                autoFocus={mode === 'register'}
              />
            </div>
          )}

          <div>
            <div className="label" style={{ marginBottom: 6 }}>이메일</div>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="example@email.com"
              required
              autoFocus={mode === 'login'}
            />
          </div>

          <div>
            <div className="label" style={{ marginBottom: 6 }}>비밀번호{mode === 'register' && <span style={{ color: 'var(--ink-dim)', marginLeft: 6, textTransform: 'none', letterSpacing: 0 }}>(6자 이상)</span>}</div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div style={{ padding: '8px 12px', background: 'var(--surface2)', border: '1px solid var(--border-danger)', color: 'var(--red)', fontSize: 12 }}>
              ⚠ {error}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary"
            style={{ marginTop: 4 }}
            disabled={loading}
          >
            {loading ? 'PROCESSING...' : mode === 'login' ? '▶ 로그인' : '▶ 가입'}
          </button>
        </form>
      </div>
    </div>
  );
}
