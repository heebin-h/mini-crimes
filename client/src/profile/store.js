// 기기별 로컬 프로필 + 전적 (localStorage). 서버·비밀번호 없음 — 같은 브라우저 안에서만 유지된다.
// storage는 주입 가능(테스트용). 손상된 값은 덮어쓰기 전에 백업 키로 보존한다.

const KEYS = {
  profiles: 'mc:profiles',
  current: 'mc:currentProfile',
  history: id => `mc:history:${id}`,
};
export const NAME_MAX = 20;
export const HISTORY_MAX = 100;

export function createProfileStore(storage = globalThis.localStorage) {
  function read(key, fallback) {
    let raw;
    try { raw = storage.getItem(key); } catch { return fallback; } // 차단된 저장소(시크릿 모드 등)
    if (raw == null) return fallback;
    try {
      const v = JSON.parse(raw);
      if (Array.isArray(fallback) && !Array.isArray(v)) throw new Error('expected array');
      return v;
    } catch (e) {
      // 손상 값 보존 후 기본값 — 다음 쓰기가 원본을 지우지 않도록 백업
      try { storage.setItem(`${key}:corrupt-${Date.now()}`, raw); } catch { /* 용량 부족 등 */ }
      console.warn(`[profile] corrupt ${key}, backed up`, e.message);
      storage.removeItem?.(key);
      return fallback;
    }
  }
  function write(key, value) {
    try { storage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { console.warn(`[profile] write failed ${key}`, e.message); return false; }
  }

  const listProfiles = () => read(KEYS.profiles, []);

  function createProfile(name) {
    const clean = String(name ?? '').trim().slice(0, NAME_MAX);
    if (!clean) return { ok: false, error: 'NAME_REQUIRED' };
    const all = listProfiles();
    if (all.some(p => p.name === clean)) return { ok: false, error: 'NAME_EXISTS' };
    const profile = { id: globalThis.crypto?.randomUUID?.() ?? `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`, name: clean, createdAt: new Date().toISOString() };
    if (!write(KEYS.profiles, [...all, profile])) return { ok: false, error: 'STORAGE_FAILED' };
    return { ok: true, profile };
  }

  function deleteProfile(id) {
    write(KEYS.profiles, listProfiles().filter(p => p.id !== id));
    try { storage.removeItem(KEYS.history(id)); } catch { /* noop */ }
    if (getCurrentProfile()?.id === id) clearCurrent();
  }

  function getCurrentProfile() {
    let id;
    try { id = storage.getItem(KEYS.current); } catch { return null; }
    return listProfiles().find(p => p.id === id) ?? null;
  }
  function setCurrentProfile(id) {
    if (!listProfiles().some(p => p.id === id)) return false;
    try { storage.setItem(KEYS.current, id); return true; } catch { return false; }
  }
  function clearCurrent() { try { storage.removeItem(KEYS.current); } catch { /* noop */ } }

  const getHistory = id => read(KEYS.history(id), []);
  function addHistory(id, record) {
    if (!id) return false;
    const next = [{ id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, ...record }, ...getHistory(id)].slice(0, HISTORY_MAX);
    return write(KEYS.history(id), next);
  }

  return { listProfiles, createProfile, deleteProfile, getCurrentProfile, setCurrentProfile, clearCurrent, getHistory, addHistory };
}

export const profileStore = typeof globalThis.localStorage !== 'undefined' ? createProfileStore() : null;
