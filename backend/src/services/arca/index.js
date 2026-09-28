import { readFileSync } from 'node:fs';
import { MockArcaClient } from './MockArcaClient.js';
import { RealArcaClient } from './RealArcaClient.js';

export { ArcaUnavailableError } from './ArcaClient.js';

// ARCA_MODE es obligatorio para que nunca se use el mock por olvido de configuración.
export function createArcaClient({ env = process.env, ticketStore } = {}) {
  const mode = env.ARCA_MODE;

  if (mode === 'mock') {
    return new MockArcaClient({ nodeEnv: env.NODE_ENV });
  }

  if (mode === 'real') {
    return new RealArcaClient({
      cuit: env.ARCA_CUIT,
      certPem: env.ARCA_CERT_PATH ? readFileSync(env.ARCA_CERT_PATH, 'utf8') : null,
      keyPem: env.ARCA_KEY_PATH ? readFileSync(env.ARCA_KEY_PATH, 'utf8') : null,
      env: env.ARCA_ENV || 'homologacion',
      timeoutMs: Number(env.ARCA_TIMEOUT_MS) || 10000,
      ticketStore,
    });
  }

  throw new Error('ARCA_MODE debe ser "mock" o "real" en backend/.env');
}
