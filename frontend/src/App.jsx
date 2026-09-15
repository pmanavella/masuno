import { useRef, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { NavBar } from './components/NavBar.jsx';
import { BottomNav } from './components/BottomNav.jsx';
import { WelcomeOverlay } from './components/WelcomeOverlay.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { RegisterPage } from './pages/RegisterPage.jsx';
import { ProfilePage } from './pages/ProfilePage.jsx';
import { FeedPage } from './pages/FeedPage.jsx';

export default function App() {
  const realRef = useRef(null);
  // ?skipwelcome en la URL evita la pantalla de bienvenida (útil mientras se trabaja sobre la Home).
  const [entered, setEntered] = useState(
    () => new URLSearchParams(window.location.search).has('skipwelcome')
  );

  return (
    <>
      <div ref={realRef} className="app-real">
        <div className="app-shell">
          <NavBar />
          <main className="app-main">
            <Routes>
              <Route path="/" element={<FeedPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/registro" element={<RegisterPage />} />
              <Route
                path="/perfil"
                element={
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </main>
          <BottomNav />
        </div>
      </div>
      {!entered && <WelcomeOverlay onEnter={() => setEntered(true)} revealTargetRef={realRef} />}
    </>
  );
}
