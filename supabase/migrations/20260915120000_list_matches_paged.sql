-- Keyset-paginated match list. Backs the Scores "All" tab and the
-- full-history player stats (Players / PlayerDetail), which previously
-- read list_recent_matches and were silently clamped to 100 rows.
--
-- Same row shape as list_recent_matches. Cursor is (starts_at, id) of the
-- last row of the previous page; pass nulls for the first page.

create or replace function public.list_matches_page(
  p_club_id uuid default null,
  p_before_starts_at timestamptz default null,
  p_before_id uuid default null,
  p_limit int default 50,
  p_profile_id uuid default null,
  p_final_only boolean default false
)
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
  v_club_id uuid := coalesce(p_club_id, public.default_club_id());
  v_is_admin boolean;
begin
  if not public.is_club_member(v_club_id) then
    raise exception 'Not authorized';
  end if;

  v_is_admin := public.is_club_admin(v_club_id);

  return query
  with page as (
    select m.id, m.format, m.status, m.starts_at, m.court_id, m.best_of,
           m.reviewed_at, m.suspended_reason, m.suspended_note
    from public.matches m
    where m.club_id = v_club_id
      and exists (select 1 from public.match_participants mp where mp.match_id = m.id)
      and (not coalesce(p_final_only, false) or m.status = 'final')
      and (
        p_profile_id is null
        or exists (
          select 1 from public.match_participants mp
          where mp.match_id = m.id and mp.profile_id = p_profile_id
        )
      )
      and (
        p_before_starts_at is null
        or (m.starts_at, m.id) < (p_before_starts_at, coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
      )
    order by m.starts_at desc, m.id desc
    limit greatest(1, least(coalesce(p_limit, 50), 500))
  ),
  participants as (
    select
      mp.match_id,
      mp.side,
      jsonb_agg(
        jsonb_build_object(
          'profile_id', p.id,
          'full_name', p.full_name,
          'nickname', p.nickname,
          'avatar_url', p.avatar_url,
          'position', mp.position,
          'seed_at_match', mp.seed_at_match,
          'singles_seed_at_match', mp.singles_seed_at_match,
          'doubles_seed_at_match', mp.doubles_seed_at_match
        )
        order by mp.position
      ) as roster
    from public.match_participants mp
    join page pg on pg.id = mp.match_id
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
    join page pg on pg.id = ms.match_id
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
  from page m
  left join sides s on s.match_id = m.id
  left join set_rows sr on sr.match_id = m.id
  order by m.starts_at desc, m.id desc;
end;
$$;

grant execute on function public.list_matches_page(uuid, timestamptz, uuid, int, uuid, boolean) to authenticated;
