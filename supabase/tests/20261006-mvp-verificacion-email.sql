-- Pruebas de 20261006-mvp-verificacion-email.sql. Corre después de las pruebas de 20260927 y
-- parte de su estado: 1111 Lucía, 4444 Carlos y 5555 Alex con identidad source = 'mock';
-- 3333 sin identidad. Eventos de Carlos: e..01 indistinto 18-40, e..02 femenino,
-- e..03 no_binario, e..04 21-25, e..05 ya empezado.
-- Usuarios nuevos: 6666 Sofía (registro completo), 7777 Justo (18 justos), 8888 sin datos declarados.
\set ON_ERROR_STOP 1

-- Las cuentas existentes ya habían confirmado el email (en Supabase: Auto Confirm o link).
update auth.users set email_confirmed_at = now()
where id in ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333',
             '44444444-4444-4444-4444-444444444444', '55555555-5555-5555-5555-555555555555');

-- ---------- Migración de datos existentes ----------
select t.assert((select count(*) from private.declared_identities) = 3, 'identidades existentes copiadas como datos declarados');
select t.assert((select count(*) from private.identities where source = 'mock') = 3, 'identidades mock intactas (no se borran)');
select t.assert((select first_name = 'Lucía Belén' and dni = '30123456' and gender = 'femenino'
                 from private.declared_identities where user_id = '11111111-1111-1111-1111-111111111111'), 'datos de Lucía copiados');
select t.assert(exists (select 1 from pg_policies where policyname = 'events_insert_enabled')
                and not exists (select 1 from pg_policies where policyname = 'events_insert_verified'), 'policy de eventos reemplazada');

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select t.assert(not public.is_verified(), 'una identidad mock ya no cuenta como verificada por ARCA');
select t.assert(public.is_account_enabled(), 'cuenta existente con email confirmado sigue habilitada');
select t.assert((select dni_masked = '*****456' and first_name = 'Lucía Belén' and gender = 'femenino'
                 from public.get_my_declared_identity()), 've sus datos declarados con el DNI enmascarado');
select t.expect_error('select * from private.declared_identities', 'permission denied');
reset role;

set role anon;
set request.jwt.claim.sub = '';
select t.assert(not public.is_account_enabled(), 'anon no habilitado');
select t.assert(public.can_join_event('e0000000-0000-0000-0000-000000000001') = 'not_authenticated', 'anon -> not_authenticated');
select t.assert((select count(*) from events) > 0, 'anon sigue viendo eventos');
select t.expect_error('select * from public.get_my_declared_identity()', 'permission denied');
select t.expect_error('select * from private.declared_identities', 'permission denied');
select t.expect_error($$select public.identity_dni_available('30123456')$$, 'permission denied');
reset role;

-- ---------- Registro: lo que hace Supabase Auth con signUp + options.data ----------
insert into auth.users (id, email, raw_user_meta_data) values
  ('66666666-6666-6666-6666-666666666666', 'sofia@test',
   '{"first_name":"  Sofía ","last_name":"Ruiz-Díaz","dni":"40111222","birth_date":"1999-05-20","gender":"femenino","otro":"x"}');
insert into auth.identities (user_id, identity_data) values
  ('66666666-6666-6666-6666-666666666666', '{"sub":"6666","email":"sofia@test","dni":"40111222","birth_date":"1999-05-20"}');

select t.assert((select first_name = 'Sofía' and last_name = 'Ruiz-Díaz' and dni = '40111222' and birth_date = '1999-05-20' and gender = 'femenino'
                 from private.declared_identities where user_id = '66666666-6666-6666-6666-666666666666'), 'registro guarda los datos declarados');
select t.assert((select full_name = 'Sofía Ruiz-Díaz' from profiles where id = '66666666-6666-6666-6666-666666666666'), 'registro completa full_name');
select t.assert((select raw_user_meta_data = '{"otro":"x"}'::jsonb from auth.users where id = '66666666-6666-6666-6666-666666666666'), 'saca los datos declarados del user_metadata');
select t.assert((select not (identity_data ?| array['dni', 'birth_date']) from auth.identities where user_id = '66666666-6666-6666-6666-666666666666'), 'saca los datos declarados de identity_data');
select t.assert(not exists (select 1 from private.identities where user_id = '66666666-6666-6666-6666-666666666666'), 'registrarse no crea identidad ARCA');

-- Registros rechazados: falla el insert en auth.users, no se crea la cuenta
select t.expect_error($$insert into auth.users (email, raw_user_meta_data) values ('r1@test', '{"first_name":"Otra","last_name":"Persona","dni":"40111222","birth_date":"1990-01-01","gender":"femenino"}')$$, 'dni_taken');
select t.expect_error($$insert into auth.users (email, raw_user_meta_data) values ('r2@test', '{"first_name":"Otra","last_name":"Persona","dni":"30123456","birth_date":"1990-01-01","gender":"femenino"}')$$, 'dni_taken');
select t.expect_error($$insert into auth.users (email, raw_user_meta_data) values ('r3@test', jsonb_build_object('first_name','Menor','last_name','Test','dni','42111222','gender','masculino','birth_date',(current_date - interval '17 years')::date))$$, 'underage');
select t.expect_error($$insert into auth.users (email, raw_user_meta_data) values ('r4@test', jsonb_build_object('first_name','Menor','last_name','Test','dni','42111222','gender','masculino','birth_date',(current_date - interval '18 years' + interval '1 day')::date))$$, 'underage');
select t.expect_error($$insert into auth.users (email, raw_user_meta_data) values ('r5@test', jsonb_build_object('first_name','Futuro','last_name','Test','dni','42111222','gender','masculino','birth_date',current_date + 1))$$, 'invalid_birth_date');
select t.expect_error($$insert into auth.users (email, raw_user_meta_data) values ('r6@test', '{"first_name":"A","last_name":"B","dni":"42111222","birth_date":"1990-02-30","gender":"masculino"}')$$, 'invalid_birth_date');
select t.expect_error($$insert into auth.users (email, raw_user_meta_data) values ('r7@test', '{"first_name":"A","last_name":"B","dni":"4211122a","birth_date":"1990-01-01","gender":"masculino"}')$$, 'declared_identities_dni_check');
select t.expect_error($$insert into auth.users (email, raw_user_meta_data) values ('r8@test', '{"first_name":"A","last_name":"B","dni":"042111222","birth_date":"1990-01-01","gender":"masculino"}')$$, 'declared_identities_dni_check');
select t.expect_error($$insert into auth.users (email, raw_user_meta_data) values ('r9@test', '{"first_name":"A","last_name":"B","dni":"42111222","birth_date":"1990-01-01","gender":"otro"}')$$, 'declared_identities_gender_check');
select t.expect_error($$insert into auth.users (email, raw_user_meta_data) values ('r10@test', '{"first_name":"Juan2","last_name":"B","dni":"42111222","birth_date":"1990-01-01","gender":"masculino"}')$$, 'declared_identities_first_name_check');
select t.expect_error($$insert into auth.users (email, raw_user_meta_data) values ('r11@test', '{"dni":"42111222"}')$$, 'invalid_input');
select t.expect_error($$insert into auth.users (email, raw_user_meta_data) values ('r12@test', '{"first_name":" ","last_name":"B","dni":"42111222","birth_date":"1990-01-01","gender":"masculino"}')$$, 'invalid_input');
select t.assert(not exists (select 1 from auth.users where email like 'r%@test'), 'los registros rechazados no crean usuario');
select t.assert((select count(*) from private.declared_identities where dni = '42111222') = 0, 'ni datos declarados');

-- 18 años justos: entra (sin confirmar el email todavía)
insert into auth.users (id, email, raw_user_meta_data) values
  ('77777777-7777-7777-7777-777777777777', 'justo@test',
   jsonb_build_object('first_name','Justo','last_name','Dieciocho','dni','42111222','gender','masculino','birth_date',(current_date - interval '18 years')::date));

-- Alta sin datos declarados (dashboard, OAuth): se crea la cuenta pero no queda habilitada
insert into auth.users (id, email, email_confirmed_at) values ('88888888-8888-8888-8888-888888888888', 'dashboard@test', now());
select t.assert(exists (select 1 from profiles where id = '88888888-8888-8888-8888-888888888888')
                and not exists (select 1 from private.declared_identities where user_id = '88888888-8888-8888-8888-888888888888'), 'alta sin datos: profile sí, datos declarados no');

-- ---------- Email sin confirmar: no puede crear eventos ni pedir unirse ----------
set role authenticated;
set request.jwt.claim.sub = '66666666-6666-6666-6666-666666666666';
select t.assert(not public.is_account_enabled(), 'email sin confirmar -> no habilitada');
select t.assert(public.can_join_event('e0000000-0000-0000-0000-000000000002') = 'email_not_confirmed', 'email sin confirmar -> can_join email_not_confirmed');
select t.expect_error($$select public.request_to_join('e0000000-0000-0000-0000-000000000002')$$, 'email_not_confirmed');
select t.expect_error($$insert into events (organizer_id, title, category, starts_at, spots_total, organizer_name, organizer_initials) values ('66666666-6666-6666-6666-666666666666','x','Social',now()+interval '1 day',5,'x','X')$$, 'row-level security');
reset role;

-- ---------- Confirma el email: cuenta habilitada, sin ARCA ----------
update auth.users set email_confirmed_at = now()
where id in ('66666666-6666-6666-6666-666666666666', '77777777-7777-7777-7777-777777777777');

set role authenticated;
set request.jwt.claim.sub = '66666666-6666-6666-6666-666666666666';
select t.assert(public.is_account_enabled(), 'email confirmado -> habilitada');
select t.assert(not public.is_verified(), 'habilitada sin identidad ARCA');
select t.assert(public.can_join_event('e0000000-0000-0000-0000-000000000002') = 'ok', 'femenina confirmada a evento femenino -> ok');
select t.assert(public.can_join_event('e0000000-0000-0000-0000-000000000003') = 'gender', 'el género declarado se usa para los requisitos');
select public.request_to_join('e0000000-0000-0000-0000-000000000002');
insert into events (id, organizer_id, title, category, starts_at, spots_total, organizer_name, organizer_initials)
values ('e0000000-0000-0000-0000-000000000006','66666666-6666-6666-6666-666666666666','Evento de Sofía','Social',now()+interval '2 days',3,'x','X');
reset role;
select t.assert((select organizer_name = 'Sofía R.' and organizer_initials = 'SR' from events where id = 'e0000000-0000-0000-0000-000000000006'), 'nombre visible desde los datos declarados');

set role authenticated;
set request.jwt.claim.sub = '77777777-7777-7777-7777-777777777777';
select t.assert(public.can_join_event('e0000000-0000-0000-0000-000000000004') = 'age', 'la edad declarada se usa para los requisitos (18 a evento 21-25)');
select t.assert(public.can_join_event('e0000000-0000-0000-0000-000000000006') = 'ok', '18 justos a evento sin límite -> ok');
select public.request_to_join('e0000000-0000-0000-0000-000000000006');

-- Cuenta existente (identidad mock) pide unirse al evento de Sofía
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.request_to_join('e0000000-0000-0000-0000-000000000006');

-- Email confirmado pero sin datos declarados
set request.jwt.claim.sub = '88888888-8888-8888-8888-888888888888';
select t.assert(public.can_join_event('e0000000-0000-0000-0000-000000000006') = 'profile_incomplete', 'sin datos declarados -> profile_incomplete');
select t.expect_error($$insert into events (organizer_id, title, category, starts_at, spots_total, organizer_name, organizer_initials) values ('88888888-8888-8888-8888-888888888888','x','Social',now()+interval '1 day',5,'x','X')$$, 'row-level security');

-- La organizadora responde
set request.jwt.claim.sub = '66666666-6666-6666-6666-666666666666';
select t.assert((select string_agg(display_name, ',' order by created_at) from get_event_requests('e0000000-0000-0000-0000-000000000006')) = 'Justo D.,Lucía M.', 've los nombres visibles de los solicitantes');
select t.assert(public.respond_to_request((select id from event_requests where event_id = 'e0000000-0000-0000-0000-000000000006' and user_id = '11111111-1111-1111-1111-111111111111'), true) = 'accepted', 'organizadora confirmada acepta');
reset role;

-- Si su email dejara de estar confirmado, no puede responder
update auth.users set email_confirmed_at = null where id = '66666666-6666-6666-6666-666666666666';
set role authenticated;
set request.jwt.claim.sub = '66666666-6666-6666-6666-666666666666';
select t.expect_error($$select public.respond_to_request((select id from event_requests where event_id = 'e0000000-0000-0000-0000-000000000006' and user_id = '77777777-7777-7777-7777-777777777777'), true)$$, 'email_not_confirmed');
reset role;
update auth.users set email_confirmed_at = now() where id = '66666666-6666-6666-6666-666666666666';

-- ---------- ARCA (etapa futura) ----------
set role authenticated;
select t.expect_error($$select public.save_verified_identity('66666666-6666-6666-6666-666666666666','40111222','27401112223','Sofía','Ruiz-Díaz','1999-05-20','femenino','arca')$$, 'permission denied');
reset role;

set role service_role;
select t.assert(not public.identity_dni_available('40111222'), 'DNI declarado no disponible para otro');
select t.assert(public.identity_dni_available('40111222', '66666666-6666-6666-6666-666666666666'), 'su propio DNI declarado sí, para verificarlo con ARCA');
select t.assert(not public.identity_dni_available('30123456', '66666666-6666-6666-6666-666666666666'), 'DNI de otra cuenta no disponible');
select t.assert(public.identity_dni_available('49999999'), 'DNI libre');
select t.expect_error($$select public.save_verified_identity('66666666-6666-6666-6666-666666666666','40111222','27401112223','Sofía','Ruiz-Díaz','1999-05-20','femenino','mock')$$, 'invalid_source');
select t.expect_error($$select public.save_verified_identity('33333333-3333-3333-3333-333333333333','40111222','27401112223','Otra','Persona','1999-05-20','femenino','arca')$$, 'dni_taken');
select public.save_verified_identity('66666666-6666-6666-6666-666666666666','40111222','27401112223','Sofía','Ruiz-Díaz','1999-05-20','femenino','arca');
reset role;
select t.expect_error($$insert into private.identities (user_id, dni, cuil, first_name, last_name, birth_date, gender, source) values ('33333333-3333-3333-3333-333333333333','49999999','20499999993','X','Y','1990-01-01','masculino','mock')$$, 'identities_source_arca_only');

set role authenticated;
set request.jwt.claim.sub = '66666666-6666-6666-6666-666666666666';
select t.assert(public.is_verified(), 'solo una verificación source = arca cuenta como verificada');
reset role;

-- ---------- Baja de cuenta ----------
delete from auth.users where id in ('77777777-7777-7777-7777-777777777777', '88888888-8888-8888-8888-888888888888');
select t.assert(not exists (select 1 from private.declared_identities where user_id = '77777777-7777-7777-7777-777777777777'), 'borrar el usuario borra sus datos declarados');

select 'MVP VERIFICACIÓN EMAIL: TODAS LAS PRUEBAS OK' as resultado;
