-- Simula lo mínimo de Supabase: roles, auth.users, auth.uid() leyendo el claim del JWT, publicación de Realtime.
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
create publication supabase_realtime;

-- Helpers de las pruebas
create schema t;
grant usage on schema t to anon, authenticated, service_role;

-- Ejecuta sql y exige que falle con un mensaje que contenga expected.
create function t.expect_error(p_sql text, p_expected text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'SE ESPERABA ERROR "%" y no falló: %', p_expected, p_sql;
exception when others then
  if sqlerrm like 'SE ESPERABA%' or position(p_expected in sqlerrm) = 0 then
    raise exception 'Error inesperado para "%": % (esperado: %)', p_sql, sqlerrm, p_expected;
  end if;
  raise notice 'ok: % -> %', left(p_sql, 70), sqlerrm;
end $$;
create function t.assert(p_cond boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_cond is not true then raise exception 'FALLÓ: %', p_msg; end if;
  raise notice 'ok: %', p_msg;
end $$;
grant execute on all functions in schema t to anon, authenticated, service_role;
