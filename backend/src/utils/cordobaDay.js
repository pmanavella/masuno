// Los eventos son en Córdoba: un "día" del filtro va de 00:00 a 24:00 hora de Córdoba, no UTC.
// El frontend calcula "hoy", "mañana" y "este finde" en la misma zona (frontend/src/lib/dateFilters.js).
export const TIME_ZONE = 'America/Argentina/Cordoba';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

const offsetFormat = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, timeZoneName: 'longOffset' });

// "-03:00" (Argentina hoy no tiene horario de verano, pero se consulta en vez de asumirlo).
function offsetAt(date) {
  const name = offsetFormat.formatToParts(date).find((p) => p.type === 'timeZoneName').value; // "GMT-03:00"
  return name === 'GMT' ? '+00:00' : name.slice(3);
}

// 'YYYY-MM-DD' -> { start, end } en ISO con offset, para filtrar starts_at >= start y < end.
// null si la fecha no es válida.
export function cordobaDayRange(isoDate) {
  if (!ISO_DATE_RE.test(isoDate ?? '')) return null;
  const noon = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(noon.getTime()) || noon.toISOString().slice(0, 10) !== isoDate) return null;
  const nextDay = new Date(noon.getTime() + DAY_MS);
  return {
    start: `${isoDate}T00:00:00${offsetAt(noon)}`,
    end: `${nextDay.toISOString().slice(0, 10)}T00:00:00${offsetAt(nextDay)}`,
  };
}
