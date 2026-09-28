-- Soporte en la base para la verificación de identidad desde el backend Express:
--
-- - profiles: el usuario solo puede editar phone. full_name lo completa la verificación
--   (save_verified_identity) y ya no se puede cambiar desde el cliente.
-- - Límite de intentos de verificación por usuario (consume_identity_attempt), para que no
--   se pueda usar el formulario para averiguar datos de terceros probando DNIs.
-- - Caché del ticket de acceso de WSAA (token + sign, dura ~12 h). ARCA rechaza pedir un
--   ticket nuevo mientras haya uno vigente, así que se guarda en la base y sobrevive a
--   reinicios del backend. Son credenciales: viven en private y solo las toca service_role.

-- ---------------------------------------------------------------------------
-- profiles: permisos por columna
-- ---------------------------------------------------------------------------

revoke update on public.profiles from anon, authenticated;
grant update (phone, updated_at) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Intentos de verificación
-- ---------------------------------------------------------------------------

create table private.identity_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index identity_attempts_user_id_created_at_idx
  on private.identity_attempts (user_id, created_at);

alter table private.identity_attempts enable row level security;
revoke all on private.identity_attempts from public, anon, authenticated;

-- Registra un intento si el usuario no superó p_max en la ventana; devuelve false si lo superó.
create function public.consume_identity_attempt(p_user_id uuid, p_max int, p_window_minutes int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  -- Serializa intentos simultáneos del mismo usuario.
  perform pg_advisory_xact_lock(hashtext('identity_attempt:' || p_user_id::text));

  delete from private.identity_attempts
  where user_id = p_user_id
    and created_at < now() - make_interval(mins => p_window_minutes);

  select count(*) into v_count from private.identity_attempts where user_id = p_user_id;
  if v_count >= p_max then
    return false;
  end if;

  insert into private.identity_attempts (user_id) values (p_user_id);
  return true;
end;
$$;

revoke execute on function public.consume_identity_attempt(uuid, int, int) from public, anon, authenticated;
grant execute on function public.consume_identity_attempt(uuid, int, int) to service_role;

-- ---------------------------------------------------------------------------
-- Ticket de acceso de WSAA (ARCA)
-- ---------------------------------------------------------------------------

create table private.arca_tickets (
  service text primary key,
  token text not null,
  sign text not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table private.arca_tickets enable row level security;
revoke all on private.arca_tickets from public, anon, authenticated;

-- Ticket vigente con al menos 5 minutos de margen; vacío si no hay.
create function public.get_arca_ticket(p_service text)
returns table (token text, sign text, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select t.token, t.sign, t.expires_at
  from private.arca_tickets t
  where t.service = p_service
    and t.expires_at > now() + interval '5 minutes';
$$;

create function public.save_arca_ticket(p_service text, p_token text, p_sign text, p_expires_at timestamptz)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.arca_tickets (service, token, sign, expires_at)
  values (p_service, p_token, p_sign, p_expires_at)
  on conflict (service) do update
    set token = excluded.token,
        sign = excluded.sign,
        expires_at = excluded.expires_at,
        updated_at = now();
$$;

revoke execute on function public.get_arca_ticket(text) from public, anon, authenticated;
grant execute on function public.get_arca_ticket(text) to service_role;
revoke execute on function public.save_arca_ticket(text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.save_arca_ticket(text, text, text, timestamptz) to service_role;
