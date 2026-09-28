import forge from 'node-forge';
import { XMLParser } from 'fast-xml-parser';
import { ArcaClient, ArcaUnavailableError } from './ArcaClient.js';

// Cliente real: autenticación WSAA (ticket de acceso firmado con el certificado del CUIT
// representado) + web service Padrón A13 (ws_sr_padron_a13).
//
// Todavía no se pudo probar contra ARCA (falta el certificado). Nombres de campos y mensajes
// de error según el manual del Padrón A13; revisarlos en homologación antes de producción.

const SERVICE = 'ws_sr_padron_a13';

const ENDPOINTS = {
  homologacion: {
    wsaa: 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms',
    a13: 'https://awshomo.afip.gov.ar/sr-padron/webservices/personaServiceA13',
  },
  produccion: {
    wsaa: 'https://wsaa.afip.gov.ar/ws/services/LoginCms',
    a13: 'https://aws.afip.gov.ar/sr-padron/webservices/personaServiceA13',
  },
};

// Strings siempre como string (un CUIL o DNI parseado como número pierde ceros o precisión).
const parser = new XMLParser({ removeNSPrefix: true, parseTagValue: false, ignoreAttributes: true });

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function asArray(value) {
  if (value === undefined || value === null || value === '') return [];
  return Array.isArray(value) ? value : [value];
}

export class RealArcaClient extends ArcaClient {
  source = 'arca';

  // ticketStore: { get(service) -> { token, sign, expiresAt } | null, save(service, ticket) }
  constructor({ cuit, certPem, keyPem, env = 'homologacion', ticketStore, timeoutMs = 10000, fetchImpl = fetch }) {
    super();
    if (!/^\d{11}$/.test(cuit || '')) throw new Error('ARCA_CUIT inválido (11 dígitos)');
    if (!certPem || !keyPem) throw new Error('Faltan el certificado o la clave privada de ARCA');
    if (!ENDPOINTS[env]) throw new Error(`ARCA_ENV inválido: ${env} (homologacion | produccion)`);

    this.cuit = cuit;
    this.certificate = forge.pki.certificateFromPem(certPem);
    this.privateKey = forge.pki.privateKeyFromPem(keyPem);
    this.endpoints = ENDPOINTS[env];
    this.ticketStore = ticketStore;
    this.timeoutMs = timeoutMs;
    this.fetch = fetchImpl;
    this.ticket = null;
    this.pendingTicket = null;
  }

  // ------------------------------------------------------------------ WSAA

  buildLoginTicketRequest(now = new Date()) {
    const generation = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
    const expiration = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
    return (
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<loginTicketRequest version="1.0"><header>' +
      `<uniqueId>${Math.floor(now.getTime() / 1000)}</uniqueId>` +
      `<generationTime>${generation}</generationTime>` +
      `<expirationTime>${expiration}</expirationTime>` +
      `</header><service>${SERVICE}</service></loginTicketRequest>`
    );
  }

  // CMS (PKCS#7 SignedData) con el TRA adjunto, en base64, como lo pide loginCms.
  signLoginTicketRequest(tra) {
    const p7 = forge.pkcs7.createSignedData();
    p7.content = forge.util.createBuffer(tra, 'utf8');
    p7.addCertificate(this.certificate);
    p7.addSigner({
      key: this.privateKey,
      certificate: this.certificate,
      digestAlgorithm: forge.pki.oids.sha256,
      authenticatedAttributes: [
        { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
        { type: forge.pki.oids.messageDigest },
        { type: forge.pki.oids.signingTime, value: new Date() },
      ],
    });
    p7.sign();
    return forge.util.encode64(forge.asn1.toDer(p7.toAsn1()).getBytes());
  }

  async requestTicket() {
    const cms = this.signLoginTicketRequest(this.buildLoginTicketRequest());
    const body = await this.soap(
      this.endpoints.wsaa,
      '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" ' +
        'xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">' +
        `<soapenv:Header/><soapenv:Body><wsaa:loginCms><wsaa:in0>${cms}</wsaa:in0></wsaa:loginCms>` +
        '</soapenv:Body></soapenv:Envelope>'
    );

    const inner = body?.loginCmsResponse?.loginCmsReturn;
    const response = inner ? parser.parse(inner)?.loginTicketResponse : null;
    const token = response?.credentials?.token;
    const sign = response?.credentials?.sign;
    const expiresAt = response?.header?.expirationTime;
    if (!token || !sign || !expiresAt) {
      throw new ArcaUnavailableError('Respuesta de WSAA sin credenciales');
    }
    return { token, sign, expiresAt: new Date(expiresAt).toISOString() };
  }

  // WSAA rechaza pedir otro ticket mientras haya uno vigente: se cachea en memoria y en la base.
  async getTicket() {
    const margin = 5 * 60 * 1000;
    if (this.ticket && new Date(this.ticket.expiresAt).getTime() - margin > Date.now()) {
      return this.ticket;
    }
    if (!this.pendingTicket) {
      this.pendingTicket = (async () => {
        const stored = await this.ticketStore.get(SERVICE);
        if (stored) return stored;
        const fresh = await this.requestTicket();
        await this.ticketStore.save(SERVICE, fresh);
        return fresh;
      })().finally(() => {
        this.pendingTicket = null;
      });
    }
    this.ticket = await this.pendingTicket;
    return this.ticket;
  }

  // ------------------------------------------------------------------ Padrón A13

  async callA13(operation, params) {
    const { token, sign } = await this.getTicket();
    const fields = { token, sign, cuitRepresentada: this.cuit, ...params };
    const xmlFields = Object.entries(fields)
      .map(([key, value]) => `<${key}>${escapeXml(value)}</${key}>`)
      .join('');
    return this.soap(
      this.endpoints.a13,
      '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" ' +
        'xmlns:a13="http://a13.soap.ws.server.puc.sr/">' +
        `<soapenv:Header/><soapenv:Body><a13:${operation}>${xmlFields}</a13:${operation}>` +
        '</soapenv:Body></soapenv:Envelope>',
      { notFoundFault: /no existe/i }
    );
  }

  async getIdPersonaListByDocumento(dni) {
    const body = await this.callA13('getIdPersonaListByDocumento', { documento: dni });
    if (!body) return [];
    return asArray(body?.getIdPersonaListByDocumentoResponse?.idPersonaListReturn?.idPersona).map(String);
  }

  async getPersona(cuil) {
    const body = await this.callA13('getPersona', { idPersona: cuil });
    const persona = body?.getPersonaResponse?.personaReturn?.persona;
    if (!persona) return null;
    return {
      cuil: String(persona.idPersona ?? cuil),
      firstName: persona.nombre ?? '',
      lastName: persona.apellido ?? '',
      // Viene como xsd:dateTime (p. ej. 1995-03-10T12:00:00-03:00): alcanza con la fecha.
      birthDate: persona.fechaNacimiento ? String(persona.fechaNacimiento).slice(0, 10) : null,
      personType: persona.tipoPersona ?? '',
      keyStatus: persona.estadoClave ?? '',
      deceased: Boolean(persona.fechaFallecimiento),
    };
  }

  // ------------------------------------------------------------------ SOAP

  // Devuelve el contenido de <Body>; null si el fault coincide con notFoundFault.
  async soap(url, envelope, { notFoundFault } = {}) {
    let res;
    let text;
    try {
      res = await this.fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '""' },
        body: envelope,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      text = await res.text();
    } catch (err) {
      throw new ArcaUnavailableError(`No se pudo contactar a ARCA (${url})`, { cause: err });
    }

    let parsed;
    try {
      parsed = parser.parse(text);
    } catch (err) {
      throw new ArcaUnavailableError(`Respuesta inválida de ARCA (HTTP ${res.status})`, { cause: err });
    }

    const body = parsed?.Envelope?.Body;
    const fault = body?.Fault;
    if (fault) {
      const message = String(fault.faultstring ?? 'Fault sin descripción');
      if (notFoundFault?.test(message)) return null;
      throw new ArcaUnavailableError(`ARCA respondió con error: ${message}`);
    }
    if (!res.ok || !body) {
      throw new ArcaUnavailableError(`ARCA respondió HTTP ${res.status}`);
    }
    return body;
  }
}
