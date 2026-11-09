-- Round 3: bookings are sealed. Direct UPDATE and DELETE are refused, cancellation goes through
-- cancel_booking, it refunds one credit, and a cancelled seat is free again. Self contained and
-- rolled back.
begin;
set local search_path = public, extensions;
select plan(17);

insert into auth.users (id, email) values
  ('ffffffff-0000-4000-8000-000000000091', 'ines.calder@test.invalid'),
  ('ffffffff-0000-4000-8000-000000000092', 'tomas.reyes@test.invalid'),
  ('cccccccc-0000-4000-8000-000000000091', 'lena.park@test.invalid'),
  ('aaaaaaaa-0000-4000-8000-000000000091', 'rae.moss@test.invalid'),
  ('aaaaaaaa-0000-4000-8000-000000000092', 'sol.nash@test.invalid');

insert into public.staff (id, full_name, role) values
  ('ffffffff-0000-4000-8000-000000000091', 'Ines Calder', 'owner'),
  ('ffffffff-0000-4000-8000-000000000092', 'Tomas Reyes', 'front_desk'),
  ('cccccccc-0000-4000-8000-000000000091', 'Lena Park', 'instructor');

insert into public.members (id, full_name, email) values
  ('aaaaaaaa-0000-4000-8000-000000000091', 'Rae Moss', 'rae.moss@test.invalid'),
  ('aaaaaaaa-0000-4000-8000-000000000092', 'Sol Nash', 'sol.nash@test.invalid');

insert into public.packages (id, member_id, name, credits, price, purchased_at, expires_on) values
  ('bbbbbbbb-0000-4000-8000-000000000091',
   'aaaaaaaa-0000-4000-8000-000000000091', 'Three class pack', 3, 33.00,
   '2027-02-01 10:00:00+00', '2027-12-31'),
  ('bbbbbbbb-0000-4000-8000-000000000092',
   'aaaaaaaa-0000-4000-8000-000000000092', 'Two class pack', 2, 24.00,
   '2027-02-01 10:00:00+00', '2027-12-31');

insert into public.credit_ledger (package_id, member_id, kind, credits, occurred_at) values
  ('bbbbbbbb-0000-4000-8000-000000000091',
   'aaaaaaaa-0000-4000-8000-000000000091', 'issue', 3, '2027-02-01 10:00:00+00'),
  ('bbbbbbbb-0000-4000-8000-000000000092',
   'aaaaaaaa-0000-4000-8000-000000000092', 'issue', 2, '2027-02-01 10:00:00+00');

insert into public.classes (id, name, instructor_id, starts_at, duration_minutes, capacity) values
  ('dddddddd-0000-4000-8000-000000000091', 'Morning Flow',
   'cccccccc-0000-4000-8000-000000000091', '2027-03-01 09:00:00+00', 60, 4),
  ('dddddddd-0000-4000-8000-000000000092', 'Evening Stretch',
   'cccccccc-0000-4000-8000-000000000091', '2027-03-01 10:00:00+00', 60, 1);

-- Rae books one place in a roomy class and the only place in a full class.
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000091","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  'select public.book_class(''aaaaaaaa-0000-4000-8000-000000000091'',
                              ''dddddddd-0000-4000-8000-000000000091'')',
  'a member books the first class');

select lives_ok(
  'select public.book_class(''aaaaaaaa-0000-4000-8000-000000000091'',
                              ''dddddddd-0000-4000-8000-000000000092'')',
  'a member books the last seat');

reset role;

-- Direct writes, as the desk.
select set_config('request.jwt.claims',
  '{"sub":"ffffffff-0000-4000-8000-000000000092","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  'update public.bookings set member_id = ''aaaaaaaa-0000-4000-8000-000000000092''
    where member_id = ''aaaaaaaa-0000-4000-8000-000000000091''
      and class_id = ''dddddddd-0000-4000-8000-000000000091''',
  null, null,
  'the front desk cannot repoint a booking to another member');

select throws_ok(
  'update public.bookings set class_id = ''dddddddd-0000-4000-8000-000000000092''
    where member_id = ''aaaaaaaa-0000-4000-8000-000000000091''
      and class_id = ''dddddddd-0000-4000-8000-000000000091''',
  null, null,
  'the front desk cannot move a booking to another class');

select throws_ok(
  'update public.bookings set package_id = ''bbbbbbbb-0000-4000-8000-000000000092''
    where member_id = ''aaaaaaaa-0000-4000-8000-000000000091''
      and class_id = ''dddddddd-0000-4000-8000-000000000091''',
  null, null,
  'the front desk cannot move a booking to another package');

select throws_ok(
  'delete from public.bookings
    where member_id = ''aaaaaaaa-0000-4000-8000-000000000091''
      and class_id = ''dddddddd-0000-4000-8000-000000000091''',
  null, null,
  'the front desk cannot delete a booking');

reset role;

-- Even the database owner cannot write a booking directly: the trigger is the second guard.
select throws_ok(
  'update public.bookings set member_id = ''aaaaaaaa-0000-4000-8000-000000000092''
    where member_id = ''aaaaaaaa-0000-4000-8000-000000000091''
      and class_id = ''dddddddd-0000-4000-8000-000000000091''',
  null, null,
  'no direct update of a booking row');

select throws_ok(
  'delete from public.bookings
    where member_id = ''aaaaaaaa-0000-4000-8000-000000000091''
      and class_id = ''dddddddd-0000-4000-8000-000000000091''',
  null, null,
  'no direct delete of a booking row');

-- A member cannot cancel someone else's booking.
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000092","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  'select public.cancel_booking(
     (select id from public.bookings
       where member_id = ''aaaaaaaa-0000-4000-8000-000000000091''
         and class_id = ''dddddddd-0000-4000-8000-000000000091''))',
  null, null,
  'a member cannot cancel another member booking');

-- The desk cancels, and the credit comes back.
select set_config('request.jwt.claims',
  '{"sub":"ffffffff-0000-4000-8000-000000000092","role":"authenticated"}', true);

select lives_ok(
  'select public.cancel_booking(
     (select id from public.bookings
       where member_id = ''aaaaaaaa-0000-4000-8000-000000000091''
         and class_id = ''dddddddd-0000-4000-8000-000000000091''))',
  'the front desk cancels a booking');

reset role;

select isnt(
  (select cancelled_at from public.bookings
    where member_id = 'aaaaaaaa-0000-4000-8000-000000000091'
      and class_id = 'dddddddd-0000-4000-8000-000000000091'),
  null::timestamptz,
  'the cancelled booking carries a cancelled_at');

select is(
  (select count(*) from public.credit_ledger
    where package_id = 'bbbbbbbb-0000-4000-8000-000000000091' and kind = 'refund'),
  1::bigint,
  'the cancellation writes exactly one refund row');

select is(
  (select remaining from public.member_credits
    where package_id = 'bbbbbbbb-0000-4000-8000-000000000091'),
  2,
  'the balance goes back up by one');

-- Cancelling twice is refused.
select set_config('request.jwt.claims',
  '{"sub":"ffffffff-0000-4000-8000-000000000092","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  'select public.cancel_booking(
     (select id from public.bookings
       where member_id = ''aaaaaaaa-0000-4000-8000-000000000091''
         and class_id = ''dddddddd-0000-4000-8000-000000000091''))',
  null, null,
  'a booking cannot be cancelled twice');

-- The full class is full while the seat is held, and free after the cancellation.
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000092","role":"authenticated"}', true);

select throws_ok(
  'select public.book_class(''aaaaaaaa-0000-4000-8000-000000000092'',
                              ''dddddddd-0000-4000-8000-000000000092'')',
  null, null,
  'a full class is still full while the seat is held');

select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000091","role":"authenticated"}', true);

select lives_ok(
  'select public.cancel_booking(
     (select id from public.bookings
       where member_id = ''aaaaaaaa-0000-4000-8000-000000000091''
         and class_id = ''dddddddd-0000-4000-8000-000000000092''))',
  'a member cancels their own booking');

select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000092","role":"authenticated"}', true);

select lives_ok(
  'select public.book_class(''aaaaaaaa-0000-4000-8000-000000000092'',
                              ''dddddddd-0000-4000-8000-000000000092'')',
  'the cancelled seat can be booked by someone else');

reset role;
select * from finish();
rollback;
