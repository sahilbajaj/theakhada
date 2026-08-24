-- 1) Bootstrap the first owner (idempotent, no-ops if the auth user does not exist yet).
do $$
declare
  v_email text := 'sahilbajaj.nc@gmail.com';
  v_user_id uuid;
  v_user_name text;
  v_club_id uuid;
  v_profile_id uuid;
begin
  select u.id,
         nullif(coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'), '')
    into v_user_id, v_user_name
  from auth.users u
  where lower(u.email) = v_email
  order by u.created_at
  limit 1;

  if v_user_id is null then
    raise notice 'Auth user % not found; skipping owner bootstrap.', v_email;
    return;
  end if;

  select id into v_club_id
  from public.clubs
  where name ilike '%Akhada%'
  order by created_at, id
  limit 1;

  if v_club_id is null then
    select id into v_club_id from public.clubs order by created_at, id limit 1;
  end if;

  if v_club_id is null then
    raise notice 'No club found; skipping owner bootstrap.';
    return;
  end if;

  insert into public.profiles (auth_user_id, email, full_name, role, status)
  values (v_user_id, v_email, coalesce(v_user_name, v_email), 'owner', 'active')
  on conflict (lower(email)) where email is not null
  do update set
    auth_user_id = excluded.auth_user_id,
    full_name = coalesce(nullif(public.profiles.full_name, ''), excluded.full_name),
    role = 'owner',
    status = 'active'
  returning id into v_profile_id;

  if v_profile_id is null then
    select id into v_profile_id from public.profiles where auth_user_id = v_user_id limit 1;
  end if;

  insert into public.club_memberships (club_id, profile_id, role)
  values (v_club_id, v_profile_id, 'owner')
  on conflict (club_id, profile_id)
  do update set role = 'owner';

  -- Clear any stale pending access request for the bootstrapped owner.
  update public.signup_requests
  set status = 'approved', reviewed_at = now(), updated_at = now()
  where club_id = v_club_id
    and lower(email) = v_email
    and status = 'pending';
end $$;

-- 2) claim_current_access(): link the profile and, when the signed-in user has no
--    membership, open a pending signup request admins can approve.
create or replace function public.claim_current_access()
returns table (
  profile_id uuid,
  club_id uuid,
  role text,
  full_name text,
  email text,
  has_membership boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(nullif(auth.jwt() ->> 'email', ''));
  v_name text := nullif(coalesce(auth.jwt() #>> '{user_metadata,full_name}', auth.jwt() #>> '{user_metadata,name}'), '');
  v_club_id uuid := public.default_club_id();
  v_profile_id uuid;
  v_has_membership boolean := false;
begin
  if v_user_id is null or v_email is null then
    return;
  end if;

  -- Attach the auth user to an existing profile (by auth id, else by email).
  select id into v_profile_id
  from public.profiles
  where auth_user_id = v_user_id or lower(email) = v_email
  order by (auth_user_id is null)
  limit 1;

  if v_profile_id is not null then
    update public.profiles
    set
      auth_user_id = v_user_id,
      email = coalesce(email, v_email),
      full_name = coalesce(nullif(full_name, ''), coalesce(v_name, v_email))
    where id = v_profile_id
      and (auth_user_id is null or auth_user_id = v_user_id);
  end if;

  select exists (
    select 1
    from public.club_memberships cm
    join public.profiles p on p.id = cm.profile_id
    where p.auth_user_id = v_user_id
  ) into v_has_membership;

  if not v_has_membership and v_club_id is not null then
    insert into public.signup_requests (club_id, email, full_name, requested_role)
    values (v_club_id, v_email, coalesce(v_name, v_email), 'player')
    on conflict (club_id, lower(email)) where status = 'pending'
    do update set
      full_name = coalesce(nullif(public.signup_requests.full_name, ''), excluded.full_name),
      updated_at = now();
  end if;

  return query
  select
    p.id,
    cm.club_id,
    cm.role,
    p.full_name,
    coalesce(p.email, v_email),
    cm.id is not null
  from public.profiles p
  left join public.club_memberships cm on cm.profile_id = p.id
  where p.auth_user_id = v_user_id
  order by cm.created_at nulls last
  limit 1;

  if not found then
    return query select null::uuid, null::uuid, null::text, coalesce(v_name, v_email), v_email, false;
  end if;
end;
$$;

grant execute on function public.claim_current_access() to authenticated;
