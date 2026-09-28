-- Pruebas de 20260927-solicitudes-y-avisos.sql. Corre después de 20260927-identidad-verificada.sql
-- (reutiliza sus usuarios).
-- Usuarios: 1111 Lucía (femenino, 1995, verificada), 2222 Justo (masculino, 18 justos),
-- 3333 sin verificar, 4444 Carlos (organizador), 5555 Alex (no_binario, 1990).
\set ON_ERROR_STOP 1

insert into auth.users (id, email) values
  ('44444444-4444-4444-4444-444444444444', 'org@test'),
  ('55555555-5555-5555-5555-555555555555', 'nb@test');

set role service_role;
select public.save_verified_identity('44444444-4444-4444-4444-444444444444','25111222','20251112223','Carlos Alberto','pérez','1980-05-05','masculino','mock');
select public.save_verified_identity('55555555-5555-5555-5555-555555555555','35111222','23351112229','Alex','Suárez','1990-01-01','no_binario','mock');
reset role;

-- ---------- Crear eventos ----------
set role authenticated;

set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select t.expect_error($$insert into events (organizer_id, title, category, starts_at, spots_total, organizer_name, organizer_initials) values ('33333333-3333-3333-3333-333333333333','x','Social',now()+interval '1 day',5,'x','X')$$, 'row-level security');

set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select t.expect_error($$insert into events (organizer_id, title, category, starts_at, spots_total, organizer_name, organizer_initials) values ('44444444-4444-4444-4444-444444444444','x','Social',now()+interval '1 day',5,'x','X')$$, 'row-level security');
select t.expect_error($$insert into events (organizer_id, title, category, starts_at, spots_total, organizer_name, organizer_initials) values ('11111111-1111-1111-1111-111111111111','x','Social',now()-interval '1 day',5,'x','X')$$, 'row-level security');

set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
insert into events (id, organizer_id, title, category, starts_at, spots_total, spots_taken, organizer_name, organizer_initials, organizer_rating, age_min, age_max)
values ('e0000000-0000-0000-0000-000000000001','44444444-4444-4444-4444-444444444444','Indistinto 2 lugares','Social',now()+interval '3 days',2,99 - 97,'Falso','FF',5,18,40);
insert into events (id, organizer_id, title, category, starts_at, spots_total, organizer_name, organizer_initials, gender)
values ('e0000000-0000-0000-0000-000000000002','44444444-4444-4444-4444-444444444444','Solo femenino','Deportes',now()+interval '3 days',5,'x','X','femenino');
insert into events (id, organizer_id, title, category, starts_at, spots_total, organizer_name, organizer_initials, gender)
values ('e0000000-0000-0000-0000-000000000003','44444444-4444-4444-4444-444444444444','Solo no binario','Cultura',now()+interval '3 days',5,'x','X','no_binario');
insert into events (id, organizer_id, title, category, starts_at, spots_total, organizer_name, organizer_initials, age_min, age_max)
values ('e0000000-0000-0000-0000-000000000004','44444444-4444-4444-4444-444444444444','21 a 25','Música',now()+interval '3 days',5,'x','X',21,25);
reset role;

select t.assert((select organizer_name = 'Carlos P.' and organizer_initials = 'CP' and spots_taken = 0 and organizer_rating = 0 and image_url is not null
                 from events where id = 'e0000000-0000-0000-0000-000000000001'), 'trigger pisa organizer_name/spots/rating y asigna imagen');
-- Evento ya empezado (cargado directo, la política no permite crearlo en el pasado)
insert into events (id, organizer_id, title, category, starts_at, spots_total, organizer_name, organizer_initials)
values ('e0000000-0000-0000-0000-000000000005','44444444-4444-4444-4444-444444444444','Pasado','Social',now()-interval '1 hour',5,'x','X');
select t.expect_error($$update events set spots_taken = 3 where id = 'e0000000-0000-0000-0000-000000000001'$$, 'events_spots_taken_check');

-- ---------- can_join_event ----------
set role anon;
set request.jwt.claim.sub = '';
select t.assert(public.can_join_event('e0000000-0000-0000-0000-000000000001') = 'not_verified', 'anon -> not_verified');
select t.expect_error($$select public.request_to_join('e0000000-0000-0000-0000-000000000001')$$, 'permission denied');
reset role;

set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select t.assert(public.can_join_event('e0000000-0000-0000-0000-000000000001') = 'not_verified', 'sin verificar -> not_verified');
select t.expect_error($$select public.request_to_join('e0000000-0000-0000-0000-000000000001')$$, 'not_verified');

set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select t.assert(public.can_join_event('e0000000-0000-0000-0000-000000000001') = 'own_event', 'organizador -> own_event');

set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select t.assert(public.can_join_event('e0000000-0000-0000-0000-00000000ffff') = 'not_found', 'inexistente -> not_found');
select t.assert(public.can_join_event('e0000000-0000-0000-0000-000000000005') = 'event_started', 'pasado -> event_started');
select t.assert(public.can_join_event('e0000000-0000-0000-0000-000000000002') = 'ok', 'femenina a evento femenino -> ok');
select t.assert(public.can_join_event('e0000000-0000-0000-0000-000000000003') = 'gender', 'femenina a evento no_binario -> gender');
select t.assert(public.can_join_event('e0000000-0000-0000-0000-000000000004') = 'age', '31 años a evento 21-25 -> age');

set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select t.assert(public.can_join_event('e0000000-0000-0000-0000-000000000002') = 'gender', 'masculino a evento femenino -> gender');
select t.assert(public.can_join_event('e0000000-0000-0000-0000-000000000004') = 'age', '18 años a evento 21-25 -> age');
select t.assert(public.can_join_event('e0000000-0000-0000-0000-000000000001') = 'ok', '18 años a evento 18-40 -> ok');

set request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
select t.assert(public.can_join_event('e0000000-0000-0000-0000-000000000002') = 'gender', 'no_binario a evento femenino -> gender');
select t.assert(public.can_join_event('e0000000-0000-0000-0000-000000000003') = 'ok', 'no_binario a evento no_binario -> ok');
select t.assert(public.can_join_event('e0000000-0000-0000-0000-000000000001') = 'ok', 'no_binario a evento indistinto -> ok');

-- ---------- request_to_join ----------
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.request_to_join('e0000000-0000-0000-0000-000000000001');
select t.assert(public.can_join_event('e0000000-0000-0000-0000-000000000001') = 'already_requested', 'segunda vez -> already_requested');
select t.expect_error($$select public.request_to_join('e0000000-0000-0000-0000-000000000001')$$, 'already_requested');
select t.expect_error($$select public.request_to_join('e0000000-0000-0000-0000-000000000003')$$, 'gender');
select t.expect_error($$insert into event_requests (event_id, user_id) values ('e0000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111')$$, 'row-level security');
select t.assert((select count(*) from event_requests) = 1, 'solicitante ve solo la suya');
select t.assert((select count(*) from notifications) = 0, 'solicitante no ve el aviso del organizador');
-- Intentar autoaprobarse: sin política de update no afecta ninguna fila
update event_requests set status = 'accepted';
select t.expect_error($$select public.respond_to_request((select id from event_requests limit 1), true)$$, 'not_found');

set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select public.request_to_join('e0000000-0000-0000-0000-000000000001');
set request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
select public.request_to_join('e0000000-0000-0000-0000-000000000001');
select public.request_to_join('e0000000-0000-0000-0000-000000000003');
select t.assert((select count(*) from event_requests where event_id = 'e0000000-0000-0000-0000-000000000001') = 1, 'no ve solicitudes ajenas del mismo evento');
select t.assert((select count(*) from get_event_requests('e0000000-0000-0000-0000-000000000001')) = 0, 'get_event_requests vacío si no es organizador');

-- ---------- respond_to_request ----------
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select t.assert((select count(*) from event_requests) = 4, 'organizador ve las solicitudes de sus eventos');
select t.assert((select count(*) from notifications where type = 'join_requested') = 4, 'organizador recibió 4 avisos');
select t.assert((select string_agg(display_name, ',' order by created_at) from get_event_requests('e0000000-0000-0000-0000-000000000001')) = 'Lucía M.,Justo D.,Alex S.', 'nombres visibles "Nombre I."');
select t.assert(public.respond_to_request((select id from event_requests where user_id = '11111111-1111-1111-1111-111111111111'), true) = 'accepted', 'acepta a Lucía');
select t.expect_error($$select public.respond_to_request((select id from event_requests where user_id = '11111111-1111-1111-1111-111111111111'), false)$$, 'not_pending');
select t.assert(public.respond_to_request((select id from event_requests where user_id = '22222222-2222-2222-2222-222222222222'), true) = 'accepted', 'acepta a Justo');
select t.assert((select spots_taken from events where id = 'e0000000-0000-0000-0000-000000000001') = 2, 'spots_taken = 2');
select t.expect_error($$select public.respond_to_request((select id from event_requests where user_id = '55555555-5555-5555-5555-555555555555' and event_id = 'e0000000-0000-0000-0000-000000000001'), true)$$, 'full');
select t.assert((select status from event_requests where user_id = '55555555-5555-5555-5555-555555555555' and event_id = 'e0000000-0000-0000-0000-000000000001') = 'pending', 'tras full la solicitud sigue pending');
select t.assert(public.respond_to_request((select id from event_requests where event_id = 'e0000000-0000-0000-0000-000000000003'), false) = 'rejected', 'rechaza a Alex en otro evento');
select t.expect_error($$update notifications set type = 'request_accepted'$$, 'permission denied');
reset role;

-- ---------- avisos al solicitante ----------
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select t.assert(public.can_join_event('e0000000-0000-0000-0000-000000000001') = 'already_requested', 'aceptada -> already_requested');
select t.assert((select count(*) from notifications where type = 'request_accepted') = 1 and (select count(*) from notifications) = 1, 'Lucía recibió solo su aviso de aceptación');
update notifications set read_at = now();
select t.assert((select read_at is not null from notifications), 'marca como leída');
set request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
select t.assert((select count(*) from notifications where type = 'request_rejected') = 1, 'Alex recibió aviso de rechazo');
reset role;

-- ---------- baja de cuenta libera el lugar ----------
delete from auth.users where id = '22222222-2222-2222-2222-222222222222';
select t.assert((select spots_taken from events where id = 'e0000000-0000-0000-0000-000000000001') = 1, 'borrar usuario aceptado libera el lugar');

select t.assert(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'notifications'), 'notifications en Realtime');

select 'PASO 2: TODAS LAS PRUEBAS OK' as resultado;
