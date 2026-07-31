import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import AuthPage from './pages/AuthPage';
import CaseSelectPage from './pages/CaseSelectPage';
import LobbyPage from './pages/LobbyPage';
import GamePage from './pages/GamePage';
import ResultPage from './pages/ResultPage';

function RequireAuth({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

function GuestOnly({ children }) {
  const { user } = useAuth();
  return user ? <Navigate to="/" replace /> : children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<GuestOnly><AuthPage /></GuestOnly>} />
          <Route path="/" element={<RequireAuth><CaseSelectPage /></RequireAuth>} />
          <Route path="/lobby/:roomId" element={<RequireAuth><LobbyPage /></RequireAuth>} />
          <Route path="/game/:roomId" element={<RequireAuth><GamePage /></RequireAuth>} />
          <Route path="/result/:roomId" element={<RequireAuth><ResultPage /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
