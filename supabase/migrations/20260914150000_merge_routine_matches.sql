-- Routine match merging: club-level toggle so a "New match" started with
-- the same rosters as a recently-finalized match, by the same single setter,
-- reopens that match and appends further sets instead of creating a new one.
--
-- Apply manually: paste into the Supabase SQL editor.

alter table public.clubs
  add column if not exists merge_routine_matches boolean not null default false;

-- Admin-only toggle. Mirrors set_club_prefer_nicknames.
create or replace function public.set_club_merge_routine_matches(
  p_club_id uuid default null,
  p_value boolean default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid := coalesce(p_club_id, public.default_club_id());
begin
  if not public.is_club_admin(v_club_id) then
    raise exception 'Not authorized';
  end if;

  update public.clubs
  set merge_routine_matches = coalesce(p_value, false)
  where id = v_club_id;
end;
$$;

grant execute on function public.set_club_merge_routine_matches(uuid, boolean) to authenticated;

-- create_match: return type changes from uuid to jsonb so the client can tell
-- whether the request was merged into an existing match. Drop + recreate.
drop function if exists public.create_match(uuid, text, uuid[], uuid[], smallint, uuid, timestamptz);

create or replace function public.create_match(
  p_club_id uuid default null,
  p_format text default null,
  p_side_a uuid[] default null,
  p_side_b uuid[] default null,
  p_best_of smallint default 3,
  p_court_id uuid default null,
  p_starts_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid := coalesce(p_club_id, public.default_club_id());
  v_self uuid := public.current_profile_id();
  v_match_id uuid;
  v_expected smallint := case when p_format = 'doubles' then 2 else 1 end;
  v_all uuid[] := p_side_a || p_side_b;
  v_i int;
  v_side_a_sorted uuid[];
  v_side_b_sorted uuid[];
  v_merge_enabled boolean;
  v_candidate uuid;
  v_existing_sets int;
  v_new_best_of smallint;
begin
  if v_self is null then raise exception 'Not authenticated'; end if;
  if v_club_id is null then raise exception 'No club configured'; end if;
  if not public.is_club_member(v_club_id) then raise exception 'Not authorized'; end if;
  if p_format not in ('singles', 'doubles') then raise exception 'Invalid format'; end if;
  if p_best_of not in (1, 3, 5) then raise exception 'best_of must be 1, 3, or 5'; end if;
  if array_length(p_side_a, 1) is distinct from v_expected
     or array_length(p_side_b, 1) is distinct from v_expected then
    raise exception 'Each side needs % player(s)', v_expected;
  end if;
  if (select count(distinct id) from unnest(v_all) as id) <> (v_expected * 2) then
    raise exception 'Players must be distinct';
  end if;
  if exists (
    select 1 from unnest(v_all) as pid
    left join public.club_memberships cm
      on cm.profile_id = pid and cm.club_id = v_club_id
    where cm.profile_id is null
  ) then
    raise exception 'All players must be members of the club';
  end if;

  -- Look for a mergeable finalized match if the club has the setting enabled.
  select merge_routine_matches into v_merge_enabled from public.clubs where id = v_club_id;

  if coalesce(v_merge_enabled, false) then
    -- Normalize rosters for order-insensitive comparison within a side.
    select array_agg(x order by x) into v_side_a_sorted from unnest(p_side_a) as x;
    select array_agg(x order by x) into v_side_b_sorted from unnest(p_side_b) as x;

    with candidate_rosters as (
      select
        m.id as match_id,
        m.starts_at,
        (array_agg(mp.profile_id order by mp.profile_id) filter (where mp.side = 'A')) as roster_a,
        (array_agg(mp.profile_id order by mp.profile_id) filter (where mp.side = 'B')) as roster_b,
        (select count(*) from public.match_sets ms where ms.match_id = m.id) as set_count,
        (select count(distinct e.actor_profile_id) from public.match_events e where e.match_id = m.id and e.actor_profile_id is not null) as distinct_actors,
        (select max(e.actor_profile_id) from public.match_events e where e.match_id = m.id and e.actor_profile_id is not null) as sole_actor
      from public.matches m
      join public.match_participants mp on mp.match_id = m.id
      where m.club_id = v_club_id
        and m.format = p_format
        and m.status = 'final'
        and m.starts_at >= now() - interval '3 hours'
      group by m.id, m.starts_at
    )
    select match_id, set_count
      into v_candidate, v_existing_sets
    from candidate_rosters
    where roster_a = v_side_a_sorted
      and roster_b = v_side_b_sorted
      and distinct_actors = 1
      and sole_actor = v_self
      and set_count < 5
    order by starts_at desc
    limit 1;

    if v_candidate is not null then
      -- Reopen the match and expand best_of so appended sets fit.
      v_new_best_of := least(5, greatest(3, v_existing_sets + coalesce(p_best_of, 3)))::smallint;
      if v_new_best_of not in (1, 3, 5) then
        v_new_best_of := 5;
      end if;

      update public.matches
      set status = 'live',
          best_of = v_new_best_of
      where id = v_candidate;

      insert into public.match_events (match_id, actor_profile_id, kind, payload)
      values (
        v_candidate,
        v_self,
        'match_reopened',
        jsonb_build_object('reason', 'merge_routine', 'previous_sets', v_existing_sets)
      );

      return jsonb_build_object('match_id', v_candidate, 'merged', true);
    end if;
  end if;

  insert into public.matches (club_id, court_id, format, starts_at, status, best_of)
  values (v_club_id, p_court_id, p_format, p_starts_at, 'live', p_best_of)
  returning id into v_match_id;

  for v_i in 1 .. v_expected loop
    insert into public.match_participants (match_id, profile_id, side, position)
    values (v_match_id, p_side_a[v_i], 'A', v_i);
    insert into public.match_participants (match_id, profile_id, side, position)
    values (v_match_id, p_side_b[v_i], 'B', v_i);
  end loop;

  insert into public.match_events (match_id, actor_profile_id, kind, payload)
  values (v_match_id, v_self, 'match_created', jsonb_build_object('format', p_format, 'best_of', p_best_of));

  return jsonb_build_object('match_id', v_match_id, 'merged', false);
end;
$$;

grant execute on function public.create_match(uuid, text, uuid[], uuid[], smallint, uuid, timestamptz) to authenticated;
