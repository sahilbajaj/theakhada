insert into public.clubs (id, name, city, timezone)
values ('00000000-0000-0000-0000-000000000001', 'The Akhada Tennis Club', 'Bengaluru', 'Asia/Kolkata')
on conflict (id) do nothing;

insert into public.courts (club_id, name, surface, indoor)
values
  ('00000000-0000-0000-0000-000000000001', 'Court 1', 'hard', false),
  ('00000000-0000-0000-0000-000000000001', 'Court 2', 'hard', false),
  ('00000000-0000-0000-0000-000000000001', 'Clay 1', 'clay', false),
  ('00000000-0000-0000-0000-000000000001', 'Indoor A', 'synthetic', true);
