import { readFileSync } from 'node:fs';
import { isArcaEnabled } from '../../config/arca.js';
import { RealArcaClient } from './RealArcaClient.js';

export { ArcaUnavailableError } from './ArcaClient.js';

const REQUIRED_ENV = ['ARCA_CUIT', 'ARCA_CERT_PATH', 'ARCA_KEY_PATH'];

// Solo con ARCA_ENABLED=true. No hay modo mock ni fallback: si falta configuración, falla (y con
// eso no arranca el backend) en vez de seguir sin verificar.
export function createArcaClient({ env = process.env, ticketStore } = {}) {
  if (!isArcaEnabled(env)) {
    throw new Error('ARCA está deshabilitado (ARCA_ENABLED=false): no se crea el cliente');
  }
  const missing = REQUIRED_ENV.filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new Error(`ARCA_ENABLED=true pero faltan variables: ${missing.join(', ')}`);
  }

  return new RealArcaClient({
    cuit: env.ARCA_CUIT,
    certPem: readFileSync(env.ARCA_CERT_PATH, 'utf8'),
    keyPem: readFileSync(env.ARCA_KEY_PATH, 'utf8'),
    env: env.ARCA_ENV || 'homologacion',
    timeoutMs: Number(env.ARCA_TIMEOUT_MS) || 10000,
    ticketStore,
  });
}
