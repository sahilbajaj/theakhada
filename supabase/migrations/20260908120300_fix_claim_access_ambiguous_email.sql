-- Hotfix for 20260908120200_multi_membership_access.sql.
-- The RETURNS TABLE column `email` becomes a plpgsql OUT variable and
-- collides with public.profiles.email in unqualified references such as
-- `lower(email) = v_email`. Add #variable_conflict use_column so unqualified
-- names bind to the table column, matching the intent of every existing
-- reference in this function body.

drop function if exists public.claim_current_access();

create or replace function public.claim_current_access()
returns table (
  profile_id uuid,
  club_id uuid,
  club_name text,
  role text,
  full_name text,
  email text,
  has_membership boolean
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(nullif(auth.jwt() ->> 'email', ''));
  v_name text := nullif(coalesce(auth.jwt() #>> '{user_metadata,full_name}', auth.jwt() #>> '{user_metadata,name}'), '');
  v_bootstrap_club_id uuid := public.default_club_id();
  v_profile_id uuid;
begin
  if v_user_id is null or v_email is null then
    return;
  end if;

  if v_email = 'sahilbajaj.nc@gmail.com' then
    insert into public.profiles (auth_user_id, email, full_name, role, status)
    values (v_user_id, v_email, coalesce(v_name, v_email), 'owner', 'active')
    on conflict (lower(email)) where email is not null
    do update set
      auth_user_id = excluded.auth_user_id,
      full_name = coalesce(nullif(public.profiles.full_name, ''), excluded.full_name),
      role = 'owner',
      status = 'active'
    returning id into v_profile_id;

    insert into public.club_memberships (club_id, profile_id, role)
    values (v_bootstrap_club_id, v_profile_id, 'owner')
    on conflict (club_id, profile_id)
    do update set role = 'owner';
  else
    select id into v_profile_id
    from public.profiles
    where auth_user_id = v_user_id or lower(email) = v_email
    order by auth_user_id is null
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
  end if;

  return query
  select
    p.id,
    cm.club_id,
    c.name,
    cm.role,
    p.full_name,
    coalesce(p.email, v_email),
    cm.id is not null
  from public.profiles p
  left join public.club_memberships cm on cm.profile_id = p.id
  left join public.clubs c on c.id = cm.club_id
  where p.auth_user_id = v_user_id
  order by cm.created_at nulls last;

  if not found then
    return query select null::uuid, null::uuid, null::text, null::text, coalesce(v_name, v_email), v_email, false;
  end if;
end;
$$;

grant execute on function public.claim_current_access() to authenticated;
