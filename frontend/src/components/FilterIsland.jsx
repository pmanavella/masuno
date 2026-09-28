import { formatDateChip } from '../lib/dateFilters.js';
import { genderLabel } from '../lib/genders.js';

const AGE_MIN = 18;
const AGE_MAX = 99;
const DEFAULT_CITY = 'Córdoba Capital';

function buildActiveLabels(filters) {
  const labels = [];
  if (filters.city && filters.city !== DEFAULT_CITY) labels.push(filters.city);
  if (filters.categories?.length === 1) labels.push(filters.categories[0]);
  else if (filters.categories?.length > 1) labels.push(`${filters.categories[0]} +${filters.categories.length - 1}`);
  const dateLabel = formatDateChip(filters.date);
  if (dateLabel) labels.push(dateLabel);
  if (filters.ageMin || filters.ageMax) labels.push(`${filters.ageMin || AGE_MIN}–${filters.ageMax || AGE_MAX}`);
  if (filters.gender) labels.push(genderLabel(filters.gender));
  return labels;
}

export function FilterIsland({ filters, onOpen }) {
  const labels = buildActiveLabels(filters);

  return (
    <button className="filter-island" type="button" onClick={onOpen}>
      <span className="fi-icon" aria-hidden>✨</span>
      {labels.length > 0 ? (
        <span className="fi-labels">
          {labels.slice(0, 2).map((label) => (
            <span key={label} className="fi-pill">{label}</span>
          ))}
          {labels.length > 2 && <span className="fi-pill fi-more">+{labels.length - 2}</span>}
        </span>
      ) : (
        <span className="fi-prompt">¿Qué plan buscás hoy?</span>
      )}
      <span className="fi-gear" aria-hidden>⚙️</span>
    </button>
  );
}
