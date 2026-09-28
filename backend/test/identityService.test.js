import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeDni,
  namesMatch,
  ageOn,
  isValidIsoDate,
  verifyIdentity,
} from '../src/services/identityService.js';
import { MockArcaClient } from '../src/services/arca/MockArcaClient.js';
import { ArcaClient } from '../src/services/arca/ArcaClient.js';

function fakeModel({ verified = false, attemptsOk = true, dniAvailable = true } = {}) {
  const calls = { consume: 0, save: [] };
  return {
    calls,
    isVerified: async () => verified,
    consumeAttempt: async () => {
      calls.consume += 1;
      return attemptsOk;
    },
    isDniAvailable: async () => dniAvailable,
    save: async (identity) => calls.save.push(identity),
    getMine: async () => ({ dni_masked: '*****456' }),
  };
}

function yearsAgo(years) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 10);
}

const lucia = {
  dni: '30.123.456',
  firstName: 'Lucía',
  lastName: 'Martínez',
  birthDate: '1995-03-10',
  gender: 'femenino',
};

async function verify(body, { model = fakeModel(), arca = new MockArcaClient({ nodeEnv: 'test' }) } = {}) {
  const result = await verifyIdentity({ userId: 'u1', accessToken: 't', body }, { arca, model });
  return { result, model };
}

async function expectCode(promise, code) {
  await assert.rejects(promise, (err) => {
    assert.equal(err.code, code);
    return true;
  });
}

describe('normalización y comparación', () => {
  test('normalizeDni', () => {
    assert.equal(normalizeDni('30.123.456'), '30123456');
    assert.equal(normalizeDni(' 030123456 '), '30123456');
    assert.equal(normalizeDni('1234567'), '1234567');
    assert.equal(normalizeDni('123456'), null);
    assert.equal(normalizeDni('123456789'), null);
    assert.equal(normalizeDni('3012345a'), null);
    assert.equal(normalizeDni(undefined), null);
  });

  test('namesMatch ignora tildes, mayúsculas y permite omitir un segundo nombre', () => {
    assert.ok(namesMatch('Lucía', 'LUCIA BELEN'));
    assert.ok(namesMatch('lucia  belén', 'LUCIA BELEN'));
    assert.ok(namesMatch('Muñoz', 'MUNOZ'));
    assert.ok(namesMatch("D'Angelo", 'D ANGELO'));
    assert.ok(!namesMatch('Lucía María', 'LUCIA BELEN'));
    assert.ok(!namesMatch('Luci', 'LUCIA BELEN'));
    assert.ok(!namesMatch('  ', 'LUCIA'));
  });

  test('ageOn coincide con age() de Postgres (incluye 29 de febrero)', () => {
    assert.equal(ageOn('2008-09-28', '2026-09-27'), 17);
    assert.equal(ageOn('2008-09-27', '2026-09-27'), 18);
    assert.equal(ageOn('2008-02-29', '2026-02-28'), 17);
    assert.equal(ageOn('2008-02-29', '2026-03-01'), 18);
  });

  test('isValidIsoDate rechaza fechas inexistentes', () => {
    assert.ok(isValidIsoDate('1995-03-10'));
    assert.ok(!isValidIsoDate('1995-02-30'));
    assert.ok(!isValidIsoDate('10/03/1995'));
  });
});

describe('verifyIdentity con ARCA mock', () => {
  test('adulta válida: guarda CUIL de ARCA y nombre como lo escribió', async () => {
    const { result, model } = await verify(lucia);
    assert.deepEqual(result, { dni_masked: '*****456' });
    assert.deepEqual(model.calls.save, [
      {
        userId: 'u1',
        dni: '30123456',
        cuil: '27301234568',
        firstName: 'Lucía',
        lastName: 'Martínez',
        birthDate: '1995-03-10',
        gender: 'femenino',
        source: 'mock',
      },
    ]);
  });

  test('el género es autopercibido: no se compara con ARCA', async () => {
    const { model } = await verify({ ...lucia, gender: 'no_binario' });
    assert.equal(model.calls.save[0].gender, 'no_binario');
  });

  test('menor de 18 declarado: underage sin consumir intentos ni consultar ARCA', async () => {
    const model = fakeModel();
    await expectCode(
      verify({ dni: '45111222', firstName: 'Tomás', lastName: 'Giménez', birthDate: yearsAgo(17), gender: 'masculino' }, { model }),
      'underage'
    );
    assert.equal(model.calls.consume, 0);
  });

  test('menor que declara otra fecha: no coincide con ARCA', async () => {
    await expectCode(
      verify({ dni: '45111222', firstName: 'Tomás', lastName: 'Giménez', birthDate: '2000-01-01', gender: 'masculino' }),
      'identity_mismatch'
    );
  });

  test('DNI con dos CUIL: elige el que coincide con los datos', async () => {
    const juan = await verify({ dni: '28999888', firstName: 'Juan', lastName: 'Pérez', birthDate: '1980-07-21', gender: 'masculino' });
    assert.equal(juan.model.calls.save[0].cuil, '20289998889');
    const maria = await verify({ dni: '28999888', firstName: 'María Inés', lastName: 'Gómez', birthDate: '1976-11-02', gender: 'femenino' });
    assert.equal(maria.model.calls.save[0].cuil, '27289998883');
  });

  test('ARCA caído: arca_unavailable', async () => {
    await expectCode(verify({ ...lucia, dni: '99999999' }), 'arca_unavailable');
  });

  test('datos que no coinciden o DNI inexistente: identity_mismatch', async () => {
    await expectCode(verify({ ...lucia, birthDate: '1995-03-11' }), 'identity_mismatch');
    await expectCode(verify({ ...lucia, lastName: 'Martínez López' }), 'identity_mismatch');
    await expectCode(verify({ ...lucia, dni: '11222333' }), 'identity_mismatch');
  });

  test('ya verificado, sin intentos o DNI tomado', async () => {
    const verifiedModel = fakeModel({ verified: true });
    await expectCode(verify(lucia, { model: verifiedModel }), 'already_verified');
    assert.equal(verifiedModel.calls.consume, 0);
    await expectCode(verify(lucia, { model: fakeModel({ attemptsOk: false }) }), 'rate_limited');
    await expectCode(verify(lucia, { model: fakeModel({ dniAvailable: false }) }), 'dni_taken');
  });

  test('datos inválidos: invalid_input / invalid_birth_date', async () => {
    await expectCode(verify({ ...lucia, gender: 'otro' }), 'invalid_input');
    await expectCode(verify({ ...lucia, birthDate: '1995-02-30' }), 'invalid_input');
    await expectCode(verify({ ...lucia, firstName: ' ' }), 'invalid_input');
    await expectCode(verify({ ...lucia, dni: '123' }), 'invalid_input');
    await expectCode(verify({ ...lucia, birthDate: '2999-01-01' }), 'invalid_birth_date');
    await expectCode(verify(undefined), 'invalid_input');
  });
});

describe('verifyIdentity con respuestas de ARCA poco comunes', () => {
  class FixedArca extends ArcaClient {
    constructor(persons) {
      super();
      this.persons = persons;
    }
    async getIdPersonaListByDocumento() {
      return this.persons.map((p) => p.cuil);
    }
    async getPersona(cuil) {
      return this.persons.find((p) => p.cuil === cuil);
    }
  }
  const base = { firstName: 'LUCIA', lastName: 'MARTINEZ', birthDate: '1995-03-10', personType: 'FISICA', keyStatus: 'ACTIVO', deceased: false };

  test('dos CUIL que coinciden: identity_ambiguous', async () => {
    const arca = new FixedArca([{ ...base, cuil: '27301234568' }, { ...base, cuil: '27301234560' }]);
    await expectCode(verify(lucia, { arca }), 'identity_ambiguous');
  });

  test('clave inactiva, persona jurídica o fallecida: identity_mismatch', async () => {
    for (const override of [{ keyStatus: 'INACTIVO' }, { personType: 'JURIDICA' }, { deceased: true }]) {
      await expectCode(verify(lucia, { arca: new FixedArca([{ ...base, cuil: '27301234568', ...override }]) }), 'identity_mismatch');
    }
  });
});

describe('modo mock', () => {
  test('se niega a correr con NODE_ENV=production', () => {
    assert.throws(() => new MockArcaClient({ nodeEnv: 'production' }), /no está permitido/);
  });
});
