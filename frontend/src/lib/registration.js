// Validación del formulario de registro en el cliente. El backend (registrationService) y la base
// vuelven a exigir lo mismo: esto es para mostrar los errores por campo antes de enviar.
import { passwordMeetsRules } from './passwordPolicy.js';
import { PERSON_GENDERS } from './genders.js';

export const MIN_AGE = 18;
const TIME_ZONE = 'America/Argentina/Cordoba';

// Sin puntos, espacios ni ceros a la izquierda; null si no es un DNI de 7 u 8 dígitos.
export function normalizeDni(raw) {
  const digits = String(raw ?? '').replace(/[\s.]/g, '');
  if (!/^\d{7,9}$/.test(digits)) return null;
  const dni = digits.replace(/^0+/, '');
  return /^[1-9]\d{6,7}$/.test(dni) ? dni : null;
}

export function cleanName(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

// Letras (con tildes, ñ, ü...), espacios, apóstrofes, guiones y puntos. Empieza con letra.
export function isValidPersonName(name) {
  return name.length > 0 && name.length <= 100 && /^\p{L}[\p{L}\p{M}' ’.-]*$/u.test(name);
}

export function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function todayInCordoba(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(now);
}

// Años cumplidos a una fecha (ambas 'YYYY-MM-DD'), considerando día y mes.
export function ageOn(birthDate, onDate) {
  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [y, m, d] = onDate.split('-').map(Number);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

// Última fecha de nacimiento con la que hoy se tienen 18 (tope del selector de fecha).
export function latestAdultBirthDate(now = new Date()) {
  const [y, m, d] = todayInCordoba(now).split('-').map(Number);
  // 29/02 cuando hace 18 años no fue bisiesto: el último día válido es el 28.
  const day = Math.min(d, new Date(Date.UTC(y - MIN_AGE, m, 0)).getUTCDate());
  return `${y - MIN_AGE}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Devuelve { errors: { campo: mensaje }, values } con los datos normalizados.
export function validateRegistrationForm(form, now = new Date()) {
  const errors = {};

  const firstName = cleanName(form.firstName);
  if (!firstName) errors.firstName = 'Completá tu nombre.';
  else if (!isValidPersonName(firstName)) errors.firstName = 'Usá solo letras, espacios, apóstrofes o guiones.';

  const lastName = cleanName(form.lastName);
  if (!lastName) errors.lastName = 'Completá tu apellido.';
  else if (!isValidPersonName(lastName)) errors.lastName = 'Usá solo letras, espacios, apóstrofes o guiones.';

  const dni = normalizeDni(form.dni);
  if (!dni) errors.dni = 'Ingresá tu DNI: 7 u 8 números (podés usar puntos).';

  if (!isValidIsoDate(form.birthDate)) {
    errors.birthDate = 'Ingresá tu fecha de nacimiento.';
  } else {
    const today = todayInCordoba(now);
    if (form.birthDate > today) errors.birthDate = 'La fecha de nacimiento no puede ser futura.';
    else if (ageOn(form.birthDate, today) < MIN_AGE) errors.birthDate = '+1 es solo para mayores de 18 años.';
  }

  if (!PERSON_GENDERS.includes(form.gender)) errors.gender = 'Elegí tu género.';

  const email = String(form.email ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) errors.email = 'Ingresá un email válido.';

  if (!passwordMeetsRules(form.password ?? '')) errors.password = 'La contraseña no cumple todos los requisitos.';
  else if (form.password !== form.confirmPassword) errors.confirmPassword = 'Las contraseñas no coinciden.';

  return {
    errors,
    values: { firstName, lastName, dni, birthDate: form.birthDate, gender: form.gender, email, password: form.password },
  };
}
