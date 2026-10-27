import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cordobaDayRange } from '../src/utils/cordobaDay.js';

test('un día va de 00:00 a 24:00 hora de Córdoba (UTC-3)', () => {
  assert.deepEqual(cordobaDayRange('2026-10-31'), {
    start: '2026-10-31T00:00:00-03:00',
    end: '2026-11-01T00:00:00-03:00',
  });
  // Un evento a las 22:30 del 31 en Córdoba (01:30 UTC del 1/11) cae en el 31.
  const { start, end } = cordobaDayRange('2026-10-31');
  const event = new Date('2026-11-01T01:30:00Z').getTime();
  assert.ok(event >= new Date(start).getTime() && event < new Date(end).getTime());
});

test('cruza fin de mes y de año', () => {
  assert.equal(cordobaDayRange('2026-12-31').end, '2027-01-01T00:00:00-03:00');
});

test('rechaza fechas inválidas', () => {
  for (const value of ['', '31/10/2026', '2026-02-30', '2026-13-01', 'hoy', undefined]) {
    assert.equal(cordobaDayRange(value), null, String(value));
  }
});
