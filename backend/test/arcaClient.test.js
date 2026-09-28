import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import forge from 'node-forge';
import { RealArcaClient } from '../src/services/arca/RealArcaClient.js';
import { ArcaUnavailableError } from '../src/services/arca/ArcaClient.js';
import { createArcaClient } from '../src/services/arca/index.js';

// Certificado autofirmado solo para las pruebas (ARCA real no se puede probar sin certificado).
let certPem;
let keyPem;
before(() => {
  const keys = forge.pki.rsa.generateKeyPair(1024);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date(Date.now() + 86400000);
  const attrs = [{ name: 'commonName', value: 'plus1-test' }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  certPem = forge.pki.certificateToPem(cert);
  keyPem = forge.pki.privateKeyToPem(keys.privateKey);
});

function soapResponse(bodyXml) {
  return `<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>${bodyXml}</soap:Body></soap:Envelope>`;
}

function escape(xml) {
  return xml.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const LOGIN_RESPONSE = soapResponse(
  '<loginCmsResponse xmlns="http://wsaa.view.sua.dvadac.desein.afip.gov"><loginCmsReturn>' +
    escape(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><loginTicketResponse version="1.0"><header>' +
        '<expirationTime>2099-01-01T12:00:00.000-03:00</expirationTime></header>' +
        '<credentials><token>TOKEN123</token><sign>SIGN456</sign></credentials></loginTicketResponse>'
    ) +
    '</loginCmsReturn></loginCmsResponse>'
);

const ID_LIST_RESPONSE = soapResponse(
  '<ns2:getIdPersonaListByDocumentoResponse xmlns:ns2="http://a13.soap.ws.server.puc.sr/"><idPersonaListReturn>' +
    '<idPersona>20289998889</idPersona><idPersona>27289998883</idPersona>' +
    '</idPersonaListReturn></ns2:getIdPersonaListByDocumentoResponse>'
);

const PERSONA_RESPONSE = soapResponse(
  '<ns2:getPersonaResponse xmlns:ns2="http://a13.soap.ws.server.puc.sr/"><personaReturn><persona>' +
    '<apellido>PEREZ</apellido><nombre>JUAN CARLOS</nombre><estadoClave>ACTIVO</estadoClave>' +
    '<fechaNacimiento>1980-07-21T12:00:00-03:00</fechaNacimiento><idPersona>20289998889</idPersona>' +
    '<numeroDocumento>28999888</numeroDocumento><tipoClave>CUIL</tipoClave><tipoPersona>FISICA</tipoPersona>' +
    '</persona></personaReturn></ns2:getPersonaResponse>'
);

const FAULT_NOT_FOUND = soapResponse('<soap:Fault><faultcode>soap:Server</faultcode><faultstring>No existe persona con ese Id</faultstring></soap:Fault>');
const FAULT_OTHER = soapResponse('<soap:Fault><faultcode>soap:Server</faultcode><faultstring>Error interno de base de datos</faultstring></soap:Fault>');

function memoryTicketStore() {
  const tickets = new Map();
  return {
    tickets,
    get: async (service) => tickets.get(service) ?? null,
    save: async (service, ticket) => tickets.set(service, ticket),
  };
}

// fetch falso: responde según URL y operación SOAP, y registra cada llamada.
function fakeFetch(routes) {
  const calls = [];
  const impl = async (url, options) => {
    calls.push({ url, body: options.body });
    const route = routes.find((r) => url.includes(r.url) && (!r.op || options.body.includes(`:${r.op}>`)));
    if (!route) throw new Error(`Ruta no esperada: ${url}`);
    if (route.networkError) throw new TypeError('fetch failed');
    return new Response(route.body, { status: route.status ?? 200 });
  };
  impl.calls = calls;
  return impl;
}

function client(fetchImpl, ticketStore = memoryTicketStore()) {
  return new RealArcaClient({ cuit: '20123456789', certPem, keyPem, env: 'homologacion', ticketStore, fetchImpl });
}

describe('RealArcaClient', () => {
  test('firma el TRA como CMS verificable por OpenSSL', (t) => {
    const c = client(fakeFetch([]));
    const tra = c.buildLoginTicketRequest(new Date('2026-09-27T12:00:00Z'));
    assert.match(tra, /<service>ws_sr_padron_a13<\/service>/);
    assert.match(tra, /<generationTime>2026-09-27T11:50:00.000Z<\/generationTime>/);

    const cms = c.signLoginTicketRequest(tra);
    const dir = mkdtempSync(join(tmpdir(), 'plus1-cms-'));
    writeFileSync(join(dir, 'cms.der'), Buffer.from(cms, 'base64'));
    const openssl = spawnSync('openssl', ['cms', '-verify', '-noverify', '-inform', 'DER', '-in', join(dir, 'cms.der')], { encoding: 'utf8' });
    if (openssl.error) return t.skip('openssl no disponible');
    assert.equal(openssl.status, 0, openssl.stderr);
    assert.equal(openssl.stdout, tra);
  });

  test('flujo completo: WSAA una sola vez, luego Padrón A13', async () => {
    const store = memoryTicketStore();
    const fetchImpl = fakeFetch([
      { url: 'wsaahomo', body: LOGIN_RESPONSE },
      { url: 'awshomo', op: 'getIdPersonaListByDocumento', body: ID_LIST_RESPONSE },
      { url: 'awshomo', op: 'getPersona', body: PERSONA_RESPONSE },
    ]);
    const c = client(fetchImpl, store);

    assert.deepEqual(await c.getIdPersonaListByDocumento('28999888'), ['20289998889', '27289998883']);
    assert.deepEqual(await c.getPersona('20289998889'), {
      cuil: '20289998889',
      firstName: 'JUAN CARLOS',
      lastName: 'PEREZ',
      birthDate: '1980-07-21',
      personType: 'FISICA',
      keyStatus: 'ACTIVO',
      deceased: false,
    });

    assert.equal(fetchImpl.calls.filter((call) => call.url.includes('wsaa')).length, 1);
    assert.equal(store.tickets.get('ws_sr_padron_a13').token, 'TOKEN123');
    const a13Call = fetchImpl.calls.find((call) => call.body.includes('getPersona>'));
    assert.match(a13Call.body, /<token>TOKEN123<\/token><sign>SIGN456<\/sign><cuitRepresentada>20123456789<\/cuitRepresentada><idPersona>20289998889<\/idPersona>/);
  });

  test('reutiliza el ticket guardado en la base sin volver a pedirlo a WSAA', async () => {
    const store = memoryTicketStore();
    await store.save('ws_sr_padron_a13', { token: 'GUARDADO', sign: 'S', expiresAt: '2099-01-01T00:00:00Z' });
    const fetchImpl = fakeFetch([{ url: 'awshomo', op: 'getIdPersonaListByDocumento', body: ID_LIST_RESPONSE }]);
    await client(fetchImpl, store).getIdPersonaListByDocumento('28999888');
    assert.equal(fetchImpl.calls.length, 1);
    assert.match(fetchImpl.calls[0].body, /<token>GUARDADO<\/token>/);
  });

  test('"No existe persona" no es un error: lista vacía / null', async () => {
    const fetchImpl = fakeFetch([
      { url: 'wsaahomo', body: LOGIN_RESPONSE },
      { url: 'awshomo', body: FAULT_NOT_FOUND, status: 500 },
    ]);
    const c = client(fetchImpl);
    assert.deepEqual(await c.getIdPersonaListByDocumento('11222333'), []);
    assert.equal(await c.getPersona('20112223334'), null);
  });

  test('otros faults, HTTP de error o red caída: ArcaUnavailableError', async () => {
    const cases = [
      [{ url: 'awshomo', body: FAULT_OTHER, status: 500 }],
      [{ url: 'awshomo', body: '<html>502 Bad Gateway</html>', status: 502 }],
      [{ url: 'awshomo', networkError: true }],
    ];
    for (const routes of cases) {
      const c = client(fakeFetch([{ url: 'wsaahomo', body: LOGIN_RESPONSE }, ...routes]));
      await assert.rejects(c.findPersonsByDni('28999888'), ArcaUnavailableError);
    }
    const wsaaDown = client(fakeFetch([{ url: 'wsaahomo', networkError: true }]));
    await assert.rejects(wsaaDown.findPersonsByDni('28999888'), ArcaUnavailableError);
  });

  test('valida la configuración', () => {
    assert.throws(() => new RealArcaClient({ cuit: '123', certPem, keyPem }), /ARCA_CUIT/);
    assert.throws(() => new RealArcaClient({ cuit: '20123456789', certPem: null, keyPem }), /certificado/);
    assert.throws(() => new RealArcaClient({ cuit: '20123456789', certPem, keyPem, env: 'test' }), /ARCA_ENV/);
  });
});

describe('createArcaClient', () => {
  test('exige ARCA_MODE y bloquea mock en producción', () => {
    assert.throws(() => createArcaClient({ env: {} }), /ARCA_MODE/);
    assert.throws(() => createArcaClient({ env: { ARCA_MODE: 'mock', NODE_ENV: 'production' } }), /no está permitido/);
    assert.equal(createArcaClient({ env: { ARCA_MODE: 'mock', NODE_ENV: 'development' } }).source, 'mock');
  });
});
