import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateNewEvent, mapRpcError, reasonMessage, isUuid } from '../src/services/eventService.js';
import { HttpError } from '../src/utils/HttpError.js';

const NOW = new Date('2026-09-28T12:00:00Z');
const valid = {
  title: '  Fútbol   5 mixto ',
  description: 'Cancha techada',
  category: 'Deportes',
  startsAt: '2026-10-01T22:00:00.000Z',
  spotsTotal: '10',
  ageMin: '20',
  ageMax: '',
  gender: 'no_binario',
};

function expectInvalid(body, pattern) {
  assert.throws(() => validateNewEvent(body, NOW), (err) => {
    assert.equal(err.code, 'invalid_input');
    if (pattern) assert.match(err.message, pattern);
    return true;
  });
}

describe('validateNewEvent', () => {
  test('normaliza un evento válido; sin edad máxima = null', () => {
    assert.deepEqual(validateNewEvent(valid, NOW), {
      title: 'Fútbol 5 mixto',
      description: 'Cancha techada',
      category: 'Deportes',
      city: 'Córdoba Capital',
      starts_at: '2026-10-01T22:00:00.000Z',
      spots_total: 10,
      age_min: 20,
      age_max: null,
      gender: 'no_binario',
    });
  });

  test('defaults: edad mínima 18 y género indistinto', () => {
    const { age_min, gender } = validateNewEvent({ ...valid, ageMin: undefined, gender: undefined }, NOW);
    assert.equal(age_min, 18);
    assert.equal(gender, 'indistinto');
  });

  test('acepta los cuatro géneros', () => {
    for (const gender of ['indistinto', 'masculino', 'femenino', 'no_binario']) {
      assert.equal(validateNewEvent({ ...valid, gender }, NOW).gender, gender);
    }
  });

  test('rechaza datos inválidos', () => {
    expectInvalid({ ...valid, title: 'ab' }, /título/);
    expectInvalid({ ...valid, category: 'Otra' }, /categoría/);
    expectInvalid({ ...valid, startsAt: '2026-09-28T11:00:00Z' }, /futura/);
    expectInvalid({ ...valid, startsAt: 'mañana' }, /fecha/);
    expectInvalid({ ...valid, spotsTotal: '0' }, /cupos/);
    expectInvalid({ ...valid, spotsTotal: '2.5' }, /cupos/);
    expectInvalid({ ...valid, ageMin: '17' }, /mínima/);
    expectInvalid({ ...valid, ageMin: '30', ageMax: '25' }, /máxima/);
    expectInvalid({ ...valid, ageMax: 'abc' }, /máxima/);
    expectInvalid({ ...valid, gender: 'Femenino' }, /para quién/);
    expectInvalid(undefined);
  });
});

describe('errores de las funciones SQL', () => {
  test('los códigos conocidos pasan a HttpError con mensaje en español', () => {
    const err = mapRpcError({ message: 'full', code: 'P0001' });
    assert.ok(err instanceof HttpError);
    assert.equal(err.status, 409);
    assert.equal(err.message, 'No quedan lugares.');
    assert.equal(mapRpcError({ message: 'gender' }).status, 403);
  });

  test('los errores desconocidos se propagan tal cual', () => {
    const original = { message: 'connection refused' };
    assert.equal(mapRpcError(original), original);
  });

  test('reasonMessage: null si puede unirse', () => {
    assert.equal(reasonMessage('ok'), null);
    assert.equal(reasonMessage('age'), 'Este evento es para otra franja de edad.');
  });

  test('isUuid', () => {
    assert.ok(isUuid('e0000000-0000-0000-0000-000000000001'));
    assert.ok(!isUuid('1; drop table events'));
  });
});
