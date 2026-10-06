import { test } from 'node:test';
import assert from 'node:assert/strict';
import { latestAdultBirthDate, normalizeDni, validateRegistrationForm } from '../src/lib/registration.js';

// 2026-10-06 12:00 en Córdoba.
const NOW = new Date('2026-10-06T15:00:00Z');
const valid = {
  firstName: ' Lucía  Belén ',
  lastName: 'Martínez',
  dni: '30.123.456',
  birthDate: '1995-03-10',
  gender: 'femenino',
  email: 'Lucia@Test.com',
  password: 'Abcdef1!',
  confirmPassword: 'Abcdef1!',
};

test('datos válidos: sin errores y normalizados', () => {
  const { errors, values } = validateRegistrationForm(valid, NOW);
  assert.deepEqual(errors, {});
  assert.equal(values.firstName, 'Lucía Belén');
  assert.equal(values.dni, '30123456');
  assert.equal(values.email, 'lucia@test.com');
});

test('menor de 18, considerando día y mes', () => {
  assert.match(validateRegistrationForm({ ...valid, birthDate: '2008-10-07' }, NOW).errors.birthDate, /mayores de 18/);
  assert.equal(validateRegistrationForm({ ...valid, birthDate: '2008-10-06' }, NOW).errors.birthDate, undefined);
  assert.match(validateRegistrationForm({ ...valid, birthDate: '2026-10-07' }, NOW).errors.birthDate, /futura/);
  assert.equal(latestAdultBirthDate(NOW), '2008-10-06');
  assert.equal(latestAdultBirthDate(new Date('2026-02-28T15:00:00Z')), '2008-02-28');
});

test('DNI: 7 u 8 dígitos, con puntos o espacios, sin letras', () => {
  assert.equal(normalizeDni('1.234.567'), '1234567');
  assert.equal(normalizeDni(' 30 123 456 '), '30123456');
  for (const dni of ['3012345a', '123456', '123456789', '']) {
    assert.ok(validateRegistrationForm({ ...valid, dni }, NOW).errors.dni, dni);
  }
});

test('errores por campo', () => {
  const { errors } = validateRegistrationForm(
    { ...valid, firstName: '', lastName: 'P3rez', gender: 'indistinto', email: 'x', password: 'abc' },
    NOW
  );
  assert.deepEqual(Object.keys(errors).sort(), ['email', 'firstName', 'gender', 'lastName', 'password']);
  assert.ok(validateRegistrationForm({ ...valid, confirmPassword: 'otra' }, NOW).errors.confirmPassword);
});
