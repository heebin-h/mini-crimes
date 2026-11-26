import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProfileProvider, useProfile } from './ProfileContext';
import ProfilePage from './pages/ProfilePage';
import CaseSelectPage from './pages/CaseSelectPage';
import LobbyPage from './pages/LobbyPage';
import GamePage from './pages/GamePage';
import ResultPage from './pages/ResultPage';

function RequireProfile({ children }) {
  const { profile } = useProfile();
  return profile ? children : <Navigate to="/profile" replace />;
}

export default function App() {
  return (
    <ProfileProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/" element={<RequireProfile><CaseSelectPage /></RequireProfile>} />
          <Route path="/lobby/:roomId" element={<RequireProfile><LobbyPage /></RequireProfile>} />
          <Route path="/game/:roomId" element={<RequireProfile><GamePage /></RequireProfile>} />
          <Route path="/result/:roomId" element={<RequireProfile><ResultPage /></RequireProfile>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ProfileProvider>
  );
}
