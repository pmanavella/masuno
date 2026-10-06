-- MVP: la única verificación obligatoria es el email confirmado (Supabase Auth). ARCA queda
-- preparado pero fuera del flujo.
--
-- Separa dos conceptos que antes estaban mezclados en private.identities:
--
--   DATOS DECLARADOS (private.declared_identities, nueva): nombre, apellido, DNI, fecha de
--   nacimiento y género que el usuario carga al registrarse. NO están verificados contra
--   ningún registro oficial. Se usan para la edad, el género de los eventos y el nombre
--   visible ("Lucía M."). UNIQUE(dni): un DNI = una cuenta.
--
--   IDENTIDAD VERIFICADA POR ARCA (private.identities, ya existía): solo la escribe el backend
--   después de consultar a ARCA (hoy deshabilitado). is_verified() pasa a significar
--   exclusivamente "verificada por ARCA" (source = 'arca') y ya no controla ningún permiso.
--
-- Cuenta habilitada para acciones protegidas (is_account_enabled):
--   email confirmado (auth.users.email_confirmed_at) + datos declarados cargados.
--
-- Cambios:
--   1. private.declared_identities + regla 18+ (reutiliza private.enforce_adult_identity).
--   2. Copia los datos de private.identities existentes (incluidas las 'mock') como datos
--      declarados, para que esas cuentas sigan funcionando. No borra nada.
--   3. handle_new_user(): al registrarse, toma los datos declarados del user_metadata del
--      signUp, los valida, los guarda y los saca del metadata (para que no viajen en el JWT).
--      Si el DNI ya está tomado o la persona es menor, el signUp falla y no se crea la cuenta.
--   4. Permisos: is_account_enabled(); policy de creación de eventos, can_join_event() y
--      respond_to_request() dejan de exigir identidad ARCA.
--   5. Nombre visible ("Nombre I.") desde los datos declarados.
--   6. get_my_declared_identity(): el dueño ve sus datos declarados con el DNI enmascarado.
--   7. ARCA (para la etapa futura): is_verified() solo cuenta source = 'arca';
--      save_verified_identity() rechaza source <> 'arca' y DNIs declarados por otra cuenta;
--      identity_dni_available() mira las dos tablas.
--
-- Idempotente: se puede ejecutar más de una vez. No toca private.identity_attempts ni
-- private.arca_tickets.

begin;

-- ---------------------------------------------------------------------------
-- 1. Datos declarados
-- ---------------------------------------------------------------------------

create table if not exists private.declared_identities (
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- Texto, sin puntos ni ceros a la izquierda, para que UNIQUE no se pueda esquivar con variantes.
  dni text not null unique check (dni ~ '^[1-9][0-9]{6,7}$'),
  first_name text not null check (length(btrim(first_name)) between 1 and 100 and first_name !~ '[0-9<>]'),
  last_name text not null check (length(btrim(last_name)) between 1 and 100 and last_name !~ '[0-9<>]'),
  birth_date date not null,
  -- Mismos valores que private.identities.gender. Autopercibido.
  gender text not null check (gender in ('masculino', 'femenino', 'no_binario')),
  created_at timestamptz not null default now()
);

comment on table private.declared_identities is
  'Datos personales declarados por el usuario al registrarse. NO verificados contra ARCA ni otro registro oficial.';

alter table private.declared_identities enable row level security;
revoke all on private.declared_identities from public, anon, authenticated;

-- Misma regla de 18+ que private.identities (invalid_birth_date / underage).
drop trigger if exists declared_identities_enforce_adult on private.declared_identities;
create trigger declared_identities_enforce_adult
  before insert or update of birth_date on private.declared_identities
  for each row execute procedure private.enforce_adult_identity();

-- ---------------------------------------------------------------------------
-- 2. Cuentas existentes: sus datos pasan a ser datos declarados
-- ---------------------------------------------------------------------------

-- Las identidades guardadas antes (incluidas las source = 'mock', que nunca se validaron
-- contra ARCA) se copian como datos declarados. private.identities queda intacta.
insert into private.declared_identities (user_id, dni, first_name, last_name, birth_date, gender, created_at)
select user_id, dni, first_name, last_name, birth_date, gender, verified_at
from private.identities
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 3. Alta de usuario: datos declarados desde el signUp
-- ---------------------------------------------------------------------------

-- El backend llama a supabase.auth.signUp con options.data = { first_name, last_name, dni,
-- birth_date, gender } (ya validados). Este trigger corre dentro de la misma transacción que
-- crea el usuario: si algo falla (DNI tomado, menor de edad, dato inválido), Supabase Auth
-- responde "Database error saving new user", no se crea la cuenta y no se envía el email.
--
-- Un alta sin esos datos (usuarios creados desde el dashboard, OAuth) crea la cuenta sin datos
-- declarados: puede loguearse pero no queda habilitada (profile_incomplete).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_keys text[] := array['first_name', 'last_name', 'dni', 'birth_date', 'gender'];
  v_birth_date date;
begin
  insert into public.profiles (id) values (new.id);

  if not (v_meta ?| v_keys) then
    return new;
  end if;

  -- Si viene alguno, tienen que venir todos.
  if exists (select 1 from unnest(v_keys) k where nullif(btrim(v_meta ->> k), '') is null) then
    raise exception 'invalid_input';
  end if;

  begin
    v_birth_date := (v_meta ->> 'birth_date')::date;
  exception when others then
    raise exception 'invalid_birth_date';
  end;

  begin
    insert into private.declared_identities (user_id, dni, first_name, last_name, birth_date, gender)
    values (
      new.id,
      v_meta ->> 'dni',
      btrim(v_meta ->> 'first_name'),
      btrim(v_meta ->> 'last_name'),
      v_birth_date,
      v_meta ->> 'gender'
    );
  exception when unique_violation then
    -- Un DNI = una cuenta. No se revela nada de la otra cuenta.
    raise exception 'dni_taken';
  end;

  update public.profiles
  set full_name = btrim(v_meta ->> 'first_name') || ' ' || btrim(v_meta ->> 'last_name'),
      updated_at = now()
  where id = new.id;

  -- Los datos sensibles quedan solo en private: se sacan del user_metadata, que viaja en el JWT
  -- y el usuario puede modificar. (Supabase Auth relee el usuario después de los triggers.)
  begin
    update auth.users set raw_user_meta_data = raw_user_meta_data - v_keys where id = new.id;
  exception when insufficient_privilege then
    raise warning 'handle_new_user: no se pudo limpiar raw_user_meta_data';
  end;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Por si Supabase Auth copia el metadata del signUp en auth.identities.identity_data.
create or replace function public.strip_declared_identity_data()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.identity_data := coalesce(new.identity_data, '{}'::jsonb)
    - array['first_name', 'last_name', 'dni', 'birth_date', 'gender'];
  return new;
end;
$$;

revoke execute on function public.strip_declared_identity_data() from public, anon, authenticated;

drop trigger if exists identities_strip_declared_data on auth.identities;
create trigger identities_strip_declared_data
  before insert on auth.identities
  for each row execute procedure public.strip_declared_identity_data();

-- ---------------------------------------------------------------------------
-- 4. Cuenta habilitada = email confirmado + datos declarados
-- ---------------------------------------------------------------------------

-- null si la cuenta está habilitada; si no, el código de motivo.
create or replace function private.account_block_reason(p_user_id uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when p_user_id is null then 'not_authenticated'
    when not exists (
      select 1 from auth.users u where u.id = p_user_id and u.email_confirmed_at is not null
    ) then 'email_not_confirmed'
    when not exists (
      select 1 from private.declared_identities d where d.user_id = p_user_id
    ) then 'profile_incomplete'
  end;
$$;

create or replace function public.is_account_enabled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.account_block_reason(auth.uid()) is null;
$$;

comment on function public.is_account_enabled() is
  'Cuenta habilitada para acciones protegidas: email confirmado + datos declarados. No depende de ARCA.';

revoke execute on function public.is_account_enabled() from public;
grant execute on function public.is_account_enabled() to anon, authenticated, service_role;

-- Crear eventos: antes exigía is_verified() (identidad ARCA/mock).
drop policy if exists "events_insert_verified" on public.events;
drop policy if exists "events_insert_enabled" on public.events;
create policy "events_insert_enabled" on public.events
  for insert to authenticated
  with check (
    organizer_id = auth.uid()
    and public.is_account_enabled()
    and starts_at > now()
  );

-- Igual que la versión de 20260927-cancelar-solicitudes.sql, salvo que la cuenta habilitada
-- y la edad/género salen de los datos declarados. Códigos nuevos: not_authenticated,
-- email_not_confirmed, profile_incomplete (reemplazan a not_verified).
create or replace function public.can_join_event(p_event_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_block text;
  v_person private.declared_identities;
  v_event public.events;
  v_age int;
begin
  v_block := private.account_block_reason(auth.uid());
  if v_block is not null then
    return v_block;
  end if;

  select * into v_person from private.declared_identities where user_id = auth.uid();

  select * into v_event from public.events where id = p_event_id;
  if not found then
    return 'not_found';
  end if;

  if v_event.organizer_id = auth.uid() then
    return 'own_event';
  end if;

  if exists (
    select 1 from public.event_requests
    where event_id = p_event_id and user_id = auth.uid() and status <> 'cancelled'
  ) then
    return 'already_requested';
  end if;

  if v_event.starts_at <= now() then
    return 'event_started';
  end if;

  if v_event.spots_taken >= v_event.spots_total then
    return 'full';
  end if;

  -- Edad que va a tener el día del evento (hora de Córdoba).
  v_age := private.age_years(
    v_person.birth_date,
    (v_event.starts_at at time zone 'America/Argentina/Cordoba')::date
  );
  if v_age < v_event.age_min or (v_event.age_max is not null and v_age > v_event.age_max) then
    return 'age';
  end if;

  if v_event.gender <> 'indistinto' and v_event.gender <> v_person.gender then
    return 'gender';
  end if;

  return 'ok';
end;
$$;

-- request_to_join() no cambia: llama a can_join_event().

-- Igual que la versión de 20260927-solicitudes-y-avisos.sql, salvo el primer chequeo
-- (antes: is_verified() -> not_verified).
create or replace function public.respond_to_request(p_request_id uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_block text;
  v_request public.event_requests;
  v_event public.events;
  v_status text := case when p_accept then 'accepted' else 'rejected' end;
begin
  v_block := private.account_block_reason(auth.uid());
  if v_block is not null then
    raise exception '%', v_block;
  end if;

  select * into v_request from public.event_requests where id = p_request_id for update;
  if not found then
    raise exception 'not_found';
  end if;

  select * into v_event from public.events where id = v_request.event_id;
  if v_event.organizer_id is distinct from auth.uid() then
    raise exception 'not_found';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'not_pending';
  end if;

  if v_event.starts_at <= now() then
    raise exception 'event_started';
  end if;

  if p_accept then
    -- UPDATE condicional: toma el lock de la fila y re-evalúa la condición, así dos
    -- aceptaciones simultáneas nunca superan spots_total.
    update public.events
    set spots_taken = spots_taken + 1
    where id = v_event.id and spots_taken < spots_total;
    if not found then
      raise exception 'full';
    end if;
  end if;

  update public.event_requests
  set status = v_status, responded_at = now()
  where id = p_request_id;

  return v_status;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Nombre visible desde los datos declarados
-- ---------------------------------------------------------------------------

-- Los usan prepare_new_event (organizer_name / organizer_initials) y get_event_requests.
create or replace function private.display_name(p_user_id uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select split_part(d.first_name, ' ', 1) || ' ' || upper(left(d.last_name, 1)) || '.'
  from private.declared_identities d
  where d.user_id = p_user_id;
$$;

create or replace function private.display_initials(p_user_id uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select upper(left(d.first_name, 1) || left(d.last_name, 1))
  from private.declared_identities d
  where d.user_id = p_user_id;
$$;

-- ---------------------------------------------------------------------------
-- 6. Datos declarados propios (perfil)
-- ---------------------------------------------------------------------------

-- Solo la fila del usuario que llama; vacía si no tiene datos declarados.
create or replace function public.get_my_declared_identity()
returns table (
  dni_masked text,
  first_name text,
  last_name text,
  birth_date date,
  age int,
  gender text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    repeat('*', length(d.dni) - 3) || right(d.dni, 3),
    d.first_name,
    d.last_name,
    d.birth_date,
    private.age_years(d.birth_date),
    d.gender
  from private.declared_identities d
  where d.user_id = auth.uid();
$$;

revoke execute on function public.get_my_declared_identity() from public, anon;
grant execute on function public.get_my_declared_identity() to authenticated;

-- ---------------------------------------------------------------------------
-- 7. ARCA (etapa futura): sin ambigüedad entre "declarado" y "verificado"
-- ---------------------------------------------------------------------------

-- Antes contaba cualquier fila, incluidas las source = 'mock'. Ya no controla permisos.
create or replace function public.is_verified()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.identities where user_id = auth.uid() and source = 'arca'
  );
$$;

comment on function public.is_verified() is
  'Identidad verificada contra ARCA (source = ''arca''). No controla permisos durante el MVP.';

-- Ninguna verificación nueva puede ser mock. NOT VALID: las filas 'mock' existentes quedan
-- como están (no se validan ni se borran), pero no se pueden insertar nuevas.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'identities_source_arca_only'
      and conrelid = 'private.identities'::regclass
  ) then
    alter table private.identities
      add constraint identities_source_arca_only check (source = 'arca') not valid;
  end if;
end;
$$;

-- Ahora mira las dos tablas. p_exclude_user_id: para que el futuro flujo ARCA pueda verificar
-- el DNI que el mismo usuario ya declaró.
drop function if exists public.identity_dni_available(text);
create or replace function public.identity_dni_available(p_dni text, p_exclude_user_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from private.declared_identities
    where dni = p_dni and user_id is distinct from p_exclude_user_id
  )
  and not exists (
    select 1 from private.identities
    where dni = p_dni and user_id is distinct from p_exclude_user_id
  );
$$;

revoke execute on function public.identity_dni_available(text, uuid) from public, anon, authenticated;
grant execute on function public.identity_dni_available(text, uuid) to service_role;

-- Igual que la versión de 20260927-identidad-verificada.sql, más dos chequeos al principio.
create or replace function public.save_verified_identity(
  p_user_id uuid,
  p_dni text,
  p_cuil text,
  p_first_name text,
  p_last_name text,
  p_birth_date date,
  p_gender text,
  p_source text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_constraint text;
begin
  -- Solo una consulta real a ARCA puede marcar una identidad como verificada.
  if p_source is distinct from 'arca' then
    raise exception 'invalid_source';
  end if;

  -- Un DNI = una cuenta, también entre datos declarados e identidades verificadas.
  if exists (
    select 1 from private.declared_identities where dni = p_dni and user_id <> p_user_id
  ) then
    raise exception 'dni_taken';
  end if;

  insert into private.identities
    (user_id, dni, cuil, first_name, last_name, birth_date, gender, source)
  values
    (p_user_id, p_dni, p_cuil, btrim(p_first_name), btrim(p_last_name), p_birth_date, p_gender, p_source);

  update public.profiles
  set full_name = btrim(p_first_name) || ' ' || btrim(p_last_name),
      updated_at = now()
  where id = p_user_id;
exception
  when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'identities_pkey' then
      raise exception 'already_verified';
    end if;
    raise exception 'dni_taken';
end;
$$;

commit;
