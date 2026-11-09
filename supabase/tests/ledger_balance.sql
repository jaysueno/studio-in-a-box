-- Credits issued minus used minus expired plus refunded equals the remaining view, for every
-- package, including a package at zero. A row whose sign contradicts its kind is refused.
begin;
set local search_path = public, extensions;
select plan(4);

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000041', 'harper.ives@test.invalid');

insert into public.members (id, full_name, email) values
  ('aaaaaaaa-0000-4000-8000-000000000041', 'Harper Ives', 'harper.ives@test.invalid');

insert into public.packages (id, member_id, name, credits, price, purchased_at, expires_on) values
  ('bbbbbbbb-0000-4000-8000-000000000041',
   'aaaaaaaa-0000-4000-8000-000000000041', 'Four class pack', 4, 40.00,
   '2027-02-01 10:00:00+00', '2027-12-31'),
  ('bbbbbbbb-0000-4000-8000-000000000042',
   'aaaaaaaa-0000-4000-8000-000000000041', 'Single class', 1, 12.00,
   '2027-02-02 10:00:00+00', '2027-12-31'),
  ('bbbbbbbb-0000-4000-8000-000000000043',
   'aaaaaaaa-0000-4000-8000-000000000041', 'Three class pack', 3, 33.00,
   '2027-02-03 10:00:00+00', '2027-02-12');

insert into public.credit_ledger (package_id, member_id, kind, credits, occurred_at) values
  ('bbbbbbbb-0000-4000-8000-000000000041',
   'aaaaaaaa-0000-4000-8000-000000000041', 'issue', 4, '2027-02-01 10:00:00+00'),
  ('bbbbbbbb-0000-4000-8000-000000000041',
   'aaaaaaaa-0000-4000-8000-000000000041', 'use', -1, '2027-02-20 12:00:00+00'),
  ('bbbbbbbb-0000-4000-8000-000000000041',
   'aaaaaaaa-0000-4000-8000-000000000041', 'use', -1, '2027-02-21 12:00:00+00'),
  ('bbbbbbbb-0000-4000-8000-000000000041',
   'aaaaaaaa-0000-4000-8000-000000000041', 'refund', 1, '2027-02-22 12:00:00+00'),
  ('bbbbbbbb-0000-4000-8000-000000000042',
   'aaaaaaaa-0000-4000-8000-000000000041', 'issue', 1, '2027-02-02 10:00:00+00'),
  ('bbbbbbbb-0000-4000-8000-000000000042',
   'aaaaaaaa-0000-4000-8000-000000000041', 'use', -1, '2027-02-23 12:00:00+00'),
  ('bbbbbbbb-0000-4000-8000-000000000043',
   'aaaaaaaa-0000-4000-8000-000000000041', 'issue', 3, '2027-02-03 10:00:00+00'),
  ('bbbbbbbb-0000-4000-8000-000000000043',
   'aaaaaaaa-0000-4000-8000-000000000041', 'expire', -3, '2027-02-12 00:00:00+00');

select is(
  (select remaining from public.member_credits
    where package_id = 'bbbbbbbb-0000-4000-8000-000000000041'),
  3,
  'issued minus used minus expired plus refunded equals remaining');

select is(
  (select remaining from public.member_credits
    where package_id = 'bbbbbbbb-0000-4000-8000-000000000042'),
  0,
  'a package at zero keeps a row with zero remaining');

select is(
  (select count(*) from public.member_credits
    where member_id = 'aaaaaaaa-0000-4000-8000-000000000041'),
  3::bigint,
  'one row per package, including packages at zero');

select throws_ok(
  'insert into public.credit_ledger (package_id, member_id, kind, credits, occurred_at)
   values (''bbbbbbbb-0000-4000-8000-000000000041'',
           ''aaaaaaaa-0000-4000-8000-000000000041'', ''use'', 1, now())',
  null, null,
  'a ledger row whose sign contradicts its kind is refused');

select * from finish();
rollback;
