import { NavLink } from 'react-router-dom';
import { useToast } from '../context/ToastContext.jsx';

export function BottomNav() {
  const showToast = useToast();

  return (
    <nav className="bottom-nav">
      <NavLink to="/" end className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}>
        <span className="ic">🏠</span>Inicio
      </NavLink>
      <button className="nav-btn" onClick={() => showToast('Próximamente')}>
        <span className="ic">🎟️</span>Mis eventos
      </button>
      <button className="nav-plus" onClick={() => showToast('Próximamente')} aria-label="Crear evento">+</button>
      <NavLink to="/perfil" className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}>
        <span className="ic">👤</span>Perfil
      </NavLink>
      <button className="nav-btn" onClick={() => showToast('Próximamente')}>
        <span className="ic">🔔</span>Avisos
      </button>
    </nav>
  );
}
