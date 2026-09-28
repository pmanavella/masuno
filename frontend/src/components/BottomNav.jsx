import { NavLink } from 'react-router-dom';
import { useNotifications } from '../context/NotificationsContext.jsx';

const navClass = ({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`;

export function BottomNav() {
  const { unread } = useNotifications();

  return (
    <nav className="bottom-nav">
      <NavLink to="/" end className={navClass}>
        <span className="ic">🏠</span>Inicio
      </NavLink>
      <NavLink to="/mis-eventos" className={navClass}>
        <span className="ic">🎟️</span>Mis eventos
      </NavLink>
      <NavLink to="/crear" className="nav-plus" aria-label="Crear evento">+</NavLink>
      <NavLink to="/perfil" className={navClass}>
        <span className="ic">👤</span>Perfil
      </NavLink>
      <NavLink to="/avisos" className={navClass}>
        <span className="ic nav-ic-badge">
          🔔
          {unread > 0 && <span className="nav-badge" aria-label={`${unread} avisos sin leer`}>{unread > 9 ? '9+' : unread}</span>}
        </span>
        Avisos
      </NavLink>
    </nav>
  );
}
