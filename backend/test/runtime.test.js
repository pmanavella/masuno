import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BACKEND = join(dirname(fileURLToPath(import.meta.url)), '..');

// Levanta server.js en un directorio vacío (así dotenv no lee backend/.env) con solo las
// variables indicadas. Resuelve con la salida cuando escucha, o cuando el proceso termina.
function startServer(extraEnv) {
  const env = {
    PATH: process.env.PATH,
    PORT: '0',
    SUPABASE_URL: 'http://supabase.invalid',
    SUPABASE_ANON_KEY: 'anon-test',
    SUPABASE_SERVICE_ROLE_KEY: 'service-test',
    ...extraEnv,
  };
  const child = spawn(process.execPath, [join(BACKEND, 'server.js')], { cwd: mkdtempSync(join(tmpdir(), 'plus1-run-')), env });
  return new Promise((resolve) => {
    let output = '';
    const timer = setTimeout(() => finish({ listening: false, timeout: true }), 10000);
    function finish(result) {
      clearTimeout(timer);
      child.kill();
      resolve({ ...result, output });
    }
    const onData = (chunk) => {
      output += chunk;
      if (output.includes('escuchando') && output.includes('ARCA:')) finish({ listening: true });
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('exit', (code) => finish({ listening: false, code }));
  });
}

describe('arranque del backend', () => {
  test('arranca sin ARCA_CUIT, ARCA_CERT_PATH ni ARCA_KEY_PATH con ARCA_ENABLED=false', async () => {
    const result = await startServer({ ARCA_ENABLED: 'false' });
    assert.ok(result.listening, result.output);
    assert.match(result.output, /ARCA: deshabilitado/);
  });

  test('arranca sin ninguna variable de ARCA (deshabilitado por defecto)', async () => {
    const result = await startServer({});
    assert.ok(result.listening, result.output);
  });

  test('ARCA_MODE=mock solo genera un aviso: no activa nada', async () => {
    const result = await startServer({ ARCA_MODE: 'mock' });
    assert.ok(result.listening, result.output);
    assert.match(result.output, /ARCA_MODE ya no se usa/);
    assert.match(result.output, /ARCA: deshabilitado/);
  });

  test('ARCA_ENABLED=true sin credenciales: no arranca (sin fallback a mock)', async () => {
    const result = await startServer({ ARCA_ENABLED: 'true' });
    assert.equal(result.listening, false);
    assert.match(result.output, /faltan variables: ARCA_CUIT, ARCA_CERT_PATH, ARCA_KEY_PATH/);
  });
});

describe('sin mocks en el runtime', () => {
  function sourceFiles(dir) {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? sourceFiles(path) : [path];
    });
  }

  test('MockArcaClient no existe en src/ ni se importa desde el runtime', () => {
    const files = [join(BACKEND, 'server.js'), ...sourceFiles(join(BACKEND, 'src'))];
    assert.ok(!files.some((f) => /MockArcaClient/.test(f)));
    for (const file of files) {
      const code = readFileSync(file, 'utf8');
      assert.doesNotMatch(code, /MockArcaClient|fixtures|ARCA_MODE\s*===|['"]mock['"]/, file);
    }
  });
});
