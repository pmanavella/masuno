-- Identidad verificada contra ARCA (app solo para mayores de 18).
--
-- Los datos sensibles (DNI, CUIL, fecha de nacimiento; Ley 25.326) viven en el schema
-- private, que no está expuesto por la API de Supabase y sobre el que anon/authenticated
-- no tienen ningún permiso. Solo se accede a través de funciones security definer:
--   - is_verified():             el usuario actual tiene identidad verificada (cualquiera).
--   - get_my_identity():         el dueño ve sus propios datos, con DNI/CUIL enmascarados.
--   - identity_dni_available():  solo service_role (backend), antes de consultar a ARCA.
--   - save_verified_identity():  solo service_role (backend), tras validar contra ARCA.
--
-- Además: se sacan dni y birth_date de profiles (datos sin validar, se descartan), y
-- events pasa a age_min >= 18 (default 18) con age_max nullable (null = sin límite).

-- ---------------------------------------------------------------------------
-- Schema privado
-- ---------------------------------------------------------------------------

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.identities (
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- Sin puntos ni ceros a la izquierda, para que UNIQUE no se pueda esquivar con variantes.
  dni text not null unique check (dni ~ '^[1-9][0-9]{6,7}$'),
  -- Obtenido de ARCA (getIdPersonaListByDocumento + getPersona), nunca tipeado por el usuario.
  cuil text not null unique check (cuil ~ '^[0-9]{11}$'),
  first_name text not null check (length(btrim(first_name)) > 0),
  last_name text not null check (length(btrim(last_name)) > 0),
  birth_date date not null,
  -- Autopercibido, no se valida contra ARCA.
  gender text not null check (gender in ('masculino', 'femenino', 'no_binario')),
  source text not null check (source in ('arca', 'mock')),
  verified_at timestamptz not null default now()
);

-- Defensa en profundidad: aunque el schema se expusiera por error, sin políticas no se lee nada.
alter table private.identities enable row level security;
revoke all on private.identities from public, anon, authenticated;

-- Edad en años cumplidos a una fecha dada. Se calcula siempre desde birth_date, nunca se guarda.
create function private.age_years(p_birth_date date, p_at date default current_date)
returns int
language sql
immutable
set search_path = ''
as $$
  select extract(year from age(p_at, p_birth_date))::int;
$$;

-- La regla de 18+ vive en la base: aunque el backend fallara, no entra un menor.
create function private.enforce_adult_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.birth_date > current_date then
    raise exception 'invalid_birth_date';
  end if;
  if private.age_years(new.birth_date) < 18 then
    raise exception 'underage';
  end if;
  return new;
end;
$$;

create trigger identities_enforce_adult
  before insert or update of birth_date on private.identities
  for each row execute procedure private.enforce_adult_identity();

-- ---------------------------------------------------------------------------
-- Funciones públicas
-- ---------------------------------------------------------------------------

create function public.is_verified()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from private.identities where user_id = auth.uid());
$$;

revoke execute on function public.is_verified() from public;
grant execute on function public.is_verified() to anon, authenticated, service_role;

-- Solo devuelve la fila del usuario que llama (auth.uid()); vacía si no está verificado.
create function public.get_my_identity()
returns table (
  dni_masked text,
  cuil_masked text,
  first_name text,
  last_name text,
  birth_date date,
  age int,
  gender text,
  verified_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    repeat('*', length(i.dni) - 3) || right(i.dni, 3),
    left(i.cuil, 2) || '-' || repeat('*', 5) || substr(i.cuil, 8, 3) || '-' || right(i.cuil, 1),
    i.first_name,
    i.last_name,
    i.birth_date,
    private.age_years(i.birth_date),
    i.gender,
    i.verified_at
  from private.identities i
  where i.user_id = auth.uid();
$$;

revoke execute on function public.get_my_identity() from public, anon;
grant execute on function public.get_my_identity() to authenticated;

-- Lo usa el backend antes de consultar a ARCA, para no gastar una consulta en un DNI ya tomado.
create function public.identity_dni_available(p_dni text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (select 1 from private.identities where dni = p_dni);
$$;

revoke execute on function public.identity_dni_available(text) from public, anon, authenticated;
grant execute on function public.identity_dni_available(text) to service_role;

-- Única vía de escritura en private.identities. La llama el backend (service role) solo
-- después de validar los datos contra ARCA. Errores con código estable en el mensaje:
-- already_verified, dni_taken, underage, invalid_birth_date.
create function public.save_verified_identity(
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
    -- DNI o CUIL ya asociados a otra cuenta: un DNI = una cuenta.
    raise exception 'dni_taken';
end;
$$;

revoke execute on function public.save_verified_identity(uuid, text, text, text, text, date, text, text)
  from public, anon, authenticated;
grant execute on function public.save_verified_identity(uuid, text, text, text, text, date, text, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- profiles: fuera los datos sensibles sin validar
-- ---------------------------------------------------------------------------

alter table public.profiles
  drop column dni,
  drop column birth_date;

drop policy "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- events: solo mayores de 18; age_max null = sin límite
-- (el SELECT sigue siendo público para todos: events_select_public no cambia)
-- ---------------------------------------------------------------------------

alter table public.events
  alter column age_min set default 18,
  alter column age_max drop not null,
  alter column age_max drop default;

update public.events set age_max = null where age_max >= 99;
update public.events set age_min = 18 where age_min < 18;

alter table public.events
  add constraint events_age_min_check check (age_min >= 18),
  add constraint events_age_max_check check (age_max is null or age_max >= age_min);

-- Género unificado en minúsculas sin tildes (mismos valores que private.identities.gender,
-- más 'indistinto'). Las etiquetas con mayúscula/tilde son cosa de la UI.
alter table public.events drop constraint events_gender_check;
update public.events set gender = lower(gender);
alter table public.events alter column gender set default 'indistinto';
alter table public.events add constraint events_gender_check
  check (gender in ('indistinto', 'masculino', 'femenino', 'no_binario'));
