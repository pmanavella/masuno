-- El postulante puede cancelar su propia solicitud (pendiente o aceptada, antes de que
-- empiece el evento) y después volver a pedir unirse. Una rechazada no se puede reintentar:
-- sigue dando already_requested.
--
-- Se reutiliza la fila (UNIQUE event_id + user_id): al volver a pedir, pasa de 'cancelled'
-- a 'pending' con created_at nuevo. Cancelar una aceptada libera el lugar. El organizador
-- recibe aviso de la nueva solicitud (join_requested) y de la cancelación (request_cancelled).

alter table public.event_requests drop constraint event_requests_status_check;
alter table public.event_requests add constraint event_requests_status_check
  check (status in ('pending', 'accepted', 'rejected', 'cancelled'));

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('join_requested', 'request_accepted', 'request_rejected', 'request_cancelled'));

-- Igual que antes, salvo que una solicitud cancelada no cuenta como already_requested.
create or replace function public.can_join_event(p_event_id uuid)
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

create or replace function public.request_to_join(p_event_id uuid)
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

  -- Si había una cancelada se reactiva; el WHERE evita pisar una que cambió de estado
  -- entre el chequeo y el insert (en ese caso no se devuelve fila).
  insert into public.event_requests (event_id, user_id)
  values (p_event_id, auth.uid())
  on conflict (event_id, user_id) do update
    set status = 'pending', created_at = now(), responded_at = null
    where public.event_requests.status = 'cancelled'
  returning id into v_request_id;

  if v_request_id is null then
    raise exception 'already_requested';
  end if;

  return v_request_id;
end;
$$;

-- Solo el propio postulante. Errores: not_found (inexistente o ajena), not_cancellable
-- (ya rechazada o cancelada), event_started.
create function public.cancel_request(p_request_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.event_requests;
begin
  select * into v_request
  from public.event_requests
  where id = p_request_id and user_id = auth.uid()
  for update;
  if not found then
    raise exception 'not_found';
  end if;

  if v_request.status not in ('pending', 'accepted') then
    raise exception 'not_cancellable';
  end if;

  if (select starts_at from public.events where id = v_request.event_id) <= now() then
    raise exception 'event_started';
  end if;

  if v_request.status = 'accepted' then
    update public.events
    set spots_taken = greatest(spots_taken - 1, 0)
    where id = v_request.event_id;
  end if;

  update public.event_requests
  set status = 'cancelled', responded_at = null
  where id = p_request_id;

  return 'cancelled';
end;
$$;

revoke execute on function public.cancel_request(uuid) from public, anon;
grant execute on function public.cancel_request(uuid) to authenticated;

create or replace function private.notify_request_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organizer_id uuid;
begin
  select organizer_id into v_organizer_id from public.events where id = new.event_id;

  if tg_op = 'INSERT' or (old.status = 'cancelled' and new.status = 'pending') then
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
  elsif new.status = 'cancelled' and old.status <> 'cancelled' then
    if v_organizer_id is not null then
      insert into public.notifications (user_id, type, event_id, request_id)
      values (v_organizer_id, 'request_cancelled', new.event_id, new.id);
    end if;
  end if;
  return new;
end;
$$;
