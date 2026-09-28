-- Pruebas de 20260927-backend-identidad.sql. Reutiliza los usuarios de las pruebas anteriores.
\set ON_ERROR_STOP 1

-- profiles: solo phone es editable por el usuario
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select t.expect_error($$update profiles set full_name = 'Otra Persona' where id = auth.uid()$$, 'permission denied');
update profiles set phone = '3510000000', updated_at = now() where id = auth.uid();
select t.assert((select phone = '3510000000' and full_name = 'Lucía Belén Martínez' from profiles where id = auth.uid()), 'edita phone, full_name intacto');
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
update profiles set phone = 'hack' where id = '11111111-1111-1111-1111-111111111111';
reset role;
select t.assert((select phone from profiles where id = '11111111-1111-1111-1111-111111111111') = '3510000000', 'no edita el profile de otro');

-- Solo service_role usa límites de intentos y tickets de ARCA
set role authenticated;
select t.expect_error($$select public.consume_identity_attempt(auth.uid(), 100, 60)$$, 'permission denied');
select t.expect_error($$select * from public.get_arca_ticket('ws_sr_padron_a13')$$, 'permission denied');
select t.expect_error($$select public.save_arca_ticket('ws_sr_padron_a13', 't', 's', now() + interval '1 hour')$$, 'permission denied');
select t.expect_error($$select * from private.arca_tickets$$, 'permission denied');
reset role;
set role anon;
select t.expect_error($$select public.consume_identity_attempt('33333333-3333-3333-3333-333333333333', 100, 60)$$, 'permission denied');
reset role;

-- Límite de intentos
set role service_role;
select t.assert(public.consume_identity_attempt('33333333-3333-3333-3333-333333333333', 3, 60), 'intento 1');
select t.assert(public.consume_identity_attempt('33333333-3333-3333-3333-333333333333', 3, 60), 'intento 2');
select t.assert(public.consume_identity_attempt('33333333-3333-3333-3333-333333333333', 3, 60), 'intento 3');
select t.assert(not public.consume_identity_attempt('33333333-3333-3333-3333-333333333333', 3, 60), 'intento 4 rechazado');
select t.assert(public.consume_identity_attempt('11111111-1111-1111-1111-111111111111', 3, 60), 'el límite es por usuario');
select pg_sleep(0.01);
select t.assert(public.consume_identity_attempt('33333333-3333-3333-3333-333333333333', 3, 0), 'fuera de la ventana vuelve a permitir');

-- Ticket de WSAA
select t.assert((select count(*) from public.get_arca_ticket('ws_sr_padron_a13')) = 0, 'sin ticket');
select public.save_arca_ticket('ws_sr_padron_a13', 'tok1', 'sig1', now() + interval '1 minute');
select t.assert((select count(*) from public.get_arca_ticket('ws_sr_padron_a13')) = 0, 'ticket por vencer no se devuelve');
select public.save_arca_ticket('ws_sr_padron_a13', 'tok2', 'sig2', now() + interval '12 hours');
select t.assert((select token = 'tok2' and sign = 'sig2' from public.get_arca_ticket('ws_sr_padron_a13')), 'ticket vigente');
reset role;

select 'BACKEND IDENTIDAD: TODAS LAS PRUEBAS OK' as resultado;
