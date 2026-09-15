import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Logo } from './Logo.jsx';

export function NavBar() {
  const { user } = useAuth();

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        <Logo size={36} />
      </Link>
      {!user && (
        <div className="navbar-links">
          <Link to="/login">Ingresar</Link>
          <Link to="/registro" className="btn-primary-sm">Crear cuenta</Link>
        </div>
      )}
    </nav>
  );
}
