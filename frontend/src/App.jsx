import { useRef, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { NavBar } from './components/NavBar.jsx';
import { BottomNav } from './components/BottomNav.jsx';
import { WelcomeOverlay } from './components/WelcomeOverlay.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import { VerificationGate, VERIFICATION_PATH } from './components/VerificationGate.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { RegisterPage } from './pages/RegisterPage.jsx';
import { ProfilePage } from './pages/ProfilePage.jsx';
import { FeedPage } from './pages/FeedPage.jsx';
import { VerificationPage } from './pages/VerificationPage.jsx';
import { EventDetailPage } from './pages/EventDetailPage.jsx';
import { CreateEventPage } from './pages/CreateEventPage.jsx';
import { MyEventsPage } from './pages/MyEventsPage.jsx';
import { NotificationsPage } from './pages/NotificationsPage.jsx';

// Pantallas que requieren sesión (y, por el VerificationGate, identidad verificada).
const PRIVATE_ROUTES = [
  ['/perfil', <ProfilePage />],
  ['/crear', <CreateEventPage />],
  ['/mis-eventos', <MyEventsPage />],
  ['/avisos', <NotificationsPage />],
];

export default function App() {
  const realRef = useRef(null);
  const { user, identityStatus } = useAuth();
  // ?skipwelcome en la URL evita la pantalla de bienvenida (útil mientras se trabaja sobre la Home).
  const [entered, setEntered] = useState(
    () => new URLSearchParams(window.location.search).has('skipwelcome')
  );
  // Una cuenta sin verificar no navega a ningún lado: sin barra inferior.
  const showBottomNav = !user || identityStatus === 'verified';

  return (
    <>
      <div ref={realRef} className="app-real">
        <div className="app-shell">
          <NavBar />
          <main className="app-main">
            <VerificationGate>
              <Routes>
                <Route path="/" element={<FeedPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/registro" element={<RegisterPage />} />
                <Route
                  path={VERIFICATION_PATH}
                  element={
                    <ProtectedRoute>
                      <VerificationPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="/eventos/:id" element={<EventDetailPage />} />
                {PRIVATE_ROUTES.map(([path, page]) => (
                  <Route key={path} path={path} element={<ProtectedRoute>{page}</ProtectedRoute>} />
                ))}
              </Routes>
            </VerificationGate>
          </main>
          {showBottomNav && <BottomNav />}
        </div>
      </div>
      {!entered && <WelcomeOverlay onEnter={() => setEntered(true)} revealTargetRef={realRef} />}
    </>
  );
}
