// Los eventos son en Córdoba: "hoy", "mañana" y "este finde" se calculan en esa zona, no en UTC
// ni en la del navegador. El backend usa la misma zona para filtrar por día.
export const TIME_ZONE = 'America/Argentina/Cordoba';

const isoDateParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

// Fecha 'YYYY-MM-DD' del instante `date` en Córdoba.
export function toISODate(date) {
  const parts = Object.fromEntries(isoDateParts.formatToParts(date).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

// Suma días de 24 h (Córdoba no tiene horario de verano), sin depender de la zona del navegador.
export function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

// Día de la semana (0 = domingo) en Córdoba.
function weekdayInCordoba(date) {
  return new Date(`${toISODate(date)}T12:00:00Z`).getUTCDay();
}

// El backend filtra por un día exacto, no por rango, así que "este finde" se traduce
// al próximo sábado (o hoy mismo si hoy ya es sábado o domingo).
export function nextWeekendDate(now = new Date()) {
  const day = weekdayInCordoba(now);
  if (day === 0 || day === 6) return now;
  return addDays(now, 6 - day);
}

export function formatDateChip(dateStr, now = new Date()) {
  if (!dateStr) return null;
  const today = toISODate(now);
  const tomorrow = toISODate(addDays(now, 1));
  if (dateStr === today) return 'Hoy';
  if (dateStr === tomorrow) return 'Mañana';
  return new Date(`${dateStr}T12:00:00Z`).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}
