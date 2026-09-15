-- Challenges: any club member can invite others to a scheduled match.
-- Flow: creator picks side A + side B + time (+ optional court). Everyone
-- on both sides who isn't the creator must accept. On unanimous accept the
-- challenge auto-materializes into a scheduled match; on the first decline
-- the challenge is marked declined and the match never gets created.

------------------------------------------------------------
-- 1. Tables
------------------------------------------------------------

create table if not exists public.match_challenges (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  format text not null check (format in ('singles','doubles')),
  best_of smallint not null default 3 check (best_of in (1,3,5)),
  starts_at timestamptz not null,
  court_id uuid references public.courts(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','accepted','declined','cancelled')),
  match_id uuid references public.matches(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists match_challenges_club_status_idx
  on public.match_challenges (club_id, status, created_at desc);

create table if not exists public.match_challenge_participants (
  challenge_id uuid not null references public.match_challenges(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  side char(1) not null check (side in ('A','B')),
  position smallint not null default 1 check (position between 1 and 2),
  response text not null default 'pending'
    check (response in ('pending','accepted','declined')),
  responded_at timestamptz,
  primary key (challenge_id, profile_id)
);

create index if not exists match_challenge_participants_profile_idx
  on public.match_challenge_participants (profile_id, response);

alter table public.match_challenges enable row level security;
alter table public.match_challenge_participants enable row level security;

drop policy if exists "members read challenges" on public.match_challenges;
create policy "members read challenges" on public.match_challenges
  for select to authenticated
  using (public.is_club_member(club_id));

drop policy if exists "members read challenge participants" on public.match_challenge_participants;
create policy "members read challenge participants" on public.match_challenge_participants
  for select to authenticated
  using (
    exists (
      select 1 from public.match_challenges c
      where c.id = challenge_id and public.is_club_member(c.club_id)
    )
  );

------------------------------------------------------------
-- 2. Notifications: extend the kind CHECK. Challenge notifications carry
--     challenge_id in payload; match_id stays null until the match is
--     materialized on accept.
------------------------------------------------------------

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check
  check (kind in (
    'match_created', 'match_finalized', 'match_reopened',
    'match_suspended', 'match_resumed',
    'challenge_received', 'challenge_accepted', 'challenge_declined', 'challenge_cancelled'
  ));

------------------------------------------------------------
-- 3. create_challenge
------------------------------------------------------------

create or replace function public.create_challenge(
  p_club_id uuid default null,
  p_format text default null,
  p_side_a uuid[] default null,
  p_side_b uuid[] default null,
  p_best_of smallint default 3,
  p_starts_at timestamptz default null,
  p_court_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid := coalesce(p_club_id, public.default_club_id());
  v_self uuid := public.current_profile_id();
  v_challenge_id uuid;
  v_expected smallint := case when p_format = 'doubles' then 2 else 1 end;
  v_all uuid[] := p_side_a || p_side_b;
  v_i int;
  v_actor_name text;
begin
  if v_self is null then raise exception 'Not authenticated'; end if;
  if v_club_id is null then raise exception 'No club configured'; end if;
  if not public.is_club_member(v_club_id) then raise exception 'Not authorized'; end if;
  if p_format not in ('singles','doubles') then raise exception 'Invalid format'; end if;
  if p_best_of not in (1,3,5) then raise exception 'best_of must be 1, 3, or 5'; end if;
  if p_starts_at is null then raise exception 'starts_at is required'; end if;
  if array_length(p_side_a, 1) is distinct from v_expected
     or array_length(p_side_b, 1) is distinct from v_expected then
    raise exception 'Each side needs % player(s)', v_expected;
  end if;
  if (select count(distinct id) from unnest(v_all) as id) <> (v_expected * 2) then
    raise exception 'Players must be distinct';
  end if;
  if not (v_self = any(v_all)) then
    raise exception 'You must be one of the players';
  end if;
  if exists (
    select 1 from unnest(v_all) as pid
    left join public.club_memberships cm
      on cm.profile_id = pid and cm.club_id = v_club_id
    where cm.profile_id is null
  ) then
    raise exception 'All players must be members of the club';
  end if;

  insert into public.match_challenges (club_id, format, best_of, starts_at, court_id, created_by)
  values (v_club_id, p_format, p_best_of, p_starts_at, p_court_id, v_self)
  returning id into v_challenge_id;

  for v_i in 1 .. v_expected loop
    insert into public.match_challenge_participants (challenge_id, profile_id, side, position, response, responded_at)
    values (
      v_challenge_id, p_side_a[v_i], 'A', v_i,
      case when p_side_a[v_i] = v_self then 'accepted' else 'pending' end,
      case when p_side_a[v_i] = v_self then now() else null end
    );
    insert into public.match_challenge_participants (challenge_id, profile_id, side, position, response, responded_at)
    values (
      v_challenge_id, p_side_b[v_i], 'B', v_i,
      case when p_side_b[v_i] = v_self then 'accepted' else 'pending' end,
      case when p_side_b[v_i] = v_self then now() else null end
    );
  end loop;

  select full_name into v_actor_name from public.profiles where id = v_self;

  insert into public.notifications (profile_id, match_id, kind, actor_profile_id, payload)
  select
    pid,
    null,
    'challenge_received',
    v_self,
    jsonb_build_object(
      'challenge_id', v_challenge_id,
      'format', p_format,
      'best_of', p_best_of,
      'starts_at', p_starts_at,
      'actor_name', v_actor_name
    )
  from unnest(v_all) as pid
  where pid <> v_self;

  return v_challenge_id;
end;
$$;

revoke all on function public.create_challenge(uuid, text, uuid[], uuid[], smallint, timestamptz, uuid) from public, anon;
grant execute on function public.create_challenge(uuid, text, uuid[], uuid[], smallint, timestamptz, uuid) to authenticated;

------------------------------------------------------------
-- 4. respond_to_challenge — accept or decline. First decline kills the
--     challenge; a unanimous accept materializes it into a scheduled match.
------------------------------------------------------------

create or replace function public.respond_to_challenge(
  p_challenge_id uuid,
  p_response text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_self uuid := public.current_profile_id();
  v_challenge public.match_challenges%rowtype;
  v_side_a uuid[];
  v_side_b uuid[];
  v_pending_count int;
  v_match_id uuid;
  v_actor_name text;
begin
  if v_self is null then raise exception 'Not authenticated'; end if;
  if p_response not in ('accepted','declined') then
    raise exception 'response must be accepted or declined';
  end if;

  select * into v_challenge from public.match_challenges where id = p_challenge_id;
  if not found then raise exception 'Challenge not found'; end if;
  if v_challenge.status <> 'pending' then
    raise exception 'Challenge is not pending';
  end if;

  update public.match_challenge_participants
     set response = p_response, responded_at = now()
   where challenge_id = p_challenge_id
     and profile_id = v_self
     and response = 'pending';
  if not found then
    raise exception 'You are not a pending participant on this challenge';
  end if;

  select full_name into v_actor_name from public.profiles where id = v_self;

  if p_response = 'declined' then
    update public.match_challenges
       set status = 'declined', resolved_at = now()
     where id = p_challenge_id;

    insert into public.notifications (profile_id, match_id, kind, actor_profile_id, payload)
    select cp.profile_id, null, 'challenge_declined', v_self,
           jsonb_build_object('challenge_id', p_challenge_id, 'actor_name', v_actor_name)
      from public.match_challenge_participants cp
     where cp.challenge_id = p_challenge_id
       and cp.profile_id <> v_self;

    return null;
  end if;

  -- accepted: are there still pending participants?
  select count(*) into v_pending_count
    from public.match_challenge_participants
   where challenge_id = p_challenge_id and response = 'pending';

  if v_pending_count > 0 then
    return null;  -- wait for the others
  end if;

  -- Everyone accepted — materialize the match.
  select array_agg(profile_id order by position)
    into v_side_a
    from public.match_challenge_participants
   where challenge_id = p_challenge_id and side = 'A';
  select array_agg(profile_id order by position)
    into v_side_b
    from public.match_challenge_participants
   where challenge_id = p_challenge_id and side = 'B';

  v_match_id := public.create_match(
    v_challenge.club_id,
    v_challenge.format,
    v_side_a,
    v_side_b,
    v_challenge.best_of,
    v_challenge.court_id,
    v_challenge.starts_at
  );

  -- create_match sets status='live'. For a future start_at, mark scheduled.
  if v_challenge.starts_at > now() then
    update public.matches set status = 'scheduled' where id = v_match_id;
  end if;

  update public.match_challenges
     set status = 'accepted', match_id = v_match_id, resolved_at = now()
   where id = p_challenge_id;

  insert into public.notifications (profile_id, match_id, kind, actor_profile_id, payload)
  select cp.profile_id, v_match_id, 'challenge_accepted', v_self,
         jsonb_build_object('challenge_id', p_challenge_id, 'actor_name', v_actor_name)
    from public.match_challenge_participants cp
   where cp.challenge_id = p_challenge_id
     and cp.profile_id <> v_self;

  return v_match_id;
end;
$$;

revoke all on function public.respond_to_challenge(uuid, text) from public, anon;
grant execute on function public.respond_to_challenge(uuid, text) to authenticated;

------------------------------------------------------------
-- 5. cancel_challenge — only the creator, only while pending.
------------------------------------------------------------

create or replace function public.cancel_challenge(p_challenge_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_self uuid := public.current_profile_id();
  v_challenge public.match_challenges%rowtype;
  v_actor_name text;
begin
  if v_self is null then raise exception 'Not authenticated'; end if;

  select * into v_challenge from public.match_challenges where id = p_challenge_id;
  if not found then raise exception 'Challenge not found'; end if;
  if v_challenge.created_by <> v_self then raise exception 'Only the creator can cancel'; end if;
  if v_challenge.status <> 'pending' then raise exception 'Challenge is not pending'; end if;

  update public.match_challenges
     set status = 'cancelled', resolved_at = now()
   where id = p_challenge_id;

  select full_name into v_actor_name from public.profiles where id = v_self;

  insert into public.notifications (profile_id, match_id, kind, actor_profile_id, payload)
  select cp.profile_id, null, 'challenge_cancelled', v_self,
         jsonb_build_object('challenge_id', p_challenge_id, 'actor_name', v_actor_name)
    from public.match_challenge_participants cp
   where cp.challenge_id = p_challenge_id
     and cp.profile_id <> v_self;
end;
$$;

revoke all on function public.cancel_challenge(uuid) from public, anon;
grant execute on function public.cancel_challenge(uuid) to authenticated;

------------------------------------------------------------
-- 6. list_my_challenges — challenges the caller is a participant in.
--     Returns pending first (both incoming to respond to, and outgoing
--     the caller created and is waiting on).
------------------------------------------------------------

create or replace function public.list_my_challenges(p_limit int default 20)
returns table (
  id uuid,
  club_id uuid,
  format text,
  best_of smallint,
  starts_at timestamptz,
  court_id uuid,
  court_name text,
  created_by uuid,
  creator_full_name text,
  creator_nickname text,
  creator_avatar_url text,
  status text,
  match_id uuid,
  created_at timestamptz,
  my_response text,
  participants jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_self uuid := public.current_profile_id();
begin
  if v_self is null then return; end if;

  return query
  select
    c.id,
    c.club_id,
    c.format,
    c.best_of,
    c.starts_at,
    c.court_id,
    ct.name as court_name,
    c.created_by,
    cp_creator.full_name,
    cp_creator.nickname,
    cp_creator.avatar_url,
    c.status,
    c.match_id,
    c.created_at,
    (select response from public.match_challenge_participants
      where challenge_id = c.id and profile_id = v_self) as my_response,
    (select jsonb_agg(jsonb_build_object(
        'profile_id', mcp.profile_id,
        'side', mcp.side,
        'position', mcp.position,
        'response', mcp.response,
        'full_name', p.full_name,
        'nickname', p.nickname,
        'avatar_url', p.avatar_url
      ) order by mcp.side, mcp.position)
     from public.match_challenge_participants mcp
     join public.profiles p on p.id = mcp.profile_id
     where mcp.challenge_id = c.id) as participants
  from public.match_challenges c
  join public.match_challenge_participants me
    on me.challenge_id = c.id and me.profile_id = v_self
  left join public.profiles cp_creator on cp_creator.id = c.created_by
  left join public.courts ct on ct.id = c.court_id
  order by
    case c.status when 'pending' then 0 else 1 end,
    c.starts_at asc
  limit greatest(1, least(coalesce(p_limit, 20), 100));
end;
$$;

revoke all on function public.list_my_challenges(int) from public, anon;
grant execute on function public.list_my_challenges(int) to authenticated;

notify pgrst, 'reload schema';
