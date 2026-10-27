import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, formatDateChip, nextWeekendDate, toISODate } from '../src/lib/dateFilters.js';

// Martes 27/10/2026 a las 22:30 en Córdoba = miércoles 01:30 UTC.
const LATE_TUESDAY = new Date('2026-10-28T01:30:00Z');

test('"hoy" y "mañana" se calculan en hora de Córdoba, no en UTC', () => {
  assert.equal(toISODate(LATE_TUESDAY), '2026-10-27');
  assert.equal(toISODate(addDays(LATE_TUESDAY, 1)), '2026-10-28');
  assert.equal(formatDateChip('2026-10-27', LATE_TUESDAY), 'Hoy');
  assert.equal(formatDateChip('2026-10-28', LATE_TUESDAY), 'Mañana');
});

test('"este finde" es el sábado siguiente en Córdoba, u hoy si ya es finde', () => {
  assert.equal(toISODate(nextWeekendDate(LATE_TUESDAY)), '2026-10-31');
  // Sábado 31/10 a las 23:00 en Córdoba (domingo en UTC): sigue siendo hoy.
  const saturdayNight = new Date('2026-11-01T02:00:00Z');
  assert.equal(toISODate(nextWeekendDate(saturdayNight)), '2026-10-31');
});

test('chip de una fecha cualquiera, sin correrse de día', () => {
  assert.equal(formatDateChip('2026-11-05', LATE_TUESDAY), '5 nov');
});
