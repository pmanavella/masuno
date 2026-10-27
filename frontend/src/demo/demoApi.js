import { CATEGORIES } from '../lib/events.js';
import { toISODate } from '../lib/dateFilters.js';
import { DEMO_UNAVAILABLE_MESSAGE } from '../lib/demoMode.js';
import { CATEGORY_IMAGES, DEMO_ORGANIZER, DEMO_USER, buildDemoEvents, buildDemoProfile } from './demoData.js';

// Misma interfaz que `api` (src/lib/apiClient.js), sobre un estado en memoria: lo que hace el
// visitante vive solo en esta pestaña y se pierde al recargar. Reglas y mensajes copiados del
// backend (eventService.js / can_join_event) para que la demo se comporte como la app real.

const ACCEPT_DELAY_MS = 4000;
const EVENT_GENDERS = ['indistinto', 'masculino', 'femenino', 'no_binario'];

const MESSAGES = {
  not_found: [404, 'No encontramos ese evento o solicitud.'],
  own_event: [409, 'Es tu evento.'],
  already_requested: [409, 'Ya pediste unirte a este evento.'],
  event_started: [409, 'El evento ya empezó.'],
  full: [409, 'No quedan lugares.'],
  age: [403, 'Este evento es para otra franja de edad.'],
  gender: [403, 'Este evento es para otro género.'],
  not_cancellable: [409, 'Esa solicitud ya no se puede cancelar.'],
};

const state = {
  events: buildDemoEvents(),
  profile: buildDemoProfile(),
  requests: [],
  notifications: [],
  // Planes que ya tuvieron su aceptación simulada (una sola vez por plan).
  autoAccepted: new Set(),
  nextId: 1,
};

const listeners = new Set();

// DemoNotificationsProvider se suscribe para enterarse de los avisos simulados.
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function unreadCount() {
  return state.notifications.filter((n) => !n.read_at).length;
}

function newId(prefix) {
  return `${prefix}-${state.nextId++}`;
}

function fail(code, message = MESSAGES[code]?.[1]) {
  const status = MESSAGES[code]?.[0] ?? 400;
  return Object.assign(new Error(message), { code, status });
}

function invalid(message) {
  return fail('invalid_input', message);
}

const copy = (value) => structuredClone(value);

function findEvent(id) {
  const event = state.events.find((e) => e.id === id);
  if (!event) throw fail('not_found');
  return event;
}

function myLatestRequest(eventId) {
  return state.requests.filter((r) => r.event_id === eventId).at(-1) ?? null;
}

// Como can_join_event() de la base: 'ok' o el código del motivo.
function canJoin(event) {
  if (event.organizer_id === DEMO_USER.id) return 'own_event';
  const status = myLatestRequest(event.id)?.status;
  if (status === 'pending' || status === 'accepted') return 'already_requested';
  if (new Date(event.starts_at).getTime() <= Date.now()) return 'event_started';
  if (event.spots_taken >= event.spots_total) return 'full';
  const { age, gender } = state.profile.declared;
  if (age < event.age_min || (event.age_max != null && age > event.age_max)) return 'age';
  if (event.gender !== 'indistinto' && event.gender !== gender) return 'gender';
  return 'ok';
}

// Mismos filtros que EventModel.list del backend (el día se toma en hora de Córdoba).
function matches(event, filters) {
  if (filters.city && event.city !== filters.city) return false;
  if (filters.categories?.length > 0 && !filters.categories.includes(event.category)) return false;
  if (filters.date && toISODate(new Date(event.starts_at)) !== filters.date) return false;
  const ageMin = Number(filters.ageMin) || null;
  const ageMax = Number(filters.ageMax) || null;
  if (ageMin != null && event.age_max != null && event.age_max < ageMin) return false;
  if (ageMax != null && event.age_min > ageMax) return false;
  const gender = filters.gender?.toLowerCase();
  if (EVENT_GENDERS.includes(gender) && gender !== 'indistinto' && ![gender, 'indistinto'].includes(event.gender)) {
    return false;
  }
  return true;
}

const byStart = (a, b) => new Date(a.starts_at) - new Date(b.starts_at);

// Copia simplificada de validateNewEvent (backend/src/services/eventService.js).
function validateNewEvent(body) {
  const title = String(body.title ?? '').trim().replace(/\s+/g, ' ');
  if (title.length < 3 || title.length > 80) throw invalid('El título tiene que tener entre 3 y 80 caracteres.');
  const description = String(body.description ?? '').trim();
  if (description.length > 500) throw invalid('La descripción puede tener hasta 500 caracteres.');
  if (!CATEGORIES.includes(body.category)) throw invalid('Elegí una categoría.');
  const city = String(body.city ?? '').trim().replace(/\s+/g, ' ') || 'Córdoba Capital';
  if (city.length > 60) throw invalid('La ciudad es demasiado larga.');
  const startsAt = new Date(body.startsAt ?? '');
  if (Number.isNaN(startsAt.getTime())) throw invalid('Elegí fecha y hora.');
  if (startsAt.getTime() <= Date.now()) throw invalid('La fecha tiene que ser futura.');
  const spotsTotal = Number(body.spotsTotal);
  if (!Number.isInteger(spotsTotal) || spotsTotal < 1 || spotsTotal > 100) throw invalid('Los cupos tienen que ser entre 1 y 100.');
  const ageMin = body.ageMin === '' || body.ageMin == null ? 18 : Number(body.ageMin);
  if (!Number.isInteger(ageMin) || ageMin < 18 || ageMin > 99) throw invalid('La edad mínima tiene que ser entre 18 y 99.');
  const ageMax = body.ageMax === '' || body.ageMax == null ? null : Number(body.ageMax);
  if (ageMax !== null && (!Number.isInteger(ageMax) || ageMax < ageMin || ageMax > 99)) {
    throw invalid('La edad máxima tiene que ser entre la mínima y 99.');
  }
  const gender = body.gender ?? 'indistinto';
  if (!EVENT_GENDERS.includes(gender)) throw invalid('Elegí para quién es el evento.');
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

// El organizador "acepta" a los pocos segundos: una vez por plan y nunca en los planes propios.
function scheduleAutoAccept(event, request) {
  if (event.organizer_id === DEMO_USER.id || state.autoAccepted.has(event.id)) return;
  state.autoAccepted.add(event.id);
  setTimeout(() => {
    if (request.status !== 'pending' || event.spots_taken >= event.spots_total) return;
    const now = new Date().toISOString();
    request.status = 'accepted';
    request.responded_at = now;
    event.spots_taken += 1;
    const notification = {
      id: newId('aviso'),
      type: 'request_accepted',
      event_id: event.id,
      request_id: request.id,
      read_at: null,
      created_at: now,
    };
    state.notifications.push(notification);
    listeners.forEach((listener) => listener({ notification: { ...notification, event: { title: event.title } } }));
  }, ACCEPT_DELAY_MS);
}

const resolve = (fn) => (...args) => {
  try {
    return Promise.resolve(fn(...args));
  } catch (err) {
    return Promise.reject(err);
  }
};

export const demoApi = {
  getProfile: resolve(() => copy(state.profile)),

  updatePhone: resolve((phone) => {
    state.profile.phone = phone || null;
    return { phone: state.profile.phone, email: DEMO_USER.email };
  }),

  getEvents: resolve((filters = {}) => copy(state.events.filter((e) => matches(e, filters)).sort(byStart))),

  getCities: resolve(() => [...new Set(state.events.map((e) => e.city))].sort()),

  getEvent: resolve((id) => {
    const event = findEvent(id);
    const isOrganizer = event.organizer_id === DEMO_USER.id;
    const code = canJoin(event);
    const mine = isOrganizer ? null : myLatestRequest(id);
    return copy({
      event,
      viewer: {
        isOrganizer,
        canJoin: code,
        canJoinMessage: code === 'ok' ? null : MESSAGES[code]?.[1] ?? null,
        myRequest: mine && { id: mine.id, status: mine.status, created_at: mine.created_at, responded_at: mine.responded_at },
        // Nadie más usa la demo: los planes propios no reciben solicitudes.
        requests: isOrganizer ? [] : null,
      },
    });
  }),

  createEvent: resolve((fields) => {
    const event = {
      ...validateNewEvent(fields),
      id: newId('demo-nuevo'),
      spots_taken: 0,
      image_url: CATEGORY_IMAGES[fields.category],
      organizer_id: DEMO_USER.id,
      organizer_name: DEMO_ORGANIZER.name,
      organizer_initials: DEMO_ORGANIZER.initials,
      organizer_rating: null,
      organizer_review_count: 0,
      organizer_verified_business: false,
    };
    state.events.push(event);
    return copy(event);
  }),

  getOrganizedEvents: resolve(() => copy(state.events.filter((e) => e.organizer_id === DEMO_USER.id).sort(byStart))),

  requestToJoin: resolve((eventId) => {
    const event = findEvent(eventId);
    const code = canJoin(event);
    if (code !== 'ok') throw fail(code);
    const request = {
      id: newId('solicitud'),
      event_id: eventId,
      status: 'pending',
      created_at: new Date().toISOString(),
      responded_at: null,
    };
    state.requests.push(request);
    scheduleAutoAccept(event, request);
    return { id: request.id, status: request.status };
  }),

  getMyRequests: resolve(() =>
    copy(
      [...state.requests]
        .reverse()
        .map(({ event_id: eventId, ...r }) => ({ ...r, event: state.events.find((e) => e.id === eventId) }))
    )
  ),

  cancelRequest: resolve((requestId) => {
    const request = state.requests.find((r) => r.id === requestId);
    if (!request) throw fail('not_found');
    if (request.status !== 'pending' && request.status !== 'accepted') throw fail('not_cancellable');
    if (request.status === 'accepted') findEvent(request.event_id).spots_taken -= 1;
    request.status = 'cancelled';
    return { id: request.id, status: request.status };
  }),

  respondToRequest: resolve(() => {
    throw new Error(DEMO_UNAVAILABLE_MESSAGE);
  }),

  getNotifications: resolve(() =>
    copy(
      [...state.notifications].reverse().map((n) => {
        const event = state.events.find((e) => e.id === n.event_id);
        return { ...n, event: { title: event.title, starts_at: event.starts_at } };
      })
    )
  ),

  markNotificationsRead: resolve(() => {
    const now = new Date().toISOString();
    state.notifications.forEach((n) => {
      n.read_at ??= now;
    });
    return null;
  }),
};
