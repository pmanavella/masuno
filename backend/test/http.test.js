import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Pruebas HTTP contra la app Express real, sin red: Supabase y los modelos se reemplazan por
// stubs. Sin ninguna variable de ARCA (ARCA_ENABLED sin definir = deshabilitado).
for (const name of Object.keys(process.env)) {
  if (name.startsWith('ARCA_')) delete process.env[name];
}
process.env.SUPABASE_URL = 'http://supabase.invalid';
process.env.SUPABASE_ANON_KEY = 'anon-test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-test';

const { default: app } = await import('../src/app.js');
const { supabaseAnon } = await import('../src/config/supabaseClient.js');
const { EventModel } = await import('../src/models/EventModel.js');
const { RequestModel } = await import('../src/models/RequestModel.js');
const { AccountModel } = await import('../src/models/AccountModel.js');
const { RealArcaClient } = await import('../src/services/arca/RealArcaClient.js');

const USERS = {
  confirmed: { id: 'u-confirmed', email: 'ok@test', email_confirmed_at: '2026-10-01T00:00:00Z' },
  unconfirmed: { id: 'u-unconfirmed', email: 'pending@test', email_confirmed_at: null },
};
const EVENT_ID = 'e0000000-0000-0000-0000-000000000001';
const REQUEST_ID = 'a0000000-0000-0000-0000-000000000001';
const EVENT = { id: EVENT_ID, title: 'Fútbol', organizer_id: 'someone-else', starts_at: '2026-12-01T22:00:00Z' };

// Registro de llamadas a los stubs y a cualquier cosa de ARCA.
let calls;
const realFetch = globalThis.fetch;
let server;
let baseUrl;

before(async () => {
  // El token es el nombre del usuario de prueba.
  supabaseAnon.auth.getUser = async (token) =>
    USERS[token] ? { data: { user: USERS[token] }, error: null } : { data: { user: null }, error: new Error('invalid') };

  const record = (name, result) => async (...args) => {
    calls.models.push(name);
    return typeof result === 'function' ? result(...args) : result;
  };
  EventModel.list = record('EventModel.list', [EVENT]);
  EventModel.listCities = record('EventModel.listCities', ['Córdoba Capital']);
  EventModel.getById = record('EventModel.getById', EVENT);
  EventModel.create = record('EventModel.create', (fields) => ({ id: 'new-event', ...fields }));
  EventModel.listOrganized = record('EventModel.listOrganized', []);
  RequestModel.requestToJoin = record('RequestModel.requestToJoin', 'new-request');
  RequestModel.canJoin = record('RequestModel.canJoin', 'ok');
  RequestModel.getMine = record('RequestModel.getMine', null);
  RequestModel.respond = record('RequestModel.respond', 'accepted');
  AccountModel.signUp = record('AccountModel.signUp', { error: null });
  AccountModel.isDniAvailable = record('AccountModel.isDniAvailable', true);

  // Cualquier uso de RealArcaClient o un fetch a ARCA queda registrado.
  for (const method of ['findPersonsByDni', 'getIdPersonaListByDocumento', 'getPersona', 'getTicket', 'requestTicket', 'callA13', 'soap']) {
    RealArcaClient.prototype[method] = async () => {
      calls.arca.push(method);
      throw new Error('ARCA no debería usarse');
    };
  }
  globalThis.fetch = async (url, options) => {
    if (/afip|arca/i.test(String(url))) calls.arca.push(`fetch ${url}`);
    return realFetch(url, options);
  };

  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server?.close();
  globalThis.fetch = realFetch;
});

beforeEach(() => {
  calls = { models: [], arca: [] };
});

async function api(method, path, { token, body } = {}) {
  const res = await realFetch(`${baseUrl}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

const newEvent = {
  title: 'Asado',
  category: 'Social',
  startsAt: '2099-01-01T22:00:00.000Z',
  spotsTotal: 5,
};

describe('usuario no autenticado', () => {
  test('puede navegar: listado, ciudades, filtros y detalle', async () => {
    const list = await api('GET', '/events?city=C%C3%B3rdoba%20Capital&categories=Social,Deportes&gender=femenino&ageMin=20');
    assert.equal(list.status, 200);
    assert.equal(list.body[0].id, EVENT_ID);
    assert.equal((await api('GET', '/events/cities')).status, 200);
    const detail = await api('GET', `/events/${EVENT_ID}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.viewer, null);
  });

  test('no puede ejecutar acciones protegidas', async () => {
    const protectedCalls = [
      ['POST', '/events', newEvent],
      ['POST', `/events/${EVENT_ID}/requests`],
      ['GET', '/events/organized'],
      ['GET', '/requests/mine'],
      ['POST', `/requests/${REQUEST_ID}/respond`, { accept: true }],
      ['POST', `/requests/${REQUEST_ID}/cancel`],
      ['GET', '/notifications'],
      ['GET', '/profile'],
      ['PUT', '/profile', { phone: '351' }],
    ];
    for (const [method, path, body] of protectedCalls) {
      assert.equal((await api(method, path, { body })).status, 401, `${method} ${path}`);
      assert.equal((await api(method, path, { body, token: 'token-falso' })).status, 401, `${method} ${path} con token inválido`);
    }
    assert.deepEqual(calls.models, []);
  });
});

describe('email sin confirmar', () => {
  test('no puede crear eventos', async () => {
    const res = await api('POST', '/events', { token: 'unconfirmed', body: newEvent });
    assert.equal(res.status, 403);
    assert.equal(res.body.code, 'email_not_confirmed');
    assert.ok(!calls.models.includes('EventModel.create'));
  });

  test('no puede anotarse a un evento', async () => {
    const res = await api('POST', `/events/${EVENT_ID}/requests`, { token: 'unconfirmed' });
    assert.equal(res.status, 403);
    assert.equal(res.body.code, 'email_not_confirmed');
    assert.ok(!calls.models.includes('RequestModel.requestToJoin'));
  });

  test('tampoco puede responder solicitudes ni ver lo privado', async () => {
    for (const [method, path, body] of [
      ['POST', `/requests/${REQUEST_ID}/respond`, { accept: true }],
      ['GET', '/events/organized'],
      ['GET', '/notifications'],
    ]) {
      const res = await api(method, path, { token: 'unconfirmed', body });
      assert.equal(res.status, 403, `${method} ${path}`);
      assert.equal(res.body.code, 'email_not_confirmed');
    }
  });
});

describe('email confirmado (sin identidad ARCA)', () => {
  test('puede crear eventos', async () => {
    const res = await api('POST', '/events', { token: 'confirmed', body: newEvent });
    assert.equal(res.status, 201);
    assert.equal(res.body.title, 'Asado');
    assert.ok(calls.models.includes('EventModel.create'));
  });

  test('puede anotarse a un evento', async () => {
    const res = await api('POST', `/events/${EVENT_ID}/requests`, { token: 'confirmed' });
    assert.equal(res.status, 201);
    assert.deepEqual(res.body, { id: 'new-request', status: 'pending' });
  });

  test('puede aceptar solicitudes y ver el detalle con su estado', async () => {
    assert.equal((await api('POST', `/requests/${REQUEST_ID}/respond`, { token: 'confirmed', body: { accept: true } })).status, 200);
    const detail = await api('GET', `/events/${EVENT_ID}`, { token: 'confirmed' });
    assert.equal(detail.body.viewer.canJoin, 'ok');
  });
});

describe('registro (POST /api/auth/register)', () => {
  const body = {
    firstName: 'Lucía',
    lastName: 'Martínez',
    dni: '30.123.456',
    birthDate: '1995-03-10',
    gender: 'femenino',
    email: 'lucia@test.com',
    password: 'Abcdef1!',
    captchaToken: 'tok',
  };

  test('datos válidos: 201 y la confirmación vuelve al frontend permitido', async () => {
    let params;
    AccountModel.signUp = async (p) => {
      params = p;
      return { error: null };
    };
    const res = await api('POST', '/auth/register', { body });
    assert.equal(res.status, 201);
    assert.equal(params.redirectTo, 'http://localhost:5173/');
    assert.equal(params.declared.dni, '30123456');
  });

  test('menor de 18: 403 underage con el campo', async () => {
    const res = await api('POST', '/auth/register', { body: { ...body, birthDate: '2015-01-01' } });
    assert.equal(res.status, 403);
    assert.deepEqual([res.body.code, res.body.field], ['underage', 'birthDate']);
  });

  test('DNI inválido: 400 con el campo', async () => {
    const res = await api('POST', '/auth/register', { body: { ...body, dni: 'abc' } });
    assert.equal(res.status, 400);
    assert.deepEqual([res.body.code, res.body.field], ['invalid_input', 'dni']);
  });

  test('DNI duplicado: 409 dni_taken', async () => {
    AccountModel.signUp = async () => ({ error: { status: 500, code: 'unexpected_failure', message: 'Database error saving new user' } });
    AccountModel.isDniAvailable = async () => false;
    const res = await api('POST', '/auth/register', { body });
    assert.equal(res.status, 409);
    assert.equal(res.body.code, 'dni_taken');
  });
});

describe('ARCA deshabilitado', () => {
  test('ninguna ruta normal usa RealArcaClient ni contacta a ARCA', async () => {
    AccountModel.signUp = async () => ({ error: null });
    await api('GET', '/events');
    await api('GET', `/events/${EVENT_ID}`, { token: 'confirmed' });
    await api('POST', '/events', { token: 'confirmed', body: newEvent });
    await api('POST', `/events/${EVENT_ID}/requests`, { token: 'confirmed' });
    await api('POST', '/auth/register', {
      body: { firstName: 'A', lastName: 'B', dni: '40111222', birthDate: '1990-01-01', gender: 'masculino', email: 'a@test.com', password: 'Abcdef1!', captchaToken: 't' },
    });
    assert.deepEqual(calls.arca, []);
  });

  test('/api/identity no está montado', async () => {
    assert.equal((await api('POST', '/identity/verify', { token: 'confirmed', body: {} })).status, 404);
    assert.equal((await api('GET', '/identity', { token: 'confirmed' })).status, 404);
    assert.deepEqual(calls.arca, []);
  });
});
