-- The front desk reads the ledger and cannot write it. Payments are its write path.
-- Self contained: rows are built as the database owner, then the role and the claim are switched.
begin;
set local search_path = public, extensions;
select plan(3);

insert into auth.users (id, email) values
  ('ffffffff-0000-4000-8000-000000000001', 'tomas.reyes@test.invalid'),
  ('aaaaaaaa-0000-4000-8000-000000000021', 'emery.finn@test.invalid');

insert into public.staff (id, full_name, role) values
  ('ffffffff-0000-4000-8000-000000000001', 'Tomas Reyes', 'front_desk');

insert into public.members (id, full_name, email) values
  ('aaaaaaaa-0000-4000-8000-000000000021', 'Emery Finn', 'emery.finn@test.invalid');

insert into public.packages (id, member_id, name, credits, price, purchased_at, expires_on) values
  ('bbbbbbbb-0000-4000-8000-000000000021',
   'aaaaaaaa-0000-4000-8000-000000000021', 'Four class pack', 4, 40.00,
   '2027-02-01 10:00:00+00', '2027-12-31');

insert into public.credit_ledger (package_id, member_id, kind, credits, occurred_at) values
  ('bbbbbbbb-0000-4000-8000-000000000021',
   'aaaaaaaa-0000-4000-8000-000000000021', 'issue', 4, '2027-02-01 10:00:00+00');

select set_config('request.jwt.claims',
  '{"sub":"ffffffff-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select count(*) from public.credit_ledger
    where member_id = 'aaaaaaaa-0000-4000-8000-000000000021'),
  1::bigint,
  'the front desk reads the ledger');

select throws_ok(
  'insert into public.credit_ledger (package_id, member_id, kind, credits, occurred_at)
   values (''bbbbbbbb-0000-4000-8000-000000000021'',
           ''aaaaaaaa-0000-4000-8000-000000000021'', ''issue'', 4, now())',
  '42501', null,
  'the front desk cannot insert into the ledger');

select lives_ok(
  'insert into public.payments (member_id, package_id, amount, method, paid_at)
   values (''aaaaaaaa-0000-4000-8000-000000000021'',
           ''bbbbbbbb-0000-4000-8000-000000000021'', 40.00, ''cash'', now())',
  'the front desk records a payment');

reset role;
select * from finish();
rollback;
