import { useEffect, useRef, useState } from 'react';
import { DualRangeSlider } from './DualRangeSlider.jsx';
import { CitySearchInput } from './CitySearchInput.jsx';
import { toISODate, addDays, nextWeekendDate } from '../lib/dateFilters.js';

const CATEGORY_ICONS = {
  Deportes: '🏃',
  Social: '🎉',
  'Aire libre': '🌿',
  Cultura: '🎨',
  Networking: '🤝',
  Música: '🎵',
  Gastronomía: '🍽️',
  'Vida nocturna': '🌙',
  Juegos: '🎲',
  Bienestar: '🧘',
};

// "Indistinto" queda afuera de los chips rápidos a propósito: la referencia visual
// usa 3 botones (Cualquiera/Mujer/Hombre) y "Cualquiera" (sin filtro) cubre ese caso
// mejor que agregar un 4to chip. El valor sigue existiendo en el backend igual.
const GENDER_OPTIONS = [
  { value: '', label: '👥 Cualquiera' },
  { value: 'Femenino', label: '♀ Mujer' },
  { value: 'Masculino', label: '♂ Hombre' },
];

const AGE_MIN = 16;
const AGE_MAX = 99;
const DEFAULT_CITY = 'Córdoba Capital';
const DRAG_CLOSE_THRESHOLD = 110; // px arrastrados hacia abajo para cerrar el sheet
const CLOSE_ANIM_MS = 300;

const emptyDraft = () => ({ city: DEFAULT_CITY, categories: [], date: '', ageMin: '', ageMax: '', gender: '' });

export function FiltersSheet({ open, filters, setFilters, categories, onClose }) {
  const [visible, setVisible] = useState(open);
  const [animateIn, setAnimateIn] = useState(false);
  const [draft, setDraft] = useState(filters);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const panelRef = useRef(null);
  const dragging = useRef(false);
  const startY = useRef(0);
  const deltaY = useRef(0);

  useEffect(() => {
    if (open) {
      setDraft(filters);
      setShowDatePicker(false);
      setVisible(true);
      requestAnimationFrame(() => setAnimateIn(true));
    } else if (visible) {
      setAnimateIn(false);
      const timer = setTimeout(() => setVisible(false), CLOSE_ANIM_MS);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function updateDraft(field, value) {
    setDraft((d) => ({ ...d, [field]: value }));
  }

  function toggleCategory(cat) {
    setDraft((d) => ({
      ...d,
      categories: d.categories.includes(cat)
        ? d.categories.filter((c) => c !== cat)
        : [...d.categories, cat],
    }));
  }

  function handleClearAll() {
    const cleared = emptyDraft();
    setDraft(cleared);
    setFilters(cleared);
  }

  function handleApply() {
    setFilters(draft);
    onClose();
  }

  function pickDate(dateStr) {
    updateDraft('date', dateStr);
    setShowDatePicker(false);
  }

  function handlePointerDown(e) {
    dragging.current = true;
    startY.current = e.clientY;
    deltaY.current = 0;
  }

  function handlePointerMove(e) {
    if (!dragging.current || !panelRef.current) return;
    deltaY.current = Math.max(0, e.clientY - startY.current);
    panelRef.current.style.transform = `translateY(${deltaY.current}px)`;
  }

  function handlePointerUp() {
    if (!dragging.current) return;
    dragging.current = false;
    const shouldClose = deltaY.current > DRAG_CLOSE_THRESHOLD;
    if (panelRef.current) {
      panelRef.current.style.transition = 'transform 220ms ease';
      panelRef.current.style.transform = shouldClose ? 'translateY(100%)' : '';
      setTimeout(() => {
        if (panelRef.current) panelRef.current.style.transition = '';
      }, 220);
    }
    if (shouldClose) onClose();
  }

  if (!visible) return null;

  const today = toISODate(new Date());
  const tomorrow = toISODate(addDays(new Date(), 1));
  const weekend = toISODate(nextWeekendDate());

  return (
    <div className={`sheet-backdrop ${animateIn ? 'open' : ''}`} onClick={onClose}>
      <div
        ref={panelRef}
        className={`sheet-panel ${animateIn ? 'open' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="sheet-drag-area"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <span className="sheet-handle" />
          <div className="sheet-header">
            <div>
              <h2>Encontrá tu plan</h2>
              <p className="muted">Ajustá lo que querés hacer</p>
            </div>
            <button type="button" className="sheet-clear" onClick={handleClearAll}>Limpiar todo</button>
          </div>
        </div>

        <div className="sheet-body">
          <section>
            <h3 className="sheet-section-title">Ciudad</h3>
            <CitySearchInput value={draft.city} onChange={(city) => updateDraft('city', city)} />
          </section>

          <section>
            <h3 className="sheet-section-title">Categorías</h3>
            <div className="chip-group">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`filter-chip ${draft.categories.includes(cat) ? 'active' : ''}`}
                  onClick={() => toggleCategory(cat)}
                >
                  {CATEGORY_ICONS[cat] || '•'} {cat}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 className="sheet-section-title">Fecha</h3>
            <div className="chip-group">
              <button type="button" className={`filter-chip ${draft.date === today ? 'active' : ''}`} onClick={() => pickDate(today)}>Hoy</button>
              <button type="button" className={`filter-chip ${draft.date === tomorrow ? 'active' : ''}`} onClick={() => pickDate(tomorrow)}>Mañana</button>
              <button type="button" className={`filter-chip ${draft.date === weekend ? 'active' : ''}`} onClick={() => pickDate(weekend)}>Este finde</button>
              <button type="button" className={`filter-chip ${showDatePicker ? 'active' : ''}`} onClick={() => setShowDatePicker((v) => !v)}>📅 Elegir fecha</button>
            </div>
            {showDatePicker && (
              <input
                type="date"
                className="sheet-date-input"
                value={draft.date}
                onChange={(e) => updateDraft('date', e.target.value)}
              />
            )}
          </section>

          <section>
            <div className="sheet-section-title-row">
              <h3 className="sheet-section-title">Edad</h3>
              <span className="muted">{draft.ageMin || AGE_MIN} – {draft.ageMax || AGE_MAX} años</span>
            </div>
            <DualRangeSlider
              min={AGE_MIN}
              max={AGE_MAX}
              valueMin={Number(draft.ageMin) || AGE_MIN}
              valueMax={Number(draft.ageMax) || AGE_MAX}
              onChangeMin={(v) => updateDraft('ageMin', String(v))}
              onChangeMax={(v) => updateDraft('ageMax', String(v))}
            />
          </section>

          <section>
            <h3 className="sheet-section-title">Género</h3>
            <div className="chip-group">
              {GENDER_OPTIONS.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  className={`filter-chip ${draft.gender === opt.value ? 'active' : ''}`}
                  onClick={() => updateDraft('gender', opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="sheet-footer">
          <button type="button" className="btn-primary sheet-cta" onClick={handleApply}>
            Ver planes →
          </button>
        </div>
      </div>
    </div>
  );
}
