-- Lista de espera de la prueba piloto (landing de +1)
-- La landing solo puede INSERTAR. Nadie puede leer la lista desde la página:
-- se consulta desde el panel de Supabase (Table Editor).

create table if not exists public.lista_espera (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null check (char_length(trim(nombre)) between 1 and 80),
  apellido    text not null check (char_length(trim(apellido)) between 1 and 80),
  email       text not null unique
              check (email = lower(email) and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$'),
  created_at  timestamptz not null default now()
);

alter table public.lista_espera enable row level security;

-- Permitir que visitantes anónimos se anoten (solo insertar)
drop policy if exists "landing puede anotarse" on public.lista_espera;
create policy "landing puede anotarse"
  on public.lista_espera
  for insert
  to anon
  with check (true);

grant insert on public.lista_espera to anon;

-- Sin políticas de SELECT, UPDATE ni DELETE: desde la web no se puede ver ni modificar la lista.
-- Para contar inscriptos:  select count(*) from public.lista_espera;
