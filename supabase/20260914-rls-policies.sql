-- RLS: cada usuario ve/edita solo su propio profile; los eventos son de lectura pública
-- (no hay política de insert/update/delete sobre events: nadie puede escribir todavía
-- salvo con la service role key, usada solo para seeds/administración).

alter table public.profiles enable row level security;
alter table public.events enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

create policy "events_select_public" on public.events
  for select using (true);
