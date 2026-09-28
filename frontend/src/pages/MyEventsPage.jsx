import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/apiClient.js';
import { useNotifications } from '../context/NotificationsContext.jsx';
import { EventCard } from '../components/EventCard.jsx';
import { REQUEST_STATUS_LABELS, formatEventDate } from '../lib/events.js';

export function MyEventsPage() {
  const { version } = useNotifications();
  const [organized, setOrganized] = useState(null);
  const [requests, setRequests] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.getOrganizedEvents(), api.getMyRequests()])
      .then(([events, mine]) => {
        setOrganized(events);
        setRequests(mine);
      })
      .catch((err) => setError(err.message));
  }, [version]);

  if (error) return <div className="card"><p className="error-text">{error}</p></div>;
  if (!organized || !requests) return <p className="muted gate-message">Cargando...</p>;

  return (
    <div className="my-events-page">
      <h1>Mis eventos</h1>

      <h2 className="section-title">Organizo</h2>
      {organized.length === 0 ? (
        <div className="empty-state">
          Todavía no organizaste nada. <Link to="/crear" className="btn-ghost">Crear evento</Link>
        </div>
      ) : (
        <div className="event-grid">
          {organized.map((e) => <EventCard key={e.id} event={e} />)}
        </div>
      )}

      <h2 className="section-title">Mis solicitudes</h2>
      {requests.length === 0 ? (
        <div className="empty-state">Todavía no pediste unirte a ningún evento.</div>
      ) : (
        <ul className="my-requests">
          {requests.map((r) => (
            <li key={r.id}>
              <Link to={`/eventos/${r.event.id}`} className="my-request">
                <span>
                  <b>{r.event.title}</b>
                  <span className="muted">{formatEventDate(r.event.starts_at)}</span>
                </span>
                <span className={`status-pill status-${r.status}`}>{REQUEST_STATUS_LABELS[r.status]}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
