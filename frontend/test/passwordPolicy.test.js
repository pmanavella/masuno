import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkPasswordRules, passwordMeetsRules, pwnedCount } from '../src/lib/passwordPolicy.js';

test('reglas: mínimo 8, minúscula, mayúscula, número y símbolo', () => {
  assert.ok(passwordMeetsRules('Abcdef1!'));
  assert.ok(!passwordMeetsRules('Abcde1!'), 'menos de 8');
  assert.ok(!passwordMeetsRules('abcdef1!'), 'sin mayúscula');
  assert.ok(!passwordMeetsRules('ABCDEF1!'), 'sin minúscula');
  assert.ok(!passwordMeetsRules('Abcdefg!'), 'sin número');
  assert.ok(!passwordMeetsRules('Abcdefg1'), 'sin símbolo');
  // Supabase no cuenta la ñ ni el espacio como símbolo.
  assert.ok(!passwordMeetsRules('Abcdef1ñ'));
  assert.ok(!passwordMeetsRules('Abcdef1 '));
  const failed = checkPasswordRules('abc').filter((r) => !r.ok).map((r) => r.id);
  assert.deepEqual(failed, ['length', 'upper', 'digit', 'symbol']);
});

// SHA-1 reales (calculados con shasum):
//   "Password123!"     = 49EFE F5F70D47ADC2DB2EB397FBEF5F7BC560E29
//   "Kx9#vTq2!mRw7zLp" = 43215 AE19B721FC91CE0BF99324232C36DF4F7CA
const LEAKED = { password: 'Password123!', prefix: '49EFE', suffix: 'F5F70D47ADC2DB2EB397FBEF5F7BC560E29' };
const RANDOM = { password: 'Kx9#vTq2!mRw7zLp', prefix: '43215', suffix: 'AE19B721FC91CE0BF99324232C36DF4F7CA' };

// Respuesta con el formato de la API: CRLF, sufijos en mayúsculas, y entradas de padding
// (conteo 0) que agrega Add-Padding. Incluye el sufijo filtrado entre otras líneas.
function hibpResponse(lines) {
  return [
    '000CEC9F4BFE450FE2C8CE6CAD02AE602E5:1',
    '001582BF6F166D24ABAF8AE34AB084F6C90:7',
    '0019B4C8017B8416FD878FE0B15087495C9:0',
    ...lines,
    'FFF2B6D06C9C0FEA1AB7ABB5DE5C3B7D1A0:3',
    'FFFD8C6CBEEA1E68DA2E2F2F0D0C2A1B9E0:0',
  ].join('\r\n');
}

function fakeHibp(body, status = 200) {
  const calls = [];
  const impl = async (url, options) => {
    calls.push({ url, options });
    return new Response(body, { status });
  };
  impl.calls = calls;
  return impl;
}

test('HIBP: contraseña filtrada real (Password123!) devuelve su conteo', async () => {
  const fetchImpl = fakeHibp(hibpResponse([`${LEAKED.suffix}:295389`]));
  assert.equal(await pwnedCount(LEAKED.password, { fetchImpl }), 295389);
});

test('HIBP: solo envía el prefijo de 5 caracteres de la contraseña recibida, con Add-Padding', async () => {
  const fetchImpl = fakeHibp(hibpResponse([]));
  await pwnedCount(RANDOM.password, { fetchImpl });
  await pwnedCount(LEAKED.password, { fetchImpl });
  assert.deepEqual(
    fetchImpl.calls.map((c) => c.url),
    [`https://api.pwnedpasswords.com/range/${RANDOM.prefix}`, `https://api.pwnedpasswords.com/range/${LEAKED.prefix}`]
  );
  assert.equal(fetchImpl.calls[0].options.headers['Add-Padding'], 'true');
  assert.deepEqual(Object.keys(fetchImpl.calls[0].options), ['headers'], 'sin body: la contraseña no viaja');
});

test('HIBP: contraseña no filtrada -> 0 aunque otras líneas tengan conteo', async () => {
  // La respuesta tiene líneas con conteo 7, 3 y 1: ninguna es su sufijo.
  const fetchImpl = fakeHibp(hibpResponse([`${LEAKED.suffix}:295389`]));
  assert.equal(await pwnedCount(RANDOM.password, { fetchImpl }), 0);
});

test('HIBP: la entrada de padding con su sufijo (conteo 0) no cuenta como filtrada', async () => {
  const fetchImpl = fakeHibp(hibpResponse([`${RANDOM.suffix}:0`]));
  assert.equal(await pwnedCount(RANDOM.password, { fetchImpl }), 0);
});

test('HIBP: compara el sufijo sin importar mayúsculas ni fin de línea', async () => {
  const fetchImpl = fakeHibp(`${LEAKED.suffix.toLowerCase()}:12\n`);
  assert.equal(await pwnedCount(LEAKED.password, { fetchImpl }), 12);
});

test('HIBP caído: null (no bloquea el registro)', async () => {
  assert.equal(await pwnedCount(LEAKED.password, { fetchImpl: fakeHibp('', 503) }), null);
  assert.equal(await pwnedCount(LEAKED.password, { fetchImpl: async () => { throw new TypeError('fetch failed'); } }), null);
});
