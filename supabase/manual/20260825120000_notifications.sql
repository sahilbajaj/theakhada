-- Notifications v1: per-user rows fanned out from match_events. Only
-- match_created and match_finalized fan out for now (set-level events are
-- noisy). Read state stored on the notification row.
--
-- Apply manually: paste into the Supabase SQL editor.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  match_id uuid references public.matches(id) on delete cascade,
  kind text not null check (kind in ('match_created', 'match_finalized', 'match_reopened')),
  actor_profile_id uuid references public.profiles(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists notifications_profile_unread_idx
  on public.notifications (profile_id, created_at desc)
  where read_at is null;

create index if not exists notifications_profile_recent_idx
  on public.notifications (profile_id, created_at desc);

alter table public.notifications enable row level security;

create policy "own notifications read" on public.notifications
  for select to authenticated
  using (profile_id = public.current_profile_id());

-- Writes go through security-definer RPCs only.

-- Fan-out trigger on match_events insert.
create or replace function public.fan_out_match_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind not in ('match_created', 'match_finalized', 'match_reopened') then
    return new;
  end if;

  insert into public.notifications (profile_id, match_id, kind, actor_profile_id, payload)
  select
    mp.profile_id,
    new.match_id,
    new.kind,
    new.actor_profile_id,
    new.payload
  from public.match_participants mp
  where mp.match_id = new.match_id
    and (new.actor_profile_id is null or mp.profile_id <> new.actor_profile_id);

  return new;
end;
$$;

drop trigger if exists match_events_fan_out on public.match_events;
create trigger match_events_fan_out
  after insert on public.match_events
  for each row execute function public.fan_out_match_notification();

-- list_notifications: recent items for the signed-in user + resolved actor.
drop function if exists public.list_notifications(int);

create or replace function public.list_notifications(p_limit int default 30)
returns table (
  id uuid,
  match_id uuid,
  kind text,
  actor_profile_id uuid,
  actor_full_name text,
  actor_nickname text,
  actor_avatar_url text,
  payload jsonb,
  created_at timestamptz,
  read_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_profile_id uuid := public.current_profile_id();
begin
  if v_profile_id is null then
    return;
  end if;

  return query
  select
    n.id,
    n.match_id,
    n.kind,
    n.actor_profile_id,
    ap.full_name,
    ap.nickname,
    ap.avatar_url,
    n.payload,
    n.created_at,
    n.read_at
  from public.notifications n
  left join public.profiles ap on ap.id = n.actor_profile_id
  where n.profile_id = v_profile_id
  order by n.created_at desc
  limit greatest(1, least(coalesce(p_limit, 30), 100));
end;
$$;

grant execute on function public.list_notifications(int) to authenticated;

-- unread_notifications_count: cheap query for the bell badge.
create or replace function public.unread_notifications_count()
returns int
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_count int;
begin
  if v_profile_id is null then
    return 0;
  end if;

  select count(*) into v_count
  from public.notifications
  where profile_id = v_profile_id
    and read_at is null;

  return coalesce(v_count, 0);
end;
$$;

grant execute on function public.unread_notifications_count() to authenticated;

create or replace function public.mark_notification_read(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := public.current_profile_id();
begin
  if v_profile_id is null then
    raise exception 'Not authenticated';
  end if;

  update public.notifications
  set read_at = now()
  where id = p_id
    and profile_id = v_profile_id
    and read_at is null;
end;
$$;

grant execute on function public.mark_notification_read(uuid) to authenticated;

create or replace function public.mark_all_notifications_read()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := public.current_profile_id();
begin
  if v_profile_id is null then
    raise exception 'Not authenticated';
  end if;

  update public.notifications
  set read_at = now()
  where profile_id = v_profile_id
    and read_at is null;
end;
$$;

grant execute on function public.mark_all_notifications_read() to authenticated;
