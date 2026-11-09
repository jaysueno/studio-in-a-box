-- The ledger is append only. No role updates or deletes a row, and the trigger is the last guard.
begin;
set local search_path = public, extensions;
select plan(4);

insert into auth.users (id, email) values
  ('ffffffff-0000-4000-8000-000000000011', 'tomas.reyes@test.invalid'),
  ('aaaaaaaa-0000-4000-8000-000000000031', 'frankie.gray@test.invalid');

insert into public.staff (id, full_name, role) values
  ('ffffffff-0000-4000-8000-000000000011', 'Tomas Reyes', 'front_desk');

insert into public.members (id, full_name, email) values
  ('aaaaaaaa-0000-4000-8000-000000000031', 'Frankie Gray', 'frankie.gray@test.invalid');

insert into public.packages (id, member_id, name, credits, price, purchased_at, expires_on) values
  ('bbbbbbbb-0000-4000-8000-000000000031',
   'aaaaaaaa-0000-4000-8000-000000000031', 'Four class pack', 4, 40.00,
   '2027-02-01 10:00:00+00', '2027-12-31');

insert into public.credit_ledger (package_id, member_id, kind, credits, occurred_at) values
  ('bbbbbbbb-0000-4000-8000-000000000031',
   'aaaaaaaa-0000-4000-8000-000000000031', 'issue', 4, '2027-02-01 10:00:00+00');

select throws_ok(
  'update public.credit_ledger set credits = credits',
  null, null,
  'nobody updates a ledger row');

select throws_ok(
  'delete from public.credit_ledger',
  null, null,
  'nobody deletes a ledger row');

select set_config('request.jwt.claims',
  '{"sub":"ffffffff-0000-4000-8000-000000000011","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  'update public.credit_ledger set credits = 5',
  null, null,
  'the front desk cannot update a ledger row');

select throws_ok(
  'delete from public.credit_ledger',
  null, null,
  'the front desk cannot delete a ledger row');

reset role;
select * from finish();
rollback;
