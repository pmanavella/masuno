import { useRef, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { NavBar } from './components/NavBar.jsx';
import { BottomNav } from './components/BottomNav.jsx';
import { WelcomeOverlay } from './components/WelcomeOverlay.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { RegisterPage } from './pages/RegisterPage.jsx';
import { ProfilePage } from './pages/ProfilePage.jsx';
import { FeedPage } from './pages/FeedPage.jsx';
import { EventDetailPage } from './pages/EventDetailPage.jsx';
import { CreateEventPage } from './pages/CreateEventPage.jsx';
import { MyEventsPage } from './pages/MyEventsPage.jsx';
import { NotificationsPage } from './pages/NotificationsPage.jsx';

// Pantallas que requieren sesión. Las acciones de cada una las autoriza el backend (email
// confirmado); el feed y el detalle de eventos son públicos.
const PRIVATE_ROUTES = [
  ['/perfil', <ProfilePage />],
  ['/crear', <CreateEventPage />],
  ['/mis-eventos', <MyEventsPage />],
  ['/avisos', <NotificationsPage />],
];

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
              {/* Pantalla de verificación ARCA retirada del MVP: los links de confirmación de email
                  enviados antes apuntaban acá. */}
              <Route path="/verificacion" element={<Navigate to="/" replace />} />
              <Route path="/eventos/:id" element={<EventDetailPage />} />
              {PRIVATE_ROUTES.map(([path, page]) => (
                <Route key={path} path={path} element={<ProtectedRoute>{page}</ProtectedRoute>} />
              ))}
            </Routes>
          </main>
          <BottomNav />
        </div>
      </div>
      {!entered && <WelcomeOverlay onEnter={() => setEntered(true)} revealTargetRef={realRef} />}
    </>
  );
}
