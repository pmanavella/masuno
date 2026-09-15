function catClass(cat) {
  return 'cat-' + cat.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '');
}

export function EventCard({ event }) {
  const spotsLeft = event.spots_total - event.spots_taken;
  const start = new Date(event.starts_at);
  const month = start.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '').toUpperCase();
  const day = start.getDate();
  const dateLabel = start.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
  const timeLabel = start.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="event-card">
      <div
        className={`thumb ${catClass(event.category)}`}
        style={event.image_url ? { backgroundImage: `url(${event.image_url})` } : undefined}
      >
        <div className="date-chip"><span>{month}</span><b>{day}</b></div>
        <div className="host-chip">
          <span className="avatar-xs">{event.organizer_initials}</span>
          <span>{event.organizer_name} organiza</span>
        </div>
        <span className="badge-spots">Faltan {spotsLeft} cupos</span>
      </div>
      <h4>{event.title}</h4>
      <div className="event-meta">📍 {event.city} · {event.category}</div>
      <div className="event-footer">
        <span>📅 {dateLabel}</span>
        <span>🕐 {timeLabel}</span>
      </div>
      <div className="stars">
        {event.organizer_review_count > 0 ? (
          <>★ <b>{Number(event.organizer_rating).toFixed(1)}</b> ({event.organizer_review_count} reseñas)</>
        ) : (
          <span>Organizador nuevo</span>
        )}
      </div>
    </div>
  );
}
