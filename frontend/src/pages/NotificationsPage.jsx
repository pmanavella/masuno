import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/apiClient.js';
import { useNotifications } from '../context/NotificationsContext.jsx';
import { notificationText } from '../lib/events.js';

function timeAgo(isoDateTime) {
  const minutes = Math.round((Date.now() - new Date(isoDateTime).getTime()) / 60000);
  if (minutes < 1) return 'recién';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return new Date(isoDateTime).toLocaleDateString('es-AR');
}

// Al abrir la pantalla se marcan todos como leídos; los que eran nuevos quedan resaltados
// mientras la pantalla siga abierta (se recuerdan aparte porque cada recarga ya los trae leídos).
export function NotificationsPage() {
  const { version, markAllRead } = useNotifications();
  const [items, setItems] = useState(null);
  const [freshIds, setFreshIds] = useState(() => new Set());
  const [error, setError] = useState('');

  useEffect(() => {
    api.getNotifications()
      .then((list) => {
        setItems(list);
        const unread = list.filter((n) => !n.read_at).map((n) => n.id);
        if (unread.length === 0) return undefined;
        setFreshIds((prev) => new Set([...prev, ...unread]));
        return markAllRead();
      })
      .catch((err) => setError(err.message));
  }, [version, markAllRead]);

  if (error) return <div className="card"><p className="error-text">{error}</p></div>;
  if (!items) return <p className="muted gate-message">Cargando avisos...</p>;

  return (
    <div className="notifications-page">
      <h1>Avisos</h1>
      {items.length === 0 ? (
        <div className="empty-state">No tenés avisos todavía.</div>
      ) : (
        <ul className="notification-list">
          {items.map((n) => (
            <li key={n.id}>
              <Link to={`/eventos/${n.event_id}`} className={`notification ${freshIds.has(n.id) ? 'unread' : ''}`}>
                <span>{notificationText(n.type, n.event?.title)}</span>
                <span className="muted">{timeAgo(n.created_at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
