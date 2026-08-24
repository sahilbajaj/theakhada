create extension if not exists "pgcrypto";

create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  role text not null default 'player' check (role in ('owner', 'admin', 'coach', 'player', 'guest')),
  rating numeric(3,1) not null default 3.0,
  seed integer,
  status text not null default 'active' check (status in ('active', 'paused', 'visitor')),
  attendance_rate integer not null default 0 check (attendance_rate between 0 and 100),
  wins integer not null default 0,
  losses integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.club_memberships (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'player' check (role in ('owner', 'admin', 'coach', 'player', 'guest')),
  created_at timestamptz not null default now(),
  unique (club_id, profile_id)
);

create table if not exists public.courts (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  name text not null,
  surface text not null default 'hard' check (surface in ('hard', 'clay', 'grass', 'synthetic')),
  indoor boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  court_id uuid not null references public.courts(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'confirmed' check (status in ('confirmed', 'checked_in', 'completed', 'cancelled')),
  players text[] not null default '{}',
  purpose text not null default 'practice' check (purpose in ('practice', 'coaching', 'league', 'tournament', 'social')),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  tournament_id uuid,
  court_id uuid references public.courts(id) on delete set null,
  format text not null default 'singles' check (format in ('singles', 'doubles')),
  starts_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'final')),
  home_players text[] not null default '{}',
  away_players text[] not null default '{}',
  sets jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  name text not null,
  starts_at timestamptz not null,
  expected_count integer not null default 0,
  checked_in_count integer not null default 0,
  created_at timestamptz not null default now(),
  check (checked_in_count <= expected_count)
);

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.attendance_sessions(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  guest_name text,
  checked_in_at timestamptz not null default now()
);

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'registration', 'seeding', 'live', 'completed')),
  format text not null default 'singles' check (format in ('singles', 'doubles')),
  entrants integer not null default 0,
  seeded integer not null default 0,
  starts_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (seeded <= entrants)
);

alter table public.matches
  add constraint matches_tournament_fk foreign key (tournament_id) references public.tournaments(id) on delete set null;

create index if not exists bookings_club_starts_at_idx on public.bookings (club_id, starts_at);
create index if not exists matches_club_starts_at_idx on public.matches (club_id, starts_at);
create index if not exists attendance_sessions_club_starts_at_idx on public.attendance_sessions (club_id, starts_at);
create index if not exists tournaments_club_starts_at_idx on public.tournaments (club_id, starts_at);

alter table public.clubs enable row level security;
alter table public.profiles enable row level security;
alter table public.club_memberships enable row level security;
alter table public.courts enable row level security;
alter table public.bookings enable row level security;
alter table public.matches enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.attendance_records enable row level security;
alter table public.tournaments enable row level security;

create policy "authenticated users can read clubs" on public.clubs for select to authenticated using (true);
create policy "authenticated users can read profiles" on public.profiles for select to authenticated using (true);
create policy "authenticated users can read memberships" on public.club_memberships for select to authenticated using (true);
create policy "authenticated users can read courts" on public.courts for select to authenticated using (true);
create policy "authenticated users can read bookings" on public.bookings for select to authenticated using (true);
create policy "authenticated users can read matches" on public.matches for select to authenticated using (true);
create policy "authenticated users can read attendance sessions" on public.attendance_sessions for select to authenticated using (true);
create policy "authenticated users can read attendance records" on public.attendance_records for select to authenticated using (true);
create policy "authenticated users can read tournaments" on public.tournaments for select to authenticated using (true);

create policy "authenticated users can manage bookings" on public.bookings for all to authenticated using (true) with check (true);
create policy "authenticated users can manage matches" on public.matches for all to authenticated using (true) with check (true);
create policy "authenticated users can manage attendance sessions" on public.attendance_sessions for all to authenticated using (true) with check (true);
create policy "authenticated users can manage attendance records" on public.attendance_records for all to authenticated using (true) with check (true);
