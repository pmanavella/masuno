-- Pruebas de 20260927-identidad-verificada.sql. Corre como postgres y cambia de rol con set role.
-- Usuarios: 1111 Lucía (verificada), 2222 Justo (18 justos), 3333 sin verificar.
\set ON_ERROR_STOP 1


insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'adulta@test'),
  ('22222222-2222-2222-2222-222222222222', 'menor@test'),
  ('33333333-3333-3333-3333-333333333333', 'otro@test');
insert into public.profiles (id) select id from auth.users on conflict do nothing;

-- Datos migrados en events
select t.assert((select count(*) from events where age_max is null) = 2, 'age_max 99 -> null');
select t.assert((select bool_and(age_min >= 18) from events), 'age_min >= 18');
select t.assert((select bool_and(gender in ('indistinto','femenino')) from events), 'gender en minúsculas');
select t.expect_error($$insert into events (title, category, starts_at, spots_total, organizer_name, organizer_initials, age_min) values ('x','Social',now(),5,'a','A',17)$$, 'events_age_min_check');
select t.expect_error($$insert into events (title, category, starts_at, spots_total, organizer_name, organizer_initials, age_min, age_max) values ('x','Social',now(),5,'a','A',30,25)$$, 'events_age_max_check');
select t.expect_error($$insert into events (title, category, starts_at, spots_total, organizer_name, organizer_initials, gender) values ('x','Social',now(),5,'a','A','Femenino')$$, 'events_gender_check');
select t.assert(not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name in ('dni','birth_date')), 'profiles sin dni/birth_date');

-- anon
set role anon;
select t.assert((select count(*) from events) > 0, 'anon ve eventos');
select t.assert(public.is_verified() = false, 'anon no verificado');
select t.expect_error('select * from private.identities', 'permission denied');
select t.expect_error('select * from public.get_my_identity()', 'permission denied');
select t.expect_error($$select public.identity_dni_available('30123456')$$, 'permission denied');
select t.expect_error($$select public.save_verified_identity('11111111-1111-1111-1111-111111111111','30123456','27301234564','Lucía','Martínez','1995-03-10','femenino','mock')$$, 'permission denied');
reset role;

-- authenticated (sin verificar)
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select t.assert(public.is_verified() = false, 'logueada sin verificar');
select t.assert((select count(*) from public.get_my_identity()) = 0, 'get_my_identity vacío sin verificar');
select t.assert((select count(*) from events) > 0, 'sin verificar ve eventos');
select t.expect_error('select * from private.identities', 'permission denied');
select t.expect_error($$select public.save_verified_identity('11111111-1111-1111-1111-111111111111','30123456','27301234564','Lucía','Martínez','1995-03-10','femenino','mock')$$, 'permission denied');
reset role;

-- service_role (backend)
set role service_role;
select t.assert(public.identity_dni_available('30123456'), 'DNI disponible');
select public.save_verified_identity('11111111-1111-1111-1111-111111111111','30123456','27301234564',' Lucía Belén ','Martínez','1995-03-10','femenino','mock');
select t.assert(not public.identity_dni_available('30123456'), 'DNI ya tomado');
select t.expect_error($$select public.save_verified_identity('11111111-1111-1111-1111-111111111111','40111222','20401112223','Lucía','Martínez','1995-03-10','femenino','mock')$$, 'already_verified');
select t.expect_error($$select public.save_verified_identity('33333333-3333-3333-3333-333333333333','30123456','27301234564','Otra','Persona','1990-01-01','femenino','mock')$$, 'dni_taken');
select t.expect_error($$select public.save_verified_identity('33333333-3333-3333-3333-333333333333','30999999','27301234564','Otra','Persona','1990-01-01','femenino','mock')$$, 'dni_taken');
select t.expect_error($$select public.save_verified_identity('22222222-2222-2222-2222-222222222222','50111222','20501112229','Menor','Test',(current_date - interval '17 years')::date,'masculino','mock')$$, 'underage');
select t.expect_error($$select public.save_verified_identity('22222222-2222-2222-2222-222222222222','50111222','20501112229','Menor','Test',(current_date - interval '18 years' + interval '1 day')::date,'masculino','mock')$$, 'underage');
select public.save_verified_identity('22222222-2222-2222-2222-222222222222','50111222','20501112229','Justo','Dieciocho',(current_date - interval '18 years')::date,'masculino','mock');
select t.expect_error($$select public.save_verified_identity('33333333-3333-3333-3333-333333333333','30999999','20309999994','X','Y',current_date + 1,'masculino','mock')$$, 'invalid_birth_date');
select t.expect_error($$select public.save_verified_identity('33333333-3333-3333-3333-333333333333','030999999','20309999994','X','Y','1990-01-01','masculino','mock')$$, 'identities_dni_check');
select t.expect_error($$select public.save_verified_identity('33333333-3333-3333-3333-333333333333','30999999','20309999994','X','Y','1990-01-01','otro','mock')$$, 'identities_gender_check');
reset role;

-- Dueño verificado ve lo suyo, enmascarado; otro usuario no ve nada ajeno
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select t.assert(public.is_verified(), 'verificada');
select t.assert((select dni_masked from public.get_my_identity()) = '*****456', 'DNI enmascarado');
select t.assert((select cuil_masked from public.get_my_identity()) = '27-*****456-4', 'CUIL enmascarado');
select t.assert((select age from public.get_my_identity()) = extract(year from age(current_date, '1995-03-10'))::int, 'edad calculada');
select t.assert((select full_name from profiles where id = auth.uid()) = 'Lucía Belén Martínez', 'full_name completado');
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select t.assert(not public.is_verified(), 'otro usuario no verificado');
select t.assert((select count(*) from public.get_my_identity()) = 0, 'otro no ve identidad ajena');
select t.assert((select count(*) from profiles) = 1, 'solo ve su propio profile');
reset role;

select 'PASO 1: TODAS LAS PRUEBAS OK' as resultado;
