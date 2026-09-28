import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/apiClient.js';
import { useToast } from '../context/ToastContext.jsx';
import { useNotifications } from '../context/NotificationsContext.jsx';
import { catClass } from '../components/EventCard.jsx';
import { genderLabel } from '../lib/genders.js';
import { REQUEST_STATUS_LABELS, ageRangeLabel, formatEventDate } from '../lib/events.js';

export function EventDetailPage() {
  const { id } = useParams();
  const showToast = useToast();
  const { version } = useNotifications();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.getEvent(id)
      .then((result) => {
        setData(result);
        setError('');
      })
      .catch((err) => setError(err.message));
  }, [id]);

  // Recarga con cada aviso nuevo (nueva solicitud, aceptación, cancelación...).
  useEffect(load, [load, version]);

  async function run(action, successMessage) {
    setBusy(true);
    try {
      await action();
      showToast(successMessage);
    } catch (err) {
      showToast(err.message);
    } finally {
      setBusy(false);
      load();
    }
  }

  if (error && !data) return <div className="card"><p className="error-text">{error}</p></div>;
  if (!data) return <p className="muted gate-message">Cargando evento...</p>;

  const { event, viewer } = data;
  const spotsLeft = event.spots_total - event.spots_taken;

  return (
    <div className="event-detail">
      <div
        className={`event-hero ${catClass(event.category)}`}
        style={event.image_url ? { backgroundImage: `url(${event.image_url})` } : undefined}
      />
      <div className="card event-detail-card">
        <div className="host-row">
          <span className="avatar-xs">{event.organizer_initials}</span>
          <span>{event.organizer_name} organiza</span>
        </div>
        <h1>{event.title}</h1>
        <p className="event-meta">📍 {event.city} · {event.category}</p>
        <p className="event-when">📅 {formatEventDate(event.starts_at)}</p>
        {event.description && <p className="event-description">{event.description}</p>}

        <div className="info-list compact">
          <div className="info-row"><span>Cupos</span><span>{spotsLeft > 0 ? `${spotsLeft} libres de ${event.spots_total}` : `Completo (${event.spots_total})`}</span></div>
          <div className="info-row"><span>Edad</span><span>{ageRangeLabel(event.age_min, event.age_max)}</span></div>
          <div className="info-row"><span>Género</span><span>{genderLabel(event.gender)}</span></div>
        </div>

        {!viewer && (
          <Link to="/login" className="btn-primary btn-block center">Ingresá para unirte</Link>
        )}

        {viewer?.isOrganizer && (
          <OrganizerRequests
            requests={viewer.requests}
            busy={busy}
            onRespond={(requestId, accept) =>
              run(() => api.respondToRequest(requestId, accept), accept ? 'Solicitud aceptada' : 'Solicitud rechazada')
            }
          />
        )}

        {viewer && !viewer.isOrganizer && (
          <ParticipantActions
            viewer={viewer}
            busy={busy}
            onJoin={() => run(() => api.requestToJoin(event.id), 'Solicitud enviada')}
            onCancel={() => {
              if (window.confirm('¿Cancelar tu solicitud? Si ya te habían aceptado, liberás el lugar.')) {
                run(() => api.cancelRequest(viewer.myRequest.id), 'Solicitud cancelada');
              }
            }}
          />
        )}
      </div>
    </div>
  );
}

function ParticipantActions({ viewer, busy, onJoin, onCancel }) {
  const status = viewer.myRequest?.status;

  if (status === 'pending' || status === 'accepted') {
    return (
      <div className={`request-status status-${status}`}>
        <p>{status === 'pending' ? '⏳ Pediste unirte. Esperando respuesta del organizador.' : '🎉 ¡Estás adentro!'}</p>
        <button className="btn-ghost" type="button" disabled={busy} onClick={onCancel}>
          {status === 'pending' ? 'Cancelar solicitud' : 'Cancelar mi lugar'}
        </button>
      </div>
    );
  }

  if (status === 'rejected') {
    return (
      <div className="request-status status-rejected">
        <p>El organizador no aceptó tu solicitud.</p>
      </div>
    );
  }

  // Sin solicitud o cancelada: puede (volver a) pedir si la base lo permite.
  if (viewer.canJoin === 'ok') {
    return (
      <button className="btn-primary btn-block" type="button" disabled={busy} onClick={onJoin}>
        {status === 'cancelled' ? 'Volver a pedir unirme' : 'Pedir unirme'}
      </button>
    );
  }

  return (
    <div className="request-status status-blocked">
      <p>{viewer.canJoinMessage}</p>
    </div>
  );
}

function OrganizerRequests({ requests, busy, onRespond }) {
  return (
    <section className="requests-section">
      <h3>Solicitudes</h3>
      {requests.length === 0 ? (
        <p className="muted">Todavía nadie pidió unirse.</p>
      ) : (
        <ul className="request-list">
          {requests.map((r) => (
            <li key={r.request_id} className="request-item">
              <span className="avatar-xs">{r.initials}</span>
              <span className="request-name">{r.display_name}</span>
              {r.status === 'pending' ? (
                <span className="request-actions">
                  <button className="btn-primary-sm" type="button" disabled={busy} onClick={() => onRespond(r.request_id, true)}>
                    Aceptar
                  </button>
                  <button className="btn-ghost" type="button" disabled={busy} onClick={() => onRespond(r.request_id, false)}>
                    Rechazar
                  </button>
                </span>
              ) : (
                <span className={`status-pill status-${r.status}`}>{REQUEST_STATUS_LABELS[r.status]}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
