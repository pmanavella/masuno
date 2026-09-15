-- Crea profiles (datos extra de cada usuario) y events (eventos del feed),
-- más el trigger que inicializa profiles apenas se registra un usuario.

create extension if not exists "pgcrypto";

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  dni text,
  birth_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text not null check (category in ('Deportes', 'Social', 'Aire libre', 'Cultura', 'Networking')),
  city text not null default 'Córdoba Capital',
  starts_at timestamptz not null,
  spots_total int not null check (spots_total > 0),
  spots_taken int not null default 0,
  age_min int not null default 16,
  age_max int not null default 99,
  gender text not null default 'Indistinto' check (gender in ('Femenino', 'Masculino', 'Indistinto')),
  -- Denormalizado a propósito: todavía no hay creación de eventos ni organizadores reales
  -- vinculados a profiles. Cuando se implemente esa iteración, sumar organizer_id uuid
  -- references profiles(id) y migrar estos datos.
  organizer_name text not null,
  organizer_initials text not null,
  organizer_rating numeric(2, 1) not null default 0,
  organizer_review_count int not null default 0,
  created_at timestamptz not null default now()
);
