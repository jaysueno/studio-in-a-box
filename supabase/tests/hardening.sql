-- Round 2 hardening: a closed day is final, every booking goes through book_class, expiry is
-- enforced, and anon executes nothing in public. Self contained and rolled back.
begin;
set local search_path = public, extensions;
select plan(27);

insert into auth.users (id, email) values
  ('ffffffff-0000-4000-8000-000000000071', 'ines.calder@test.invalid'),
  ('ffffffff-0000-4000-8000-000000000072', 'tomas.reyes@test.invalid'),
  ('aaaaaaaa-0000-4000-8000-000000000071', 'ora.finch@test.invalid'),
  ('aaaaaaaa-0000-4000-8000-000000000081', 'pax.hollis@test.invalid'),
  ('aaaaaaaa-0000-4000-8000-000000000082', 'quinn.ives@test.invalid'),
  ('cccccccc-0000-4000-8000-000000000071', 'lena.park@test.invalid');

insert into public.staff (id, full_name, role) values
  ('ffffffff-0000-4000-8000-000000000071', 'Ines Calder', 'owner'),
  ('ffffffff-0000-4000-8000-000000000072', 'Tomas Reyes', 'front_desk'),
  ('cccccccc-0000-4000-8000-000000000071', 'Lena Park', 'instructor');

insert into public.members (id, full_name, email) values
  ('aaaaaaaa-0000-4000-8000-000000000071', 'Ora Finch', 'ora.finch@test.invalid'),
  ('aaaaaaaa-0000-4000-8000-000000000081', 'Pax Hollis', 'pax.hollis@test.invalid'),
  ('aaaaaaaa-0000-4000-8000-000000000082', 'Quinn Ives', 'quinn.ives@test.invalid');

-- 1. Expiry runs once and is idempotent, as the owner.
insert into public.packages (id, member_id, name, credits, price, purchased_at, expires_on) values
  ('bbbbbbbb-0000-4000-8000-000000000071',
   'aaaaaaaa-0000-4000-8000-000000000071', 'Two class pack', 2, 24.00,
   '2026-12-20 10:00:00+00', '2027-01-10');

insert into public.credit_ledger (package_id, member_id, kind, credits, occurred_at) values
  ('bbbbbbbb-0000-4000-8000-000000000071',
   'aaaaaaaa-0000-4000-8000-000000000071', 'issue', 2, '2026-12-20 10:00:00+00');

select set_config('request.jwt.claims',
  '{"sub":"ffffffff-0000-4000-8000-000000000071","role":"authenticated"}', true);
set local role authenticated;

select is(public.expire_credits(date '2027-01-31'), 1,
  'the owner expires one due package');

select is(public.expire_credits(date '2027-01-31'), 0,
  'a second expiry run writes no row');

select is(
  (select remaining from public.member_credits
    where package_id = 'bbbbbbbb-0000-4000-8000-000000000071'),
  0,
  'the expired package is at zero');

select is(
  (select credits from public.credit_ledger
    where package_id = 'bbbbbbbb-0000-4000-8000-000000000071' and kind = 'expire'),
  -2,
  'the expire row takes the whole remaining balance');

reset role;

-- 2. Closed days are final; the desk edits only unsigned open days; only an owner signs.
insert into public.cash_close
  (day, expected, counted, difference, note, signed_off_by, closed_at)
values
  (date '2099-02-01', 100, 100, 0, null,
   'ffffffff-0000-4000-8000-000000000071', timestamptz '2099-02-01 20:00:00+08'),
  (date '2099-02-02', 50, 50, 0, null, null, null);

select set_config('request.jwt.claims',
  '{"sub":"ffffffff-0000-4000-8000-000000000072","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  'update public.cash_close set expected = 0 where day = ''2099-02-01''',
  null, null,
  'the front desk cannot update a closed day');

select throws_ok(
  'update public.cash_close set signed_off_by = ''ffffffff-0000-4000-8000-000000000071''
    where day = ''2099-02-02''',
  null, null,
  'the front desk cannot sign a day');

select lives_ok(
  'update public.cash_close set counted = 45, difference = -5 where day = ''2099-02-02''',
  'the front desk edits an open day before sign-off');

select set_config('request.jwt.claims',
  '{"sub":"ffffffff-0000-4000-8000-000000000071","role":"authenticated"}', true);

select throws_ok(
  'update public.cash_close set signed_off_by = ''ffffffff-0000-4000-8000-000000000072''
    where day = ''2099-02-02''',
  null, null,
  'an owner signs only for themselves');

select lives_ok(
  'update public.cash_close
      set signed_off_by = ''ffffffff-0000-4000-8000-000000000071'',
          note = ''drawer short by five'',
          closed_at = timestamptz ''2099-02-02 20:00:00+08''
    where day = ''2099-02-02''',
  'an owner signs an open day with a note');

select throws_ok(
  'delete from public.cash_close where day = ''2099-02-01''',
  null, null,
  'the owner cannot delete a closed day');

select is(
  (select expected from public.cash_close where day = date '2099-02-01'),
  100::numeric,
  'the closed day is unchanged');

reset role;

-- 3. Every booking goes through book_class; expiry decides which package pays.
insert into public.packages (id, member_id, name, credits, price, purchased_at, expires_on) values
  ('bbbbbbbb-0000-4000-8000-000000000081',
   'aaaaaaaa-0000-4000-8000-000000000081', 'Two class pack', 2, 24.00,
   '2026-12-01 10:00:00+00', '2027-01-01'),
  ('bbbbbbbb-0000-4000-8000-000000000082',
   'aaaaaaaa-0000-4000-8000-000000000082', 'Two class pack', 2, 24.00,
   '2026-12-01 10:00:00+00', '2027-01-01'),
  ('bbbbbbbb-0000-4000-8000-000000000083',
   'aaaaaaaa-0000-4000-8000-000000000082', 'Three class pack', 3, 33.00,
   '2027-02-01 10:00:00+00', '2027-12-31');

insert into public.credit_ledger (package_id, member_id, kind, credits, occurred_at) values
  ('bbbbbbbb-0000-4000-8000-000000000081',
   'aaaaaaaa-0000-4000-8000-000000000081', 'issue', 2, '2026-12-01 10:00:00+00'),
  ('bbbbbbbb-0000-4000-8000-000000000082',
   'aaaaaaaa-0000-4000-8000-000000000082', 'issue', 2, '2026-12-01 10:00:00+00'),
  ('bbbbbbbb-0000-4000-8000-000000000083',
   'aaaaaaaa-0000-4000-8000-000000000082', 'issue', 3, '2027-02-01 10:00:00+00');

insert into public.classes (id, name, instructor_id, starts_at, duration_minutes, capacity) values
  ('dddddddd-0000-4000-8000-000000000081', 'Morning Flow',
   'cccccccc-0000-4000-8000-000000000071', '2027-03-01 09:00:00+00', 60, 4),
  ('dddddddd-0000-4000-8000-000000000082', 'Evening Stretch',
   'cccccccc-0000-4000-8000-000000000071', '2027-03-01 10:00:00+00', 60, 4);

select set_config('request.jwt.claims',
  '{"sub":"ffffffff-0000-4000-8000-000000000072","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  'insert into public.bookings (member_id, class_id, package_id)
   values (''aaaaaaaa-0000-4000-8000-000000000082'',
           ''dddddddd-0000-4000-8000-000000000081'',
           ''bbbbbbbb-0000-4000-8000-000000000083'')',
  null, null,
  'the front desk cannot insert a booking directly');

select lives_ok(
  'select public.book_class(''aaaaaaaa-0000-4000-8000-000000000082'',
                              ''dddddddd-0000-4000-8000-000000000081'')',
  'the front desk books a class for a member');

select is(
  (select count(*) from public.credit_ledger
    where member_id = 'aaaaaaaa-0000-4000-8000-000000000082' and kind = 'use'),
  1::bigint,
  'the desk booking writes one use row');

select is(
  (select package_id from public.bookings
    where member_id = 'aaaaaaaa-0000-4000-8000-000000000082'
      and class_id = 'dddddddd-0000-4000-8000-000000000081'),
  'bbbbbbbb-0000-4000-8000-000000000083'::uuid,
  'the booking spends the valid package that belongs to the member');

select is(
  (select remaining from public.member_credits
    where package_id = 'bbbbbbbb-0000-4000-8000-000000000083'),
  2,
  'the valid package lost exactly one credit');

select is(
  (select remaining from public.member_credits
    where package_id = 'bbbbbbbb-0000-4000-8000-000000000082'),
  2,
  'the expired package was not touched');

select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000081","role":"authenticated"}', true);

select throws_ok(
  'select public.book_class(''aaaaaaaa-0000-4000-8000-000000000081'',
                              ''dddddddd-0000-4000-8000-000000000082'')',
  null, null,
  'a member whose only package has expired cannot book');

select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000082","role":"authenticated"}', true);

select throws_ok(
  'select public.book_class(''aaaaaaaa-0000-4000-8000-000000000081'',
                              ''dddddddd-0000-4000-8000-000000000082'')',
  null, null,
  'a member cannot book for another member');

reset role;

-- 4. anon executes nothing in public.
set local role anon;

select throws_ok(
  'select public.book_class(''aaaaaaaa-0000-4000-8000-000000000082'',
                              ''dddddddd-0000-4000-8000-000000000081'')',
  null, null,
  'anon cannot call book_class');

select throws_ok(
  'select public.expire_credits(date ''2027-01-31'')',
  null, null,
  'anon cannot call expire_credits');

select throws_ok('select public.current_staff_role()', null, null,
  'anon cannot call the role helper');

select throws_ok('select public.is_owner()', null, null,
  'anon cannot call the owner helper');

select throws_ok('select public.is_desk()', null, null,
  'anon cannot call the desk helper');

select throws_ok('select public.is_instructor_of(null::uuid)', null, null,
  'anon cannot call the instructor helper');

select throws_ok('select count(*) from public.member_credits', null, null,
  'anon cannot read the credits view');

select is(
  (select count(*)
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and has_function_privilege('anon', p.oid, 'execute')),
  0::bigint,
  'anon can execute no function in public');

reset role;
select * from finish();
rollback;
