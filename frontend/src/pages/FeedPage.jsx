import { useEffect, useState } from 'react';
import { api } from '../lib/apiClient.js';
import { EventCard } from '../components/EventCard.jsx';
import { FilterIsland } from '../components/FilterIsland.jsx';
import { FiltersSheet } from '../components/FiltersSheet.jsx';
import { CATEGORIES } from '../lib/events.js';

export function FeedPage() {
  const [filters, setFilters] = useState({
    city: 'Córdoba Capital', categories: [], date: '', ageMin: '', ageMax: '', gender: '',
  });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    api.getEvents(filters)
      .then(setEvents)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [filters]);

  return (
    <div className="feed-page">
      <h1>Descubrir eventos</h1>
      <p className="muted">📍 {filters.city}</p>
      <FilterIsland filters={filters} onOpen={() => setSheetOpen(true)} />
      {error && <p className="error-text">{error}</p>}
      {loading ? (
        <p className="muted">Cargando eventos...</p>
      ) : events.length === 0 ? (
        <div className="empty-state">No hay eventos que coincidan con estos filtros todavía.</div>
      ) : (
        <div className="event-grid">
          {events.map((e) => <EventCard key={e.id} event={e} />)}
        </div>
      )}
      <FiltersSheet
        open={sheetOpen}
        filters={filters}
        setFilters={setFilters}
        categories={CATEGORIES}
        onClose={() => setSheetOpen(false)}
      />
    </div>
  );
}
