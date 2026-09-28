-- Pruebas de 20260927-cancelar-solicitudes.sql. Corre después de las pruebas de
-- solicitudes-y-avisos y parte de su estado final:
--   e..01 (2 lugares): Lucía aceptada (spots_taken = 1), Alex pendiente.
--   e..03 (no_binario): Alex rechazado.  e..05: evento ya empezado.
\set ON_ERROR_STOP 1

set role anon;
set request.jwt.claim.sub = '';
select t.expect_error($$select public.cancel_request(gen_random_uuid())$$, 'permission denied');
reset role;

set role authenticated;

-- Cancelar una aceptada libera el lugar y avisa al organizador
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select t.assert(public.cancel_request((select id from event_requests where event_id = 'e0000000-0000-0000-0000-000000000001')) = 'cancelled', 'Lucía cancela su aceptada');
select t.assert((select spots_taken from events where id = 'e0000000-0000-0000-0000-000000000001') = 0, 'cancelar aceptada libera el lugar');
select t.expect_error($$select public.cancel_request((select id from event_requests where event_id = 'e0000000-0000-0000-0000-000000000001'))$$, 'not_cancellable');

-- Puede volver a pedir: se reutiliza la fila
select t.assert(public.can_join_event('e0000000-0000-0000-0000-000000000001') = 'ok', 'cancelada -> puede volver a pedir');
create temp table ids as select id as old_id from event_requests where event_id = 'e0000000-0000-0000-0000-000000000001';
select t.assert(public.request_to_join('e0000000-0000-0000-0000-000000000001') = (select old_id from ids), 'reutiliza la misma fila');
select t.assert((select status = 'pending' and responded_at is null from event_requests where event_id = 'e0000000-0000-0000-0000-000000000001'), 'vuelve a pending');
select t.expect_error($$select public.request_to_join('e0000000-0000-0000-0000-000000000001')$$, 'already_requested');

-- Cancelar una pendiente y volver a pedir otra vez
select t.assert(public.cancel_request((select id from event_requests where event_id = 'e0000000-0000-0000-0000-000000000001')) = 'cancelled', 'cancela la pendiente');
select public.request_to_join('e0000000-0000-0000-0000-000000000001');

-- Rechazada: no se puede cancelar ni reintentar
set request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
select t.expect_error($$select public.cancel_request((select id from event_requests where event_id = 'e0000000-0000-0000-0000-000000000003'))$$, 'not_cancellable');
select t.assert(public.can_join_event('e0000000-0000-0000-0000-000000000003') = 'already_requested', 'rechazada -> already_requested');
select t.expect_error($$select public.request_to_join('e0000000-0000-0000-0000-000000000003')$$, 'already_requested');

-- No puede cancelar la solicitud de otro
select t.expect_error($$select public.cancel_request((select r.id from event_requests r join events e on e.id = r.event_id where r.user_id = '11111111-1111-1111-1111-111111111111' limit 1))$$, 'not_found');
reset role;

-- Evento ya empezado: no se puede cancelar
insert into event_requests (event_id, user_id) values ('e0000000-0000-0000-0000-000000000005', '55555555-5555-5555-5555-555555555555');
set role authenticated;
set request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
select t.expect_error($$select public.cancel_request((select id from event_requests where event_id = 'e0000000-0000-0000-0000-000000000005'))$$, 'event_started');

-- Avisos al organizador: 2 cancelaciones de Lucía y 2 nuevas solicitudes al volver a pedir
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select t.assert((select count(*) from notifications where type = 'request_cancelled') = 2, 'organizador recibió 2 avisos de cancelación');
-- Lucía x3 (original + 2 reintentos) + Alex. El de Justo se borró en cascada con su cuenta.
select t.assert((select count(*) from notifications where type = 'join_requested' and event_id = 'e0000000-0000-0000-0000-000000000001') = 4, 'organizador recibió avisos por cada nueva solicitud');
select t.assert((select status from get_event_requests('e0000000-0000-0000-0000-000000000001') where display_name = 'Lucía M.') = 'pending', 'organizador ve a Lucía pendiente de nuevo');
reset role;

select 'CANCELAR SOLICITUDES: TODAS LAS PRUEBAS OK' as resultado;
