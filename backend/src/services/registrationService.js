import { HttpError } from '../utils/HttpError.js';
import {
  MIN_AGE,
  PERSON_GENDERS,
  ageOn,
  cleanName,
  isValidIsoDate,
  isValidPersonName,
  normalizeDni,
  todayInCordoba,
} from './declaredIdentity.js';

// Registro del MVP: crea la cuenta en Supabase Auth con los datos declarados. No consulta a ARCA.
// La cuenta queda habilitada cuando el usuario confirma el email.

const ERRORS = {
  invalid_input: [400, 'Revisá los datos ingresados.'],
  underage: [403, '+1 es solo para mayores de 18 años.'],
  invalid_birth_date: [400, 'La fecha de nacimiento no es válida.'],
  dni_taken: [409, 'Ese DNI ya está asociado a otra cuenta. Si es tuyo, escribinos.'],
  signup_failed: [502, 'No pudimos crear la cuenta. Probá de nuevo en unos minutos.'],
  // Códigos de Supabase Auth que se le pasan al frontend tal cual.
  captcha_failed: [400, 'No pudimos validar que no seas un robot. Probá de nuevo.'],
  weak_password: [422, 'La contraseña no cumple los requisitos de seguridad.'],
  email_address_invalid: [400, 'Ese email no es válido.'],
  email_address_not_authorized: [400, 'Todavía no podemos enviar emails a esa dirección.'],
  over_email_send_rate_limit: [429, 'Se enviaron demasiados emails. Esperá unos minutos y probá de nuevo.'],
  over_request_rate_limit: [429, 'Demasiados intentos. Esperá unos minutos y probá de nuevo.'],
  signup_disabled: [403, 'El registro está deshabilitado en este momento.'],
};

const AUTH_ERROR_CODES = [
  'captcha_failed', 'weak_password', 'email_address_invalid', 'email_address_not_authorized',
  'over_email_send_rate_limit', 'over_request_rate_limit', 'signup_disabled',
];

// Con la confirmación de email activada, Supabase no revela si el email ya existe. Si estuviera
// desactivada devolvería estos códigos: se responde igual que un alta, para no revelarlo tampoco.
const EXISTING_EMAIL_CODES = ['user_already_exists', 'email_exists'];

export function registrationError(code, message, field) {
  const [status, defaultMessage] = ERRORS[code];
  return new HttpError(status, code, message ?? defaultMessage, field);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Devuelve los datos normalizados, o HttpError con el campo que falló. Se validan en el orden del
// formulario y se informa el primero.
export function validateRegistration(body, now = new Date()) {
  const invalid = (field, message) => registrationError('invalid_input', message, field);

  const firstName = cleanName(body?.firstName);
  if (!firstName) throw invalid('firstName', 'Completá tu nombre.');
  if (!isValidPersonName(firstName)) throw invalid('firstName', 'El nombre solo puede tener letras, espacios, apóstrofes o guiones.');

  const lastName = cleanName(body?.lastName);
  if (!lastName) throw invalid('lastName', 'Completá tu apellido.');
  if (!isValidPersonName(lastName)) throw invalid('lastName', 'El apellido solo puede tener letras, espacios, apóstrofes o guiones.');

  const dni = normalizeDni(body?.dni);
  if (!dni) throw invalid('dni', 'Ingresá tu DNI: 7 u 8 números.');

  const birthDate = body?.birthDate;
  if (!isValidIsoDate(birthDate)) throw invalid('birthDate', 'Ingresá una fecha de nacimiento válida.');
  const today = todayInCordoba(now);
  if (birthDate > today) throw registrationError('invalid_birth_date', 'La fecha de nacimiento no puede ser futura.', 'birthDate');
  if (ageOn(birthDate, today) < MIN_AGE) throw registrationError('underage', undefined, 'birthDate');

  const gender = body?.gender;
  if (!PERSON_GENDERS.includes(gender)) throw invalid('gender', 'Elegí tu género.');

  const email = String(body?.email ?? '').trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) throw invalid('email', 'Ingresá un email válido.');

  // El resto de la política (minúscula, mayúscula, número, símbolo) la exige Supabase Auth
  // (weak_password). 72: límite de bcrypt.
  const password = body?.password;
  if (typeof password !== 'string' || password.length < 8 || password.length > 72) {
    throw invalid('password', 'La contraseña tiene que tener entre 8 y 72 caracteres.');
  }

  const captchaToken = body?.captchaToken;
  if (typeof captchaToken !== 'string' || !captchaToken) {
    throw invalid('captcha', 'Completá la verificación de seguridad.');
  }

  return { firstName, lastName, dni, birthDate, gender, email, password, captchaToken };
}

// deps: { model: { signUp(params) -> { error }, isDniAvailable(dni) }, now }
export async function registerAccount({ body, redirectTo }, { model, now = new Date() }) {
  const input = validateRegistration(body, now);

  // El trigger de la base (handle_new_user) guarda los datos declarados en la misma transacción
  // que crea el usuario, y los vuelve a validar (DNI único, 18+). Si falla, no se crea la cuenta
  // ni se envía el email. El DNI se controla recién después del CAPTCHA (que valida Supabase en
  // el signUp), para que no se pueda consultar qué DNIs están registrados sin resolverlo.
  const { error } = await model.signUp({
    email: input.email,
    password: input.password,
    captchaToken: input.captchaToken,
    redirectTo,
    declared: {
      first_name: input.firstName,
      last_name: input.lastName,
      dni: input.dni,
      birth_date: input.birthDate,
      gender: input.gender,
    },
  });

  if (!error || EXISTING_EMAIL_CODES.includes(error.code)) return;
  if (AUTH_ERROR_CODES.includes(error.code)) throw registrationError(error.code);

  // Supabase Auth responde 500 "Database error saving new user" cuando el trigger rechaza el
  // alta, sin decir por qué. Lo único que no se pudo validar antes es el DNI.
  if (error.status >= 500 && !(await model.isDniAvailable(input.dni))) {
    throw registrationError('dni_taken', undefined, 'dni');
  }

  console.error('[registro] Supabase Auth rechazó el alta:', error.status, error.code, error.message);
  throw registrationError('signup_failed');
}
