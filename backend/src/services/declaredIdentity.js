// Normalización y reglas de los datos personales que el usuario declara al registrarse.
// Las mismas reglas las vuelve a exigir la base (private.declared_identities).

// Mismos valores que private.declared_identities.gender (sin 'indistinto', que es de eventos).
export const PERSON_GENDERS = ['masculino', 'femenino', 'no_binario'];
export const MIN_AGE = 18;
const TIME_ZONE = 'America/Argentina/Cordoba';
const MAX_NAME_LENGTH = 100;

// DNI sin puntos, espacios ni ceros a la izquierda; null si no es un DNI válido (7 u 8 dígitos).
export function normalizeDni(raw) {
  const digits = String(raw ?? '').replace(/[\s.]/g, '');
  if (!/^\d{7,9}$/.test(digits)) return null;
  const dni = digits.replace(/^0+/, '');
  return /^[1-9]\d{6,7}$/.test(dni) ? dni : null;
}

export function cleanName(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

// Letras (con tildes, ñ, ü...), espacios, apóstrofes, guiones y puntos: "María José",
// "D'Angelo", "Ruiz-Díaz". Empieza con letra. Recibe el nombre ya pasado por cleanName.
export function isValidPersonName(name) {
  return name.length > 0 && name.length <= MAX_NAME_LENGTH && /^\p{L}[\p{L}\p{M}' ’.-]*$/u.test(name);
}

export function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function todayInCordoba(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(now);
}

// Años cumplidos a una fecha (ambas 'YYYY-MM-DD'), igual que private.age_years en la base:
// considera día y mes, no solo la resta de años.
export function ageOn(birthDate, onDate) {
  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [y, m, d] = onDate.split('-').map(Number);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}
