-- A member reads their own rows and no one else.
-- Self contained: every row is built here as the database owner, then the role and the claim are
-- switched. No test depends on the seed.
begin;
set local search_path = public, extensions;
select plan(4);

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'avery.ash@test.invalid'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'blair.boyd@test.invalid');

insert into public.members (id, full_name, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Avery Ash', 'avery.ash@test.invalid'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'Blair Boyd', 'blair.boyd@test.invalid');

insert into public.packages (id, member_id, name, credits, price, purchased_at, expires_on) values
  ('bbbbbbbb-0000-4000-8000-000000000001',
   'aaaaaaaa-0000-4000-8000-000000000001', 'Four class pack', 4, 40.00,
   '2027-02-01 10:00:00+00', '2027-12-31'),
  ('bbbbbbbb-0000-4000-8000-000000000002',
   'aaaaaaaa-0000-4000-8000-000000000002', 'Four class pack', 4, 40.00,
   '2027-02-01 10:00:00+00', '2027-12-31');

insert into public.credit_ledger (package_id, member_id, kind, credits, occurred_at) values
  ('bbbbbbbb-0000-4000-8000-000000000001',
   'aaaaaaaa-0000-4000-8000-000000000001', 'issue', 4, '2027-02-01 10:00:00+00'),
  ('bbbbbbbb-0000-4000-8000-000000000002',
   'aaaaaaaa-0000-4000-8000-000000000002', 'issue', 4, '2027-02-01 10:00:00+00');

select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select count(*) from public.members),
  1::bigint,
  'a member reads only their own member row');

select is(
  (select count(*) from public.members
    where id = 'aaaaaaaa-0000-4000-8000-000000000002'),
  0::bigint,
  'a member cannot read another member row');

select is(
  (select count(*) from public.credit_ledger),
  1::bigint,
  'a member reads only their own ledger rows');

select is(
  (select count(*) from public.credit_ledger
    where member_id = 'aaaaaaaa-0000-4000-8000-000000000002'),
  0::bigint,
  'a member cannot read another member ledger');

reset role;
select * from finish();
rollback;
