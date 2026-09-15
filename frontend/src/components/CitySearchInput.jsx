import { useEffect, useState } from 'react';
import { api } from '../lib/apiClient.js';

export function CitySearchInput({ value, onChange }) {
  const [query, setQuery] = useState(value || '');
  const [cities, setCities] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    api.getCities().then(setCities).catch(() => setCities([]));
  }, []);

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  function handlePick(city) {
    onChange(city);
    setQuery(city);
    setOpen(false);
  }

  const matches = cities.filter((c) => c.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="city-search">
      <input
        type="text"
        placeholder="Buscar por ciudad..."
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
      />
      {open && query && (
        <div className="city-search-options">
          {matches.length > 0 ? (
            matches.map((c) => (
              <button key={c} type="button" className="city-search-option" onClick={() => handlePick(c)}>
                📍 {c}
              </button>
            ))
          ) : (
            <span className="city-search-empty">No hay eventos todavía en &quot;{query}&quot;</span>
          )}
        </div>
      )}
    </div>
  );
}
