-- Suspend / resume matches (rain, injury, darkness). A suspended match keeps its
-- recorded sets but cannot be scored or finalized until it is resumed. Only
-- participants (or club admins) may suspend/resume. Rankings, seeding and
-- insights already count only 'final' matches, so suspended matches contribute
-- nothing.
--
-- Apply manually: paste into the Supabase SQL editor.

alter table public.matches drop constraint if exists matches_status_check;
alter table public.matches
  add constraint matches_status_check
  check (status in ('scheduled', 'live', 'final', 'suspended'));

alter table public.matches add column if not exists suspended_reason text;
alter table public.matches add column if not exists suspended_note text;

-- Event + notification kinds.
alter table public.match_events drop constraint if exists match_events_kind_check;
alter table public.match_events
  add constraint match_events_kind_check
  check (kind in ('match_created', 'set_recorded', 'set_edited', 'match_finalized',
                  'match_reopened', 'match_suspended', 'match_resumed'));

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check
  check (kind in ('match_created', 'match_finalized', 'match_reopened',
                  'match_suspended', 'match_resumed'));

create or replace function public.fan_out_match_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind not in ('match_created', 'match_finalized', 'match_reopened',
                      'match_suspended', 'match_resumed') then
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

-- Helper: caller is a participant in the match, or an admin of its club.
create or replace function public.can_manage_match(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.matches m
    where m.id = p_match_id
      and (
        public.is_club_admin(m.club_id)
        or exists (
          select 1 from public.match_participants mp
          where mp.match_id = m.id
            and mp.profile_id = public.current_profile_id()
        )
      )
  )
$$;

grant execute on function public.can_manage_match(uuid) to authenticated;

-- suspend_match: pause a live match with a reason.
create or replace function public.suspend_match(
  p_match_id uuid,
  p_reason text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_self uuid := public.current_profile_id();
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  select status into v_status from public.matches where id = p_match_id;
  if v_status is null then raise exception 'Match not found'; end if;
  if not public.can_manage_match(p_match_id) then
    raise exception 'Only players in this match (or an admin) can suspend it';
  end if;
  if v_status <> 'live' then raise exception 'Only a live match can be suspended'; end if;
  if v_reason is null then raise exception 'A reason is required'; end if;
  if v_reason not in ('rain', 'injury', 'darkness', 'other') then
    raise exception 'Unknown suspension reason';
  end if;
  if length(v_note) > 200 then raise exception 'Note is too long'; end if;

  update public.matches
  set status = 'suspended',
      suspended_reason = v_reason,
      suspended_note = v_note
  where id = p_match_id;

  insert into public.match_events (match_id, actor_profile_id, kind, payload)
  values (p_match_id, v_self, 'match_suspended',
          jsonb_build_object('reason', v_reason, 'note', v_note));
end;
$$;

grant execute on function public.suspend_match(uuid, text, text) to authenticated;
revoke execute on function public.suspend_match(uuid, text, text) from anon;

-- resume_match: put a suspended match back to live scoring.
create or replace function public.resume_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_self uuid := public.current_profile_id();
begin
  select status into v_status from public.matches where id = p_match_id;
  if v_status is null then raise exception 'Match not found'; end if;
  if not public.can_manage_match(p_match_id) then
    raise exception 'Only players in this match (or an admin) can resume it';
  end if;
  if v_status <> 'suspended' then raise exception 'Match is not suspended'; end if;

  update public.matches
  set status = 'live',
      suspended_reason = null,
      suspended_note = null
  where id = p_match_id;

  insert into public.match_events (match_id, actor_profile_id, kind, payload)
  values (p_match_id, v_self, 'match_resumed', '{}'::jsonb);
end;
$$;

grant execute on function public.resume_match(uuid) to authenticated;
revoke execute on function public.resume_match(uuid) from anon;

-- Block scoring / finalizing while suspended.
create or replace function public.record_set(
  p_match_id uuid,
  p_set_index smallint,
  p_side_a_games smallint,
  p_side_b_games smallint,
  p_tiebreak_a smallint default null,
  p_tiebreak_b smallint default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid;
  v_status text;
  v_self uuid := public.current_profile_id();
  v_edited boolean := false;
begin
  select club_id, status into v_club_id, v_status from public.matches where id = p_match_id;
  if v_club_id is null then
    raise exception 'Match not found';
  end if;
  if not public.is_club_member(v_club_id) then
    raise exception 'Not authorized';
  end if;
  if v_status = 'suspended' then
    raise exception 'Match is suspended — resume it before scoring';
  end if;

  select true into v_edited
  from public.match_sets
  where match_id = p_match_id and set_index = p_set_index;

  insert into public.match_sets (match_id, set_index, side_a_games, side_b_games, tiebreak_a, tiebreak_b)
  values (p_match_id, p_set_index, p_side_a_games, p_side_b_games, p_tiebreak_a, p_tiebreak_b)
  on conflict (match_id, set_index) do update set
    side_a_games = excluded.side_a_games,
    side_b_games = excluded.side_b_games,
    tiebreak_a = excluded.tiebreak_a,
    tiebreak_b = excluded.tiebreak_b;

  insert into public.match_events (match_id, actor_profile_id, kind, payload)
  values (
    p_match_id,
    v_self,
    case when v_edited then 'set_edited' else 'set_recorded' end,
    jsonb_build_object(
      'set_index', p_set_index,
      'side_a_games', p_side_a_games,
      'side_b_games', p_side_b_games,
      'tiebreak_a', p_tiebreak_a,
      'tiebreak_b', p_tiebreak_b
    )
  );
end;
$$;

grant execute on function public.record_set(uuid, smallint, smallint, smallint, smallint, smallint) to authenticated;

create or replace function public.finalize_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid;
  v_status text;
  v_self uuid := public.current_profile_id();
  v_sets_a smallint := 0;
  v_sets_b smallint := 0;
  v_winner char(1);
begin
  select club_id, status into v_club_id, v_status from public.matches where id = p_match_id;
  if v_club_id is null then
    raise exception 'Match not found';
  end if;
  if not public.is_club_member(v_club_id) then
    raise exception 'Not authorized';
  end if;
  if v_status = 'suspended' then
    raise exception 'Match is suspended — resume it before finalizing';
  end if;

  select
    count(*) filter (
      where side_a_games > side_b_games
        or (side_a_games = side_b_games and coalesce(tiebreak_a, 0) > coalesce(tiebreak_b, 0))
    ),
    count(*) filter (
      where side_b_games > side_a_games
        or (side_a_games = side_b_games and coalesce(tiebreak_b, 0) > coalesce(tiebreak_a, 0))
    )
  into v_sets_a, v_sets_b
  from public.match_sets
  where match_id = p_match_id;

  if v_sets_a + v_sets_b = 0 then
    raise exception 'Record at least one set before finalizing';
  end if;

  v_winner := case when v_sets_a > v_sets_b then 'A' when v_sets_b > v_sets_a then 'B' else null end;

  update public.matches
  set status = 'final',
      suspended_reason = null,
      suspended_note = null
  where id = p_match_id;

  insert into public.match_events (match_id, actor_profile_id, kind, payload)
  values (
    p_match_id,
    v_self,
    'match_finalized',
    jsonb_build_object('winner_side', v_winner, 'sets_a', v_sets_a, 'sets_b', v_sets_b)
  );
end;
$$;

grant execute on function public.finalize_match(uuid) to authenticated;

-- Match list RPCs now expose the suspension reason/note.

drop function if exists public.list_recent_matches(int);

create or replace function public.list_recent_matches(p_limit int default 25)
returns table (
  match_id uuid,
  format text,
  status text,
  starts_at timestamptz,
  court_id uuid,
  best_of smallint,
  side_a jsonb,
  side_b jsonb,
  sets jsonb,
  winner_side char(1),
  reviewed_at timestamptz,
  suspended_reason text,
  suspended_note text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_club_id uuid := public.default_club_id();
  v_is_admin boolean;
begin
  if not public.is_club_member(v_club_id) then
    raise exception 'Not authorized';
  end if;

  v_is_admin := public.is_club_admin(v_club_id);

  return query
  with participants as (
    select
      mp.match_id,
      mp.side,
      jsonb_agg(
        jsonb_build_object(
          'profile_id', p.id,
          'full_name', p.full_name,
          'nickname', p.nickname,
          'avatar_url', p.avatar_url,
          'position', mp.position
        )
        order by mp.position
      ) as roster
    from public.match_participants mp
    join public.profiles p on p.id = mp.profile_id
    group by mp.match_id, mp.side
  ),
  sides as (
    select
      participants.match_id,
      (array_agg(roster) filter (where side = 'A'))[1] as side_a,
      (array_agg(roster) filter (where side = 'B'))[1] as side_b
    from participants
    group by participants.match_id
  ),
  set_rows as (
    select
      ms.match_id,
      jsonb_agg(
        jsonb_build_object(
          'set_index', ms.set_index,
          'side_a_games', ms.side_a_games,
          'side_b_games', ms.side_b_games,
          'tiebreak_a', ms.tiebreak_a,
          'tiebreak_b', ms.tiebreak_b
        )
        order by ms.set_index
      ) as sets,
      count(*) filter (
        where ms.side_a_games > ms.side_b_games
          or (ms.side_a_games = ms.side_b_games and coalesce(ms.tiebreak_a, 0) > coalesce(ms.tiebreak_b, 0))
      ) as sets_a,
      count(*) filter (
        where ms.side_b_games > ms.side_a_games
          or (ms.side_a_games = ms.side_b_games and coalesce(ms.tiebreak_b, 0) > coalesce(ms.tiebreak_a, 0))
      ) as sets_b
    from public.match_sets ms
    group by ms.match_id
  )
  select
    m.id,
    m.format,
    m.status,
    m.starts_at,
    m.court_id,
    m.best_of,
    coalesce(s.side_a, '[]'::jsonb),
    coalesce(s.side_b, '[]'::jsonb),
    coalesce(sr.sets, '[]'::jsonb),
    case
      when m.status <> 'final' then null
      when coalesce(sr.sets_a, 0) > coalesce(sr.sets_b, 0) then 'A'::char(1)
      when coalesce(sr.sets_b, 0) > coalesce(sr.sets_a, 0) then 'B'::char(1)
      else null
    end as winner_side,
    case when v_is_admin then m.reviewed_at else null end as reviewed_at,
    m.suspended_reason,
    m.suspended_note
  from public.matches m
  left join sides s on s.match_id = m.id
  left join set_rows sr on sr.match_id = m.id
  where m.club_id = v_club_id
    and exists (select 1 from public.match_participants mp where mp.match_id = m.id)
  order by m.starts_at desc
  limit greatest(1, least(coalesce(p_limit, 25), 100));
end;
$$;

drop function if exists public.list_unreviewed_matches(int);

create or replace function public.list_unreviewed_matches(p_limit int default 200)
returns table (
  match_id uuid,
  format text,
  status text,
  starts_at timestamptz,
  court_id uuid,
  best_of smallint,
  side_a jsonb,
  side_b jsonb,
  sets jsonb,
  winner_side char(1),
  reviewed_at timestamptz,
  suspended_reason text,
  suspended_note text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_club_id uuid := public.default_club_id();
begin
  if not public.is_club_admin(v_club_id) then
    raise exception 'Not authorized';
  end if;

  return query
  with participants as (
    select
      mp.match_id,
      mp.side,
      jsonb_agg(
        jsonb_build_object(
          'profile_id', p.id,
          'full_name', p.full_name,
          'nickname', p.nickname,
          'avatar_url', p.avatar_url,
          'position', mp.position
        )
        order by mp.position
      ) as roster
    from public.match_participants mp
    join public.profiles p on p.id = mp.profile_id
    group by mp.match_id, mp.side
  ),
  sides as (
    select
      participants.match_id,
      (array_agg(roster) filter (where side = 'A'))[1] as side_a,
      (array_agg(roster) filter (where side = 'B'))[1] as side_b
    from participants
    group by participants.match_id
  ),
  set_rows as (
    select
      ms.match_id,
      jsonb_agg(
        jsonb_build_object(
          'set_index', ms.set_index,
          'side_a_games', ms.side_a_games,
          'side_b_games', ms.side_b_games,
          'tiebreak_a', ms.tiebreak_a,
          'tiebreak_b', ms.tiebreak_b
        )
        order by ms.set_index
      ) as sets,
      count(*) filter (
        where ms.side_a_games > ms.side_b_games
          or (ms.side_a_games = ms.side_b_games and coalesce(ms.tiebreak_a, 0) > coalesce(ms.tiebreak_b, 0))
      ) as sets_a,
      count(*) filter (
        where ms.side_b_games > ms.side_a_games
          or (ms.side_a_games = ms.side_b_games and coalesce(ms.tiebreak_b, 0) > coalesce(ms.tiebreak_a, 0))
      ) as sets_b
    from public.match_sets ms
    group by ms.match_id
  )
  select
    m.id,
    m.format,
    m.status,
    m.starts_at,
    m.court_id,
    m.best_of,
    coalesce(s.side_a, '[]'::jsonb),
    coalesce(s.side_b, '[]'::jsonb),
    coalesce(sr.sets, '[]'::jsonb),
    case
      when coalesce(sr.sets_a, 0) > coalesce(sr.sets_b, 0) then 'A'::char(1)
      when coalesce(sr.sets_b, 0) > coalesce(sr.sets_a, 0) then 'B'::char(1)
      else null
    end as winner_side,
    m.reviewed_at,
    m.suspended_reason,
    m.suspended_note
  from public.matches m
  left join sides s on s.match_id = m.id
  left join set_rows sr on sr.match_id = m.id
  where m.club_id = v_club_id
    and m.status = 'final'
    and m.reviewed_at is null
    and exists (select 1 from public.match_participants mp where mp.match_id = m.id)
  order by m.starts_at desc
  limit greatest(1, least(coalesce(p_limit, 200), 500));
end;
$$;
