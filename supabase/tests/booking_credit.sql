-- book_class takes exactly one credit, refuses a member with none, and refuses a full class.
-- Self contained: rows are built as the database owner, then each caller is switched in turn.
begin;
set local search_path = public, extensions;
select plan(7);

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000051', 'indigo.james@test.invalid'),
  ('aaaaaaaa-0000-4000-8000-000000000052', 'jules.kerr@test.invalid'),
  ('aaaaaaaa-0000-4000-8000-000000000053', 'kai.lund@test.invalid'),
  ('cccccccc-0000-4000-8000-000000000051', 'lena.park@test.invalid');

insert into public.members (id, full_name, email) values
  ('aaaaaaaa-0000-4000-8000-000000000051', 'Indigo James', 'indigo.james@test.invalid'),
  ('aaaaaaaa-0000-4000-8000-000000000052', 'Jules Kerr', 'jules.kerr@test.invalid'),
  ('aaaaaaaa-0000-4000-8000-000000000053', 'Kai Lund', 'kai.lund@test.invalid');

insert into public.staff (id, full_name, role) values
  ('cccccccc-0000-4000-8000-000000000051', 'Lena Park', 'instructor');

insert into public.packages (id, member_id, name, credits, price, purchased_at, expires_on) values
  ('bbbbbbbb-0000-4000-8000-000000000051',
   'aaaaaaaa-0000-4000-8000-000000000051', 'Two class pack', 2, 24.00,
   '2027-02-01 10:00:00+00', '2027-12-31'),
  ('bbbbbbbb-0000-4000-8000-000000000053',
   'aaaaaaaa-0000-4000-8000-000000000053', 'Single class', 1, 12.00,
   '2027-02-01 10:00:00+00', '2027-12-31');

insert into public.credit_ledger (package_id, member_id, kind, credits, occurred_at) values
  ('bbbbbbbb-0000-4000-8000-000000000051',
   'aaaaaaaa-0000-4000-8000-000000000051', 'issue', 2, '2027-02-01 10:00:00+00'),
  ('bbbbbbbb-0000-4000-8000-000000000053',
   'aaaaaaaa-0000-4000-8000-000000000053', 'issue', 1, '2027-02-01 10:00:00+00');

insert into public.classes (id, name, instructor_id, starts_at, duration_minutes, capacity) values
  ('dddddddd-0000-4000-8000-000000000051', 'Morning Flow',
   'cccccccc-0000-4000-8000-000000000051', '2027-03-01 09:00:00+00', 60, 4),
  ('dddddddd-0000-4000-8000-000000000052', 'Evening Stretch',
   'cccccccc-0000-4000-8000-000000000051', '2027-03-01 18:00:00+00', 60, 1);

select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000051","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  'select public.book_class(
     ''aaaaaaaa-0000-4000-8000-000000000051'',
     ''dddddddd-0000-4000-8000-000000000051'')',
  'a member with a credit books a class');

select is(
  (select remaining from public.member_credits
    where package_id = 'bbbbbbbb-0000-4000-8000-000000000051'),
  1,
  'the booking took exactly one credit');

select is(
  (select count(*) from public.bookings
    where member_id = 'aaaaaaaa-0000-4000-8000-000000000051'
      and class_id = 'dddddddd-0000-4000-8000-000000000051'),
  1::bigint,
  'the booking row was written once');

select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000052","role":"authenticated"}', true);

select throws_ok(
  'select public.book_class(
     ''aaaaaaaa-0000-4000-8000-000000000052'',
     ''dddddddd-0000-4000-8000-000000000051'')',
  null, null,
  'a booking with zero credits is refused');

select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000051","role":"authenticated"}', true);

select lives_ok(
  'select public.book_class(
     ''aaaaaaaa-0000-4000-8000-000000000051'',
     ''dddddddd-0000-4000-8000-000000000052'')',
  'a second class takes the last credit');

select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000053","role":"authenticated"}', true);

select throws_ok(
  'select public.book_class(
     ''aaaaaaaa-0000-4000-8000-000000000053'',
     ''dddddddd-0000-4000-8000-000000000052'')',
  null, null,
  'a booking into a full class is refused');

select is(
  (select remaining from public.member_credits
    where package_id = 'bbbbbbbb-0000-4000-8000-000000000053'),
  1,
  'a refused booking takes no credit');

reset role;
select * from finish();
rollback;
