export function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// El backend filtra por un día exacto, no por rango, así que "este finde" se traduce
// al próximo sábado (o hoy mismo si hoy ya es sábado o domingo).
export function nextWeekendDate() {
  const d = new Date();
  const day = d.getDay();
  if (day === 0 || day === 6) return d;
  return addDays(d, 6 - day);
}

export function formatDateChip(dateStr) {
  if (!dateStr) return null;
  const today = toISODate(new Date());
  const tomorrow = toISODate(addDays(new Date(), 1));
  if (dateStr === today) return 'Hoy';
  if (dateStr === tomorrow) return 'Mañana';
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}
