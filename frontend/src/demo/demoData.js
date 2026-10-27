import { addDays, nextWeekendDate, toISODate } from '../lib/dateFilters.js';

// Datos ficticios del modo demo. Nada de esto existe en la base.

const CITY = 'Córdoba Capital';
const MINUTE = 60 * 1000;

export const DEMO_USER = {
  id: 'demo-user',
  email: 'camila.ruiz@example.com',
  email_confirmed_at: '2026-09-01T12:00:00Z',
};

// Mismo formato que devuelve el backend en GET /profile (datos declarados + email confirmado).
export function buildDemoProfile(now = new Date()) {
  const birthDate = '1998-06-14';
  const [y, m, d] = birthDate.split('-').map(Number);
  const [ty, tm, td] = toISODate(now).split('-').map(Number);
  const age = ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
  return {
    id: DEMO_USER.id,
    phone: '+54 351 555-0142',
    email: DEMO_USER.email,
    emailConfirmed: true,
    declared: {
      first_name: 'Camila',
      last_name: 'Ruiz',
      dni_masked: '*****482',
      birth_date: birthDate,
      age,
      gender: 'femenino',
    },
  };
}

// Como lo arma la base para los eventos propios ("Camila R.", "CR").
export const DEMO_ORGANIZER = { name: 'Camila R.', initials: 'CR' };

// Una foto por categoría (public/demo-fotos/, créditos en public/demo-fotos/CREDITOS.txt). Los eventos que
// crea el visitante usan la de su categoría.
export const CATEGORY_IMAGES = {
  Deportes: '/demo-fotos/deportes.jpg',
  Social: '/demo-fotos/social.jpg',
  'Aire libre': '/demo-fotos/aire-libre.jpg',
  Cultura: '/demo-fotos/cultura.jpg',
  Networking: '/demo-fotos/networking.jpg',
  Música: '/demo-fotos/musica.jpg',
  Gastronomía: '/demo-fotos/gastronomia.jpg',
  'Vida nocturna': '/demo-fotos/vida-nocturna.jpg',
  Juegos: '/demo-fotos/juegos.jpg',
  Bienestar: '/demo-fotos/bienestar.jpg',
};

// when: 'today' | 'sat' | 'sun' | número de días desde hoy. Hora local de Córdoba.
const PLANS = [
  {
    id: 'demo-cena',
    when: 'today',
    time: '21:00',
    title: 'Cena de recién llegados a Córdoba',
    category: 'Social',
    description:
      'Para quienes se mudaron hace poco y quieren armar grupo. Reservamos mesa larga en un bodegón de barrio Güemes; cada uno paga lo suyo.',
    spots_total: 8,
    spots_taken: 5,
    age_min: 23,
    age_max: 35,
    gender: 'indistinto',
    organizer: { name: 'Joaquín S.', initials: 'JS', rating: 4.7, reviews: 18 },
  },
  {
    id: 'demo-futbol',
    when: 1,
    time: '20:00',
    title: 'Fútbol 5 mixto · nivel intermedio',
    category: 'Deportes',
    description:
      'Cancha sintética en General Paz. Pagamos la cancha entre todos. Traé una remera clara y una oscura.',
    spots_total: 10,
    spots_taken: 7,
    age_min: 18,
    age_max: 40,
    gender: 'indistinto',
    organizer: { name: 'Martín G.', initials: 'MG', rating: 4.8, reviews: 23 },
  },
  {
    id: 'demo-juegos',
    when: 2,
    time: '19:30',
    title: 'Noche de juegos de mesa',
    category: 'Juegos',
    description:
      'Catan, Dixit, Codenames y más. Te explicamos las reglas, no hace falta saber jugar. Incluye café o limonada.',
    spots_total: 8,
    spots_taken: 5,
    age_min: 18,
    age_max: null,
    gender: 'indistinto',
    organizer: { name: 'Café Tablero', initials: 'CT', rating: 4.9, reviews: 112, business: true },
  },
  {
    id: 'demo-networking',
    when: 3,
    time: '19:00',
    title: 'After de emprendedores y freelancers',
    category: 'Networking',
    description:
      'Ronda de presentaciones de 1 minuto y después charla libre. Ideal para conocer gente que está armando algo en Córdoba.',
    spots_total: 20,
    spots_taken: 12,
    age_min: 22,
    age_max: 45,
    gender: 'indistinto',
    organizer: { name: 'Nodo Cowork', initials: 'NC', rating: 4.8, reviews: 64, business: true },
  },
  {
    id: 'demo-cata',
    when: 4,
    time: '20:30',
    title: 'Cata de vinos cordobeses y quesos',
    category: 'Gastronomía',
    description:
      'Probamos cinco vinos de bodegas de Córdoba con una tabla de quesos regionales. Guía un sommelier.',
    spots_total: 14,
    spots_taken: 13,
    age_min: 18,
    age_max: null,
    gender: 'indistinto',
    organizer: { name: 'La Cuadra Vinoteca', initials: 'LC', rating: 4.9, reviews: 87, business: true },
  },
  {
    id: 'demo-jazz',
    when: 5,
    time: '21:30',
    title: 'Jam de jazz abierta',
    category: 'Música',
    description: 'Si tocás, traé tu instrumento; si no, vení a escuchar. Hay batería y piano en el lugar.',
    spots_total: 6,
    spots_taken: 3,
    age_min: 18,
    age_max: null,
    gender: 'indistinto',
    organizer: { name: 'Nico P.', initials: 'NP', rating: 4.6, reviews: 9 },
  },
  {
    id: 'demo-trekking',
    when: 'sat',
    time: '07:30',
    title: 'Trekking a Los Gigantes',
    category: 'Aire libre',
    description:
      'Salimos en combi desde Plaza España y volvemos a la noche. Caminata de dificultad media, unas 5 horas. Llevá agua, protector solar y vianda.',
    spots_total: 12,
    spots_taken: 8,
    age_min: 20,
    age_max: 50,
    gender: 'indistinto',
    organizer: { name: 'Sofía L.', initials: 'SL', rating: 5.0, reviews: 31 },
  },
  {
    id: 'demo-museo',
    when: 'sat',
    time: '17:00',
    title: 'Recorrida por el Museo Caraffa + café',
    category: 'Cultura',
    description: 'Vemos la muestra temporaria con una guía y después seguimos la charla en un café del Parque Sarmiento.',
    spots_total: 8,
    spots_taken: 4,
    age_min: 18,
    age_max: null,
    gender: 'indistinto',
    organizer: { name: 'Valentina R.', initials: 'VR', rating: 4.9, reviews: 14 },
  },
  {
    id: 'demo-fiesta',
    when: 'sat',
    time: '23:30',
    title: 'Fiesta con DJ en una terraza de Nueva Córdoba',
    category: 'Vida nocturna',
    description: 'Previa en la terraza y después DJ hasta tarde. Nos encontramos en la puerta.',
    spots_total: 10,
    spots_taken: 10,
    age_min: 21,
    age_max: 35,
    gender: 'indistinto',
    organizer: { name: 'Agus F.', initials: 'AF', rating: 4.5, reviews: 7 },
  },
  {
    id: 'demo-yoga',
    when: 'sun',
    time: '18:00',
    title: 'Yoga al atardecer en el Parque Sarmiento',
    category: 'Bienestar',
    description: 'Clase para todos los niveles, entre mujeres. Traé mat (o una lona) y agua.',
    spots_total: 15,
    spots_taken: 9,
    age_min: 18,
    age_max: null,
    gender: 'femenino',
    organizer: { name: 'Lucía M.', initials: 'LM', rating: 4.9, reviews: 40 },
  },
];

// Argentina está en UTC-3 todo el año (sin horario de verano).
function cordobaInstant(isoDate, time) {
  return new Date(`${isoDate}T${time}:00-03:00`);
}

function planDate(when, now) {
  const today = toISODate(now);
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  // Mismo finde que el filtro "Este finde". Si hoy es domingo, el sábado ya pasó.
  const saturday = weekday === 0 ? today : toISODate(nextWeekendDate(now));
  if (when === 'today') return today;
  if (when === 'sat') return saturday;
  if (when === 'sun') return weekday === 0 ? today : toISODate(addDays(new Date(`${saturday}T12:00:00-03:00`), 1));
  return toISODate(addDays(now, when));
}

// Fechas siempre a futuro: si el horario de hoy ya pasó, el plan de "hoy" pasa a mañana y los
// demás a la semana siguiente.
function startsAt(plan, now) {
  let start = cordobaInstant(planDate(plan.when, now), plan.time);
  const bump = plan.when === 'today' ? 1 : 7;
  while (start.getTime() <= now.getTime() + 30 * MINUTE) start = addDays(start, bump);
  return start.toISOString();
}

export function buildDemoEvents(now = new Date()) {
  return PLANS.map(({ when, time, organizer, ...plan }) => ({
    ...plan,
    starts_at: startsAt({ when, time }, now),
    city: CITY,
    image_url: CATEGORY_IMAGES[plan.category],
    organizer_id: `demo-org-${organizer.initials.toLowerCase()}`,
    organizer_name: organizer.name,
    organizer_initials: organizer.initials,
    organizer_rating: organizer.rating,
    organizer_review_count: organizer.reviews,
    organizer_verified_business: Boolean(organizer.business),
  }));
}
