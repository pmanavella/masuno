import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { CATEGORIES, spotsLeftLabel } from '../src/lib/events.js';
import { toISODate } from '../src/lib/dateFilters.js';
import { CATEGORY_IMAGES, DEMO_USER, buildDemoEvents, buildDemoProfile } from '../src/demo/demoData.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const cordobaHour = (iso) =>
  Number(new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', hour12: false, timeZone: 'America/Argentina/Cordoba' }));
const cordobaWeekday = (iso) => new Date(`${toISODate(new Date(iso))}T12:00:00Z`).getUTCDay();

test('cupos con concordancia', () => {
  assert.equal(spotsLeftLabel(1), 'Falta 1 cupo');
  assert.equal(spotsLeftLabel(3), 'Faltan 3 cupos');
  assert.equal(spotsLeftLabel(0), 'Completo');
});

test('planes de ejemplo: futuros, dentro de la semana, en horarios razonables y con foto propia', () => {
  // Distintos momentos: lunes a la mañana, viernes a la noche, sábado tarde, domingo tarde.
  const moments = ['2026-10-26T12:00:00Z', '2026-10-31T01:00:00Z', '2026-10-31T21:00:00Z', '2026-11-01T22:00:00Z'];
  for (const iso of moments) {
    const now = new Date(iso);
    const events = buildDemoEvents(now);
    assert.ok(events.length >= 8 && events.length <= 10);
    for (const e of events) {
      const start = new Date(e.starts_at).getTime();
      assert.ok(start > now.getTime(), `${e.title} está vencido (${iso})`);
      assert.ok(start - now.getTime() <= 8 * DAY_MS, `${e.title} queda muy lejos (${iso})`);
      const hour = cordobaHour(e.starts_at);
      assert.ok(hour >= 7 || hour === 0, `${e.title} a las ${hour} h`);
      assert.equal(e.city, 'Córdoba Capital');
      assert.ok(existsSync(new URL(`../../public${e.image_url}`, import.meta.url)), e.image_url);
    }
    assert.ok(events.filter((e) => e.organizer_verified_business).length >= 2);
    assert.equal(new Set(events.map((e) => e.image_url)).size, events.length);
  }
  // Un lunes: varios planes caen el fin de semana.
  const weekend = buildDemoEvents(new Date(moments[0])).filter((e) => [0, 6].includes(cordobaWeekday(e.starts_at)));
  assert.ok(weekend.length >= 3);
});

test('todas las categorías tienen foto', () => {
  for (const c of CATEGORIES) assert.ok(CATEGORY_IMAGES[c], c);
});

test('perfil demo completo y con email confirmado', () => {
  const profile = buildDemoProfile(new Date('2026-10-27T12:00:00Z'));
  assert.equal(profile.emailConfirmed, true);
  assert.equal(profile.declared.age, 28);
  assert.ok(DEMO_USER.email_confirmed_at);
});

test('pedir unirse, aceptación simulada una sola vez por plan y nunca en planes propios', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { demoApi, subscribe, unreadCount } = await import('../src/demo/demoApi.js');
    const received = [];
    subscribe((change) => received.push(change));

    const [plan] = await demoApi.getEvents({ city: 'Córdoba Capital', categories: ['Juegos'] });
    const before = plan.spots_taken;
    assert.equal((await demoApi.getEvent(plan.id)).viewer.canJoin, 'ok');

    const req = await demoApi.requestToJoin(plan.id);
    assert.equal(req.status, 'pending');
    await assert.rejects(demoApi.requestToJoin(plan.id), /Ya pediste unirte/);

    mock.timers.tick(4000);
    let detail = await demoApi.getEvent(plan.id);
    assert.equal(detail.viewer.myRequest.status, 'accepted');
    assert.equal(detail.event.spots_taken, before + 1);
    assert.equal(received.length, 1);
    assert.equal(unreadCount(), 1);

    // Cancela y vuelve a pedir: no hay segunda aceptación.
    await demoApi.cancelRequest(req.id);
    await demoApi.requestToJoin(plan.id);
    mock.timers.tick(4000);
    detail = await demoApi.getEvent(plan.id);
    assert.equal(detail.viewer.myRequest.status, 'pending');
    assert.equal(received.length, 1);

    // Plan propio: aparece en el listado y en "Mis eventos", y no se puede pedir unirse.
    const startsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const mine = await demoApi.createEvent({ title: 'Picadito', category: 'Deportes', city: 'Córdoba Capital', startsAt, spotsTotal: '6', ageMin: '18', ageMax: '', gender: 'indistinto' });
    assert.ok((await demoApi.getEvents({ city: 'Córdoba Capital' })).some((e) => e.id === mine.id));
    assert.deepEqual((await demoApi.getOrganizedEvents()).map((e) => e.id), [mine.id]);
    const own = await demoApi.getEvent(mine.id);
    assert.equal(own.viewer.isOrganizer, true);
    assert.equal(own.viewer.canJoin, 'own_event');
    await assert.rejects(demoApi.createEvent({ title: 'x', category: 'Deportes', startsAt, spotsTotal: 2 }), /título/);

    // Plan completo y plan para otro género.
    const all = await demoApi.getEvents({});
    const full = all.find((e) => e.spots_taken >= e.spots_total);
    assert.equal((await demoApi.getEvent(full.id)).viewer.canJoin, 'full');
    assert.ok((await demoApi.getEvents({ gender: 'masculino' })).every((e) => e.gender !== 'femenino'));
  } finally {
    mock.timers.reset();
  }
});
