-- Avatar uploads: public "avatars" storage bucket + RPCs to set a profile photo.
-- Apply manually in the Supabase SQL editor (or move into migrations/ and db push).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
  set public = true,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- Anyone can read avatars (public bucket).
drop policy if exists "avatars are publicly readable" on storage.objects;
create policy "avatars are publicly readable" on storage.objects
  for select
  using (bucket_id = 'avatars');

-- Signed-in users may write inside their own folder: <auth.uid()>/<file>
drop policy if exists "users manage own avatar files" on storage.objects;
create policy "users manage own avatar files" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "users update own avatar files" on storage.objects;
create policy "users update own avatar files" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "users delete own avatar files" on storage.objects;
create policy "users delete own avatar files" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Set the signed-in member's own avatar.
create or replace function public.set_my_avatar(p_url text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_url text := nullif(btrim(p_url), '');
begin
  select id into v_profile_id
  from public.profiles
  where auth_user_id = (select auth.uid())
  limit 1;

  if v_profile_id is null then
    raise exception 'No profile for the current user';
  end if;

  if v_url is not null and char_length(v_url) > 2048 then
    raise exception 'Avatar URL is too long';
  end if;

  update public.profiles
  set avatar_url = v_url
  where id = v_profile_id;

  return v_url;
end;
$$;

grant execute on function public.set_my_avatar(text) to authenticated;
revoke execute on function public.set_my_avatar(text) from anon;

-- Admins/owners may set the avatar of any member of a club they administer
-- (needed for guest profiles, which have no login).
create or replace function public.set_member_avatar(p_profile_id uuid, p_url text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text := nullif(btrim(p_url), '');
  v_allowed boolean;
begin
  select exists (
    select 1
    from public.club_memberships cm
    where cm.profile_id = p_profile_id
      and public.is_club_admin(cm.club_id)
  ) into v_allowed;

  if not coalesce(v_allowed, false) then
    raise exception 'Only club admins can change another member''s photo';
  end if;

  if v_url is not null and char_length(v_url) > 2048 then
    raise exception 'Avatar URL is too long';
  end if;

  update public.profiles
  set avatar_url = v_url
  where id = p_profile_id;

  return v_url;
end;
$$;

grant execute on function public.set_member_avatar(uuid, text) to authenticated;
revoke execute on function public.set_member_avatar(uuid, text) from anon;
