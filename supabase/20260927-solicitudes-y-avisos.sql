-- Solicitudes para unirse a eventos y avisos en tiempo real.
--
-- - events.organizer_id: organizador real. Solo un usuario verificado puede crear eventos
--   (RLS), y un trigger completa organizer_name ("Lucía M."), iniciales e imagen por defecto
--   de la categoría, y pisa los campos que no le corresponde elegir (spots_taken, rating).
-- - event_requests: una solicitud por usuario y evento. Solo se escribe a través de
--   request_to_join() y respond_to_request(); no hay políticas de insert/update/delete.
-- - can_join_event(): 'ok' o el código de motivo: not_verified, not_found, own_event,
--   already_requested, event_started, full, age, gender.
-- - respond_to_request(): aceptar incrementa spots_taken con un UPDATE condicional
--   (spots_taken < spots_total), atómico aunque dos aceptaciones compitan por el último lugar.
-- - notifications: se generan por trigger y se publican por Realtime (respeta RLS).
--
-- Los eventos de ejemplo quedan con organizer_id null: se ven, se puede pedir unirse,
-- pero nadie puede responder esas solicitudes.

-- ---------------------------------------------------------------------------
-- events: organizador real y creación solo para verificados
-- ---------------------------------------------------------------------------

alter table public.events
  add column organizer_id uuid references public.profiles(id) on delete cascade;

create index events_organizer_id_idx on public.events (organizer_id);

alter table public.events
  add constraint events_spots_taken_check check (spots_taken >= 0 and spots_taken <= spots_total);

-- Nombre visible fuera del propio perfil: primer nombre + inicial del apellido ("Lucía M.").
create function private.display_name(p_user_id uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select split_part(i.first_name, ' ', 1) || ' ' || upper(left(i.last_name, 1)) || '.'
  from private.identities i
  where i.user_id = p_user_id;
$$;

create function private.display_initials(p_user_id uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select upper(left(i.first_name, 1) || left(i.last_name, 1))
  from private.identities i
  where i.user_id = p_user_id;
$$;

create function private.prepare_new_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Sin organizador: carga administrativa (seeds, service role). Se respeta tal cual.
  if new.organizer_id is null then
    return new;
  end if;

  new.organizer_name := private.display_name(new.organizer_id);
  new.organizer_initials := private.display_initials(new.organizer_id);
  new.organizer_rating := 0;
  new.organizer_review_count := 0;
  new.spots_taken := 0;
  new.created_at := now();

  if new.image_url is null then
    select c.image_url into new.image_url
    from public.category_default_images c
    where c.category = new.category
    order by random()
    limit 1;
  end if;

  return new;
end;
$$;

create trigger events_prepare_new
  before insert on public.events
  for each row execute procedure private.prepare_new_event();

create policy "events_insert_verified" on public.events
  for insert to authenticated
  with check (
    organizer_id = auth.uid()
    and public.is_verified()
    and starts_at > now()
  );

-- ---------------------------------------------------------------------------
-- event_requests
-- ---------------------------------------------------------------------------

create table public.event_requests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (event_id, user_id)
);

create index event_requests_user_id_idx on public.event_requests (user_id);

alter table public.event_requests enable row level security;

-- Cada uno ve sus solicitudes; el organizador ve las de sus eventos.
create policy "event_requests_select_involved" on public.event_requests
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.events e
      where e.id = event_requests.event_id and e.organizer_id = auth.uid()
    )
  );

-- Si se borra una solicitud aceptada (p. ej. el usuario elimina su cuenta), se libera el lugar.
create function private.release_spot_on_request_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'accepted' then
    update public.events
    set spots_taken = greatest(spots_taken - 1, 0)
    where id = old.event_id;
  end if;
  return old;
end;
$$;

create trigger event_requests_release_spot
  after delete on public.event_requests
  for each row execute procedure private.release_spot_on_request_delete();

-- ---------------------------------------------------------------------------
-- Funciones de solicitud
-- ---------------------------------------------------------------------------

create function public.can_join_event(p_event_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_identity private.identities;
  v_event public.events;
  v_age int;
begin
  select * into v_identity from private.identities where user_id = auth.uid();
  if not found then
    return 'not_verified';
  end if;

  select * into v_event from public.events where id = p_event_id;
  if not found then
    return 'not_found';
  end if;

  if v_event.organizer_id = auth.uid() then
    return 'own_event';
  end if;

  if exists (
    select 1 from public.event_requests
    where event_id = p_event_id and user_id = auth.uid()
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
    v_identity.birth_date,
    (v_event.starts_at at time zone 'America/Argentina/Cordoba')::date
  );
  if v_age < v_event.age_min or (v_event.age_max is not null and v_age > v_event.age_max) then
    return 'age';
  end if;

  if v_event.gender <> 'indistinto' and v_event.gender <> v_identity.gender then
    return 'gender';
  end if;

  return 'ok';
end;
$$;

revoke execute on function public.can_join_event(uuid) from public;
grant execute on function public.can_join_event(uuid) to anon, authenticated;

-- Devuelve el id de la solicitud creada; si no puede unirse, falla con el código de motivo.
create function public.request_to_join(p_event_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text;
  v_request_id uuid;
begin
  v_reason := public.can_join_event(p_event_id);
  if v_reason <> 'ok' then
    raise exception '%', v_reason;
  end if;

  insert into public.event_requests (event_id, user_id)
  values (p_event_id, auth.uid())
  returning id into v_request_id;

  return v_request_id;
exception
  -- Dos pedidos simultáneos del mismo usuario: el segundo choca con el UNIQUE.
  when unique_violation then
    raise exception 'already_requested';
end;
$$;

revoke execute on function public.request_to_join(uuid) from public, anon;
grant execute on function public.request_to_join(uuid) to authenticated;

-- Solo el organizador del evento. Errores: not_verified, not_found (inexistente o ajena),
-- not_pending, event_started, full.
create function public.respond_to_request(p_request_id uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.event_requests;
  v_event public.events;
  v_status text := case when p_accept then 'accepted' else 'rejected' end;
begin
  if not public.is_verified() then
    raise exception 'not_verified';
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

revoke execute on function public.respond_to_request(uuid, boolean) from public, anon;
grant execute on function public.respond_to_request(uuid, boolean) to authenticated;

-- Solicitudes de un evento propio, con el nombre visible de cada solicitante ("Lucía M.").
-- Para cualquier otro usuario devuelve vacío.
create function public.get_event_requests(p_event_id uuid)
returns table (
  request_id uuid,
  display_name text,
  initials text,
  status text,
  created_at timestamptz,
  responded_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id,
    private.display_name(r.user_id),
    private.display_initials(r.user_id),
    r.status,
    r.created_at,
    r.responded_at
  from public.event_requests r
  join public.events e on e.id = r.event_id
  where r.event_id = p_event_id
    and e.organizer_id = auth.uid()
  order by r.created_at;
$$;

revoke execute on function public.get_event_requests(uuid) from public, anon;
grant execute on function public.get_event_requests(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('join_requested', 'request_accepted', 'request_rejected')),
  event_id uuid not null references public.events(id) on delete cascade,
  request_id uuid references public.event_requests(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_id_created_at_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

create policy "notifications_select_own" on public.notifications
  for select to authenticated using (user_id = auth.uid());

create policy "notifications_update_own" on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Lo único que el usuario puede tocar es marcar como leída.
revoke insert, update, delete on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

create function private.notify_request_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organizer_id uuid;
begin
  if tg_op = 'INSERT' then
    select organizer_id into v_organizer_id from public.events where id = new.event_id;
    if v_organizer_id is not null then
      insert into public.notifications (user_id, type, event_id, request_id)
      values (v_organizer_id, 'join_requested', new.event_id, new.id);
    end if;
  elsif old.status = 'pending' and new.status in ('accepted', 'rejected') then
    insert into public.notifications (user_id, type, event_id, request_id)
    values (
      new.user_id,
      case new.status when 'accepted' then 'request_accepted' else 'request_rejected' end,
      new.event_id,
      new.id
    );
  end if;
  return new;
end;
$$;

create trigger event_requests_notify
  after insert or update of status on public.event_requests
  for each row execute procedure private.notify_request_change();

alter publication supabase_realtime add table public.notifications;
