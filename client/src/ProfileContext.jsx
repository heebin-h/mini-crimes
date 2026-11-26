import { createContext, useContext, useState, useCallback } from 'react';
import { profileStore } from './profile/store';

// 기기별 로컬 프로필 (이전 AuthContext 대체 — 서버·비밀번호 없음)
const ProfileContext = createContext(null);

export function ProfileProvider({ children }) {
  const [profile, setProfile] = useState(() => profileStore.getCurrentProfile());
  const [profiles, setProfiles] = useState(() => profileStore.listProfiles());

  const refresh = useCallback(() => {
    setProfiles(profileStore.listProfiles());
    setProfile(profileStore.getCurrentProfile());
  }, []);

  const select = useCallback(id => { profileStore.setCurrentProfile(id); refresh(); }, [refresh]);

  const create = useCallback(name => {
    const res = profileStore.createProfile(name);
    if (res.ok) profileStore.setCurrentProfile(res.profile.id);
    refresh();
    return res;
  }, [refresh]);

  const remove = useCallback(id => { profileStore.deleteProfile(id); refresh(); }, [refresh]);
  const signOut = useCallback(() => { profileStore.clearCurrent(); refresh(); }, [refresh]);

  return (
    <ProfileContext.Provider value={{ profile, profiles, select, create, remove, signOut }}>
      {children}
    </ProfileContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useProfile = () => useContext(ProfileContext);
