import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export const VERIFICATION_PATH = '/verificacion';

// Una cuenta logueada sin identidad verificada solo puede estar en /verificacion.
// (La base igual le impide crear eventos o pedir unirse: esto es la parte de UI.)
// Sin sesión, todo sigue visible como antes (el feed es público).
export function VerificationGate({ children }) {
  const { user, loading, identityStatus, refreshIdentity, signOut } = useAuth();
  const { pathname } = useLocation();

  if (loading) return null;
  if (!user) return children;

  if (identityStatus === 'loading' || identityStatus === 'none') {
    return <p className="muted gate-message">Cargando tu cuenta...</p>;
  }

  if (identityStatus === 'error') {
    return (
      <div className="card">
        <h2>No pudimos cargar tu cuenta</h2>
        <p className="muted">Revisá tu conexión y probá de nuevo.</p>
        <div className="cta-row">
          <button className="btn-primary" type="button" onClick={refreshIdentity}>Reintentar</button>
          <button className="btn-ghost" type="button" onClick={signOut}>Cerrar sesión</button>
        </div>
      </div>
    );
  }

  if (identityStatus === 'unverified' && pathname !== VERIFICATION_PATH) {
    return <Navigate to={VERIFICATION_PATH} replace />;
  }

  return children;
}
