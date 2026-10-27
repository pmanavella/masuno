import { TIME_ZONE } from './dateFilters.js';

// Mismas categorías que el CHECK de public.events.
export const CATEGORIES = [
  'Deportes', 'Social', 'Aire libre', 'Cultura', 'Networking',
  'Música', 'Gastronomía', 'Vida nocturna', 'Juegos', 'Bienestar',
];

export const REQUEST_STATUS_LABELS = {
  pending: 'Pendiente',
  accepted: 'Aceptada',
  rejected: 'Rechazada',
  cancelled: 'Cancelada',
};

export function ageRangeLabel(ageMin, ageMax) {
  return ageMax == null ? `${ageMin} años o más` : `${ageMin} a ${ageMax} años`;
}

// "Falta 1 cupo" / "Faltan 3 cupos" / "Completo".
export function spotsLeftLabel(spotsLeft) {
  if (spotsLeft <= 0) return 'Completo';
  return spotsLeft === 1 ? 'Falta 1 cupo' : `Faltan ${spotsLeft} cupos`;
}

// "1 libre de 4" / "3 libres de 10" / "Completo (10)".
export function spotsDetailLabel(spotsLeft, spotsTotal) {
  if (spotsLeft <= 0) return `Completo (${spotsTotal})`;
  return `${spotsLeft} ${spotsLeft === 1 ? 'libre' : 'libres'} de ${spotsTotal}`;
}

export function formatEventDate(startsAt) {
  const d = new Date(startsAt);
  // "lunes, 28 de septiembre" -> "Lunes, 28 de septiembre · 20:30 h"
  const date = d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TIME_ZONE });
  const time = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TIME_ZONE });
  return `${date.charAt(0).toUpperCase()}${date.slice(1)} · ${time} h`;
}

// Texto de cada aviso (notifications.type).
export function notificationText(type, eventTitle) {
  const title = eventTitle ? `"${eventTitle}"` : 'un evento';
  switch (type) {
    case 'join_requested':
      return `Nueva solicitud para ${title}`;
    case 'request_accepted':
      return `¡Te aceptaron en ${title}!`;
    case 'request_rejected':
      return `No te aceptaron en ${title}`;
    case 'request_cancelled':
      return `Alguien canceló su solicitud en ${title}`;
    default:
      return 'Tenés un aviso nuevo';
  }
}
