import { HttpError } from '../utils/HttpError.js';

// Mismas listas que los CHECK de public.events.
export const CATEGORIES = [
  'Deportes', 'Social', 'Aire libre', 'Cultura', 'Networking',
  'Música', 'Gastronomía', 'Vida nocturna', 'Juegos', 'Bienestar',
];
export const EVENT_GENDERS = ['indistinto', 'masculino', 'femenino', 'no_binario'];
export const MIN_AGE = 18;
const MAX_AGE = 99;
const MAX_SPOTS = 100;

// Códigos de can_join_event / request_to_join / respond_to_request / cancel_request.
// El mismo mensaje se usa para explicar por qué no se puede pedir unirse.
const ERRORS = {
  invalid_input: [400, 'Revisá los datos del evento.'],
  not_verified: [403, 'Tenés que verificar tu identidad primero.'],
  not_found: [404, 'No encontramos ese evento o solicitud.'],
  own_event: [409, 'Es tu evento.'],
  already_requested: [409, 'Ya pediste unirte a este evento.'],
  event_started: [409, 'El evento ya empezó.'],
  full: [409, 'No quedan lugares.'],
  age: [403, 'Este evento es para otra franja de edad.'],
  gender: [403, 'Este evento es para otro género.'],
  not_pending: [409, 'Esa solicitud ya fue respondida.'],
  not_cancellable: [409, 'Esa solicitud ya no se puede cancelar.'],
};

export function eventError(code) {
  const [status, message] = ERRORS[code];
  return new HttpError(status, code, message);
}

export function reasonMessage(code) {
  return code === 'ok' ? null : ERRORS[code]?.[1] ?? null;
}

// Las funciones SQL levantan el código como mensaje; lo demás se propaga tal cual.
export function mapRpcError(error) {
  return ERRORS[error?.message] ? eventError(error.message) : error;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(value) {
  return UUID_RE.test(value ?? '');
}

function toInt(value) {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').trim());
  return Number.isInteger(n) ? n : null;
}

function cleanText(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

// Devuelve las columnas para insertar en events, o HttpError invalid_input con el detalle.
// organizer_name, iniciales, spots_taken e imagen los completa el trigger de la base.
export function validateNewEvent(body, now = new Date()) {
  const fail = (message) => {
    throw new HttpError(400, 'invalid_input', message);
  };

  const title = cleanText(body?.title);
  if (title.length < 3 || title.length > 80) fail('El título tiene que tener entre 3 y 80 caracteres.');

  const description = String(body?.description ?? '').trim();
  if (description.length > 500) fail('La descripción puede tener hasta 500 caracteres.');

  if (!CATEGORIES.includes(body?.category)) fail('Elegí una categoría.');

  const city = cleanText(body?.city) || 'Córdoba Capital';
  if (city.length > 60) fail('La ciudad es demasiado larga.');

  const startsAt = new Date(body?.startsAt ?? '');
  if (Number.isNaN(startsAt.getTime())) fail('Elegí fecha y hora.');
  if (startsAt.getTime() <= now.getTime()) fail('La fecha tiene que ser futura.');

  const spotsTotal = toInt(body?.spotsTotal);
  if (spotsTotal === null || spotsTotal < 1 || spotsTotal > MAX_SPOTS) fail(`Los cupos tienen que ser entre 1 y ${MAX_SPOTS}.`);

  const ageMin = body?.ageMin === undefined || body?.ageMin === '' ? MIN_AGE : toInt(body.ageMin);
  if (ageMin === null || ageMin < MIN_AGE || ageMin > MAX_AGE) fail(`La edad mínima tiene que ser entre ${MIN_AGE} y ${MAX_AGE}.`);

  // Sin edad máxima = sin límite (age_max null).
  const hasAgeMax = body?.ageMax !== undefined && body?.ageMax !== null && body?.ageMax !== '';
  const ageMax = hasAgeMax ? toInt(body.ageMax) : null;
  if (hasAgeMax && (ageMax === null || ageMax < ageMin || ageMax > MAX_AGE)) {
    fail(`La edad máxima tiene que ser entre la mínima y ${MAX_AGE}.`);
  }

  const gender = body?.gender ?? 'indistinto';
  if (!EVENT_GENDERS.includes(gender)) fail('Elegí para quién es el evento.');

  return {
    title,
    description: description || null,
    category: body.category,
    city,
    starts_at: startsAt.toISOString(),
    spots_total: spotsTotal,
    age_min: ageMin,
    age_max: ageMax,
    gender,
  };
}
