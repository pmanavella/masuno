import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { registerAccount, validateRegistration } from '../src/services/registrationService.js';
import { isValidPersonName } from '../src/services/declaredIdentity.js';

// 2026-10-06 12:00 en Córdoba.
const NOW = new Date('2026-10-06T15:00:00Z');

const valid = {
  firstName: '  María   José ',
  lastName: "D'Angelo Ruiz-Díaz",
  dni: '30.123.456',
  birthDate: '1995-03-10',
  gender: 'femenino',
  email: ' Maria@Example.com ',
  password: 'Abcdef1!',
  captchaToken: 'tok',
};

function fakeModel({ signUpError = null, dniAvailable = true } = {}) {
  const calls = { signUp: [], dniChecks: [] };
  return {
    calls,
    signUp: async (params) => {
      calls.signUp.push(params);
      return { error: signUpError };
    },
    isDniAvailable: async (dni) => {
      calls.dniChecks.push(dni);
      return dniAvailable;
    },
  };
}

async function expectCode(promise, code, field) {
  await assert.rejects(promise, (err) => {
    assert.equal(err.code, code);
    if (field) assert.equal(err.field, field);
    return true;
  });
}

function register(body, model = fakeModel()) {
  return registerAccount({ body, redirectTo: 'http://localhost:5173/' }, { model, now: NOW });
}

describe('registro: datos válidos', () => {
  test('mayor de 18 con datos válidos: crea la cuenta en Supabase Auth con los datos normalizados', async () => {
    const model = fakeModel();
    await register(valid, model);
    assert.deepEqual(model.calls.signUp, [
      {
        email: 'maria@example.com',
        password: 'Abcdef1!',
        captchaToken: 'tok',
        redirectTo: 'http://localhost:5173/',
        declared: {
          first_name: 'María José',
          last_name: "D'Angelo Ruiz-Díaz",
          dni: '30123456',
          birth_date: '1995-03-10',
          gender: 'femenino',
        },
      },
    ]);
    // El DNI como string, nunca como número.
    assert.equal(typeof model.calls.signUp[0].declared.dni, 'string');
  });

  test('acepta exactamente los tres géneros de persona del proyecto', () => {
    for (const gender of ['masculino', 'femenino', 'no_binario']) {
      assert.equal(validateRegistration({ ...valid, gender }, NOW).gender, gender);
    }
    for (const gender of ['indistinto', 'Femenino', 'otro', undefined]) {
      assert.throws(() => validateRegistration({ ...valid, gender }, NOW), (err) => err.field === 'gender');
    }
  });

  test('email existente: misma respuesta que un alta (no se revela)', async () => {
    await register(valid, fakeModel({ signUpError: { status: 422, code: 'user_already_exists', message: 'User already registered' } }));
  });
});

describe('registro: edad', () => {
  test('menor de 18: underage, sin llamar a Supabase', async () => {
    const model = fakeModel();
    await expectCode(register({ ...valid, birthDate: '2010-01-01' }, model), 'underage', 'birthDate');
    assert.equal(model.calls.signUp.length, 0);
  });

  test('considera día y mes, no solo el año', async () => {
    // Cumple 18 mañana (2026-10-07): todavía tiene 17.
    await expectCode(register({ ...valid, birthDate: '2008-10-07' }), 'underage');
    // Cumple 18 hoy: entra.
    await register({ ...valid, birthDate: '2008-10-06' });
    // Mismo año que el límite pero cumplió en enero: entra.
    await register({ ...valid, birthDate: '2008-01-15' });
  });

  test('fecha futura o inexistente', async () => {
    await expectCode(register({ ...valid, birthDate: '2026-10-07' }), 'invalid_birth_date', 'birthDate');
    await expectCode(register({ ...valid, birthDate: '1995-02-30' }), 'invalid_input', 'birthDate');
    await expectCode(register({ ...valid, birthDate: '10/03/1995' }), 'invalid_input', 'birthDate');
    await expectCode(register({ ...valid, birthDate: undefined }), 'invalid_input', 'birthDate');
  });
});

describe('registro: DNI', () => {
  test('DNI inválido: invalid_input en el campo dni, sin llamar a Supabase', async () => {
    const model = fakeModel();
    for (const dni of ['3012345a', '123456', '123456789', '', undefined, '30-123-456', 30123456.5]) {
      await expectCode(register({ ...valid, dni }, model), 'invalid_input', 'dni');
    }
    assert.equal(model.calls.signUp.length, 0);
  });

  test('normaliza puntos y espacios; acepta 7 u 8 dígitos', () => {
    assert.equal(validateRegistration({ ...valid, dni: ' 30 123 456 ' }, NOW).dni, '30123456');
    assert.equal(validateRegistration({ ...valid, dni: '1.234.567' }, NOW).dni, '1234567');
  });

  test('DNI duplicado: la base rechaza el alta y se responde dni_taken sin datos de la otra cuenta', async () => {
    const model = fakeModel({
      signUpError: { status: 500, code: 'unexpected_failure', message: 'Database error saving new user' },
      dniAvailable: false,
    });
    await assert.rejects(register(valid, model), (err) => {
      assert.equal(err.code, 'dni_taken');
      assert.equal(err.status, 409);
      assert.equal(err.field, 'dni');
      assert.doesNotMatch(err.message, /@|30123456/);
      return true;
    });
    assert.deepEqual(model.calls.dniChecks, ['30123456']);
  });

  test('otro error de la base (DNI libre): signup_failed genérico', async () => {
    const model = fakeModel({ signUpError: { status: 500, code: 'unexpected_failure', message: 'Database error saving new user' } });
    await expectCode(register(valid, model), 'signup_failed');
  });
});

describe('registro: otros campos y errores de Supabase', () => {
  test('nombre y apellido: obligatorios, con caracteres razonables', async () => {
    await expectCode(register({ ...valid, firstName: '   ' }), 'invalid_input', 'firstName');
    await expectCode(register({ ...valid, lastName: '' }), 'invalid_input', 'lastName');
    await expectCode(register({ ...valid, firstName: 'Juan2' }), 'invalid_input', 'firstName');
    await expectCode(register({ ...valid, lastName: '<script>' }), 'invalid_input', 'lastName');
    for (const name of ['Lucía', 'Ñandú', 'Müller', "O'Connor", 'Ruiz-Díaz', 'María José', 'Jr.']) {
      assert.ok(isValidPersonName(name), name);
    }
  });

  test('email, contraseña y captcha', async () => {
    await expectCode(register({ ...valid, email: 'no-es-email' }), 'invalid_input', 'email');
    await expectCode(register({ ...valid, password: 'corta' }), 'invalid_input', 'password');
    await expectCode(register({ ...valid, captchaToken: '' }), 'invalid_input', 'captcha');
  });

  test('los códigos de Supabase Auth se pasan al frontend', async () => {
    for (const code of ['captcha_failed', 'weak_password', 'over_email_send_rate_limit']) {
      await expectCode(register(valid, fakeModel({ signUpError: { status: 400, code, message: code } })), code);
    }
  });
});
