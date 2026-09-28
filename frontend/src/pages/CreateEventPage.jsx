import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/apiClient.js';
import { useToast } from '../context/ToastContext.jsx';
import { CATEGORIES } from '../lib/events.js';
import { GENDER_LABELS } from '../lib/genders.js';

const MIN_AGE = 18;

// 'YYYY-MM-DDTHH:mm' en hora local, para el mínimo del selector.
function localDateTimeInput(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function CreateEventPage() {
  const navigate = useNavigate();
  const showToast = useToast();
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: '',
    city: 'Córdoba Capital',
    startsAt: '',
    spotsTotal: '',
    ageMin: String(MIN_AGE),
    ageMax: '',
    gender: 'indistinto',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.startsAt) {
      setError('Elegí fecha y hora.');
      return;
    }
    setSaving(true);
    try {
      // datetime-local no tiene zona: se interpreta en la hora del navegador (Córdoba).
      const event = await api.createEvent({ ...form, startsAt: new Date(form.startsAt).toISOString() });
      showToast('¡Evento creado!');
      navigate(`/eventos/${event.id}`, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="auth-card">
      <h1>Crear evento</h1>
      <p className="muted">Los que quieran sumarse te van a pedir unirse y vos elegís a quién aceptar.</p>
      <form onSubmit={handleSubmit}>
        <label>
          Título
          <input required maxLength={80} value={form.title} onChange={(e) => update('title', e.target.value)} />
        </label>
        <label>
          Descripción (opcional)
          <textarea rows={3} maxLength={500} value={form.description} onChange={(e) => update('description', e.target.value)} />
        </label>
        <label>
          Categoría
          <select required value={form.category} onChange={(e) => update('category', e.target.value)}>
            <option value="" disabled>Elegí una categoría</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label>
          Ciudad
          <input required maxLength={60} value={form.city} onChange={(e) => update('city', e.target.value)} />
        </label>
        <label>
          Fecha y hora
          <input
            required
            type="datetime-local"
            min={localDateTimeInput(new Date())}
            value={form.startsAt}
            onChange={(e) => update('startsAt', e.target.value)}
          />
        </label>
        <label>
          Cupos
          <input required type="number" min={1} max={100} value={form.spotsTotal} onChange={(e) => update('spotsTotal', e.target.value)} />
        </label>
        <div className="form-row">
          <label>
            Edad mínima
            <input required type="number" min={MIN_AGE} max={99} value={form.ageMin} onChange={(e) => update('ageMin', e.target.value)} />
          </label>
          <label>
            Edad máxima
            <input type="number" min={MIN_AGE} max={99} placeholder="Sin límite" value={form.ageMax} onChange={(e) => update('ageMax', e.target.value)} />
          </label>
        </div>
        <label>
          ¿Para quién es?
          <select value={form.gender} onChange={(e) => update('gender', e.target.value)}>
            {Object.entries(GENDER_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        {error && <p className="error-text">{error}</p>}
        <button className="btn-primary btn-block" type="submit" disabled={saving}>
          {saving ? 'Creando...' : 'Crear evento'}
        </button>
      </form>
    </div>
  );
}
