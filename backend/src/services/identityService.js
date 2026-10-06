import { HttpError } from '../utils/HttpError.js';
import { ArcaUnavailableError } from './arca/index.js';
import {
  MIN_AGE,
  PERSON_GENDERS,
  ageOn,
  cleanName,
  isValidIsoDate,
  normalizeDni,
  todayInCordoba,
} from './declaredIdentity.js';

// Verificación de identidad contra ARCA (etapa futura). Solo se usa con ARCA_ENABLED=true.

// Códigos que puede devolver POST /api/identity/verify. Los de mismatch no dicen qué campo
// falló, a propósito: el formulario no tiene que servir para averiguar datos de terceros.
const ERRORS = {
  invalid_input: [400, 'Revisá los datos ingresados.'],
  underage: [403, '+1 es solo para mayores de 18 años.'],
  already_verified: [409, 'Tu identidad ya está verificada.'],
  dni_taken: [409, 'Ese DNI ya está asociado a otra cuenta.'],
  rate_limited: [429, 'Superaste la cantidad de intentos. Probá de nuevo más tarde.'],
  identity_mismatch: [422, 'Los datos no coinciden con los registros de ARCA. Revisá que estén igual que en tu DNI.'],
  identity_ambiguous: [422, 'No pudimos verificar tu identidad automáticamente. Escribinos para revisarla.'],
  invalid_birth_date: [400, 'La fecha de nacimiento no es válida.'],
  arca_unavailable: [503, 'No pudimos consultar a ARCA en este momento. Probá de nuevo en unos minutos.'],
};

export function identityError(code) {
  const [status, message] = ERRORS[code];
  return new HttpError(status, code, message);
}

// Mayúsculas, sin tildes ni signos: "Lucía  Belén" -> ['LUCIA', 'BELEN'], "Muñoz" -> ['MUNOZ'].
export function nameTokens(name) {
  return String(name ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

// Coincide si todo lo que escribió el usuario está en el nombre oficial (puede omitir un
// segundo nombre o apellido, pero no agregar ni cambiar ninguno).
export function namesMatch(input, official) {
  const inputTokens = nameTokens(input);
  const officialTokens = new Set(nameTokens(official));
  return inputTokens.length > 0 && inputTokens.every((token) => officialTokens.has(token));
}

export function validateInput(body, now = new Date()) {
  const dni = normalizeDni(body?.dni);
  const firstName = cleanName(body?.firstName);
  const lastName = cleanName(body?.lastName);
  const birthDate = body?.birthDate;
  const gender = body?.gender;

  const valid =
    dni &&
    nameTokens(firstName).length > 0 && firstName.length <= 100 &&
    nameTokens(lastName).length > 0 && lastName.length <= 100 &&
    isValidIsoDate(birthDate) &&
    PERSON_GENDERS.includes(gender);
  if (!valid) throw identityError('invalid_input');

  const today = todayInCordoba(now);
  if (birthDate > today) throw identityError('invalid_birth_date');
  if (ageOn(birthDate, today) < MIN_AGE) throw identityError('underage');

  return { dni, firstName, lastName, birthDate, gender };
}

// deps: { arca, model, maxAttempts, attemptWindowMinutes, now }
// model: isVerified(token), consumeAttempt(userId, max, window), isDniAvailable(dni, userId),
//        save(identity), getMine(token)
export async function verifyIdentity({ userId, accessToken, body }, deps) {
  const { arca, model, maxAttempts = 5, attemptWindowMinutes = 1440, now = new Date() } = deps;

  // Lo que no toca datos de nadie (formato, edad declarada) no consume intentos.
  const input = validateInput(body, now);

  if (await model.isVerified(accessToken)) throw identityError('already_verified');

  // Antes de revelar si un DNI ya está tomado o de consultar a ARCA.
  if (!(await model.consumeAttempt(userId, maxAttempts, attemptWindowMinutes))) {
    throw identityError('rate_limited');
  }

  if (!(await model.isDniAvailable(input.dni, userId))) throw identityError('dni_taken');

  let persons;
  try {
    persons = await arca.findPersonsByDni(input.dni);
  } catch (err) {
    if (err instanceof ArcaUnavailableError) {
      console.error('[identity] ARCA no disponible:', err.message);
      throw identityError('arca_unavailable');
    }
    throw err;
  }

  // Un DNI puede tener varios CUIL (p. ej. números de documento duplicados): se busca el
  // que coincide con los datos ingresados, entre personas físicas activas y no fallecidas.
  const matches = persons.filter(
    (p) =>
      p.personType === 'FISICA' &&
      p.keyStatus === 'ACTIVO' &&
      !p.deceased &&
      p.birthDate === input.birthDate &&
      namesMatch(input.firstName, p.firstName) &&
      namesMatch(input.lastName, p.lastName)
  );

  if (matches.length === 0) throw identityError('identity_mismatch');
  if (matches.length > 1) throw identityError('identity_ambiguous');

  const [match] = matches;
  if (ageOn(match.birthDate, todayInCordoba(now)) < MIN_AGE) throw identityError('underage');

  // Se guarda el nombre como lo escribió el usuario (con tildes), ya validado contra ARCA.
  await model.save({
    userId,
    dni: input.dni,
    cuil: match.cuil,
    firstName: input.firstName,
    lastName: input.lastName,
    birthDate: match.birthDate,
    gender: input.gender,
    source: arca.source,
  });

  return model.getMine(accessToken);
}
