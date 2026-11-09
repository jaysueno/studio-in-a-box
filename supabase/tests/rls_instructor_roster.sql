-- An instructor reads the roster of their own classes and no other class.
-- Self contained: rows are built as the database owner, then the role and the claim are switched.
begin;
set local search_path = public, extensions;
select plan(3);

insert into auth.users (id, email) values
  ('cccccccc-0000-4000-8000-000000000001', 'nadia.brooks@test.invalid'),
  ('cccccccc-0000-4000-8000-000000000002', 'yusuf.adeyemi@test.invalid'),
  ('aaaaaaaa-0000-4000-8000-000000000011', 'casey.dale@test.invalid'),
  ('aaaaaaaa-0000-4000-8000-000000000012', 'drew.ellis@test.invalid');

insert into public.staff (id, full_name, role) values
  ('cccccccc-0000-4000-8000-000000000001', 'Nadia Brooks', 'instructor'),
  ('cccccccc-0000-4000-8000-000000000002', 'Yusuf Adeyemi', 'instructor');

insert into public.members (id, full_name, email) values
  ('aaaaaaaa-0000-4000-8000-000000000011', 'Casey Dale', 'casey.dale@test.invalid'),
  ('aaaaaaaa-0000-4000-8000-000000000012', 'Drew Ellis', 'drew.ellis@test.invalid');

insert into public.packages (id, member_id, name, credits, price, purchased_at, expires_on) values
  ('bbbbbbbb-0000-4000-8000-000000000011',
   'aaaaaaaa-0000-4000-8000-000000000011', 'Four class pack', 4, 40.00,
   '2027-02-01 10:00:00+00', '2027-12-31'),
  ('bbbbbbbb-0000-4000-8000-000000000012',
   'aaaaaaaa-0000-4000-8000-000000000012', 'Four class pack', 4, 40.00,
   '2027-02-01 10:00:00+00', '2027-12-31');

insert into public.classes (id, name, instructor_id, starts_at, duration_minutes, capacity) values
  ('dddddddd-0000-4000-8000-000000000001', 'Morning Flow',
   'cccccccc-0000-4000-8000-000000000001', '2027-03-01 09:00:00+00', 60, 10),
  ('dddddddd-0000-4000-8000-000000000002', 'Slow Strength',
   'cccccccc-0000-4000-8000-000000000002', '2027-03-01 11:00:00+00', 60, 10);

insert into public.bookings (id, member_id, class_id, package_id, booked_at) values
  ('eeeeeeee-0000-4000-8000-000000000001',
   'aaaaaaaa-0000-4000-8000-000000000011', 'dddddddd-0000-4000-8000-000000000001',
   'bbbbbbbb-0000-4000-8000-000000000011', '2027-02-20 12:00:00+00'),
  ('eeeeeeee-0000-4000-8000-000000000002',
   'aaaaaaaa-0000-4000-8000-000000000012', 'dddddddd-0000-4000-8000-000000000002',
   'bbbbbbbb-0000-4000-8000-000000000012', '2027-02-20 12:00:00+00');

select set_config('request.jwt.claims',
  '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select count(*) from public.bookings
    where class_id = 'dddddddd-0000-4000-8000-000000000001'),
  1::bigint,
  'an instructor reads the roster of their own class');

select is(
  (select count(*) from public.bookings
    where class_id = 'dddddddd-0000-4000-8000-000000000002'),
  0::bigint,
  'an instructor cannot read another instructor''s roster');

select is(
  (select count(*) from public.bookings),
  1::bigint,
  'an instructor sees no booking outside their own classes');

reset role;
select * from finish();
rollback;
