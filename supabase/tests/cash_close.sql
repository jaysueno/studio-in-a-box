-- A close with a difference needs a note and an owner sign-off. A balanced day closes without one.
begin;
set local search_path = public, extensions;
select plan(4);

insert into auth.users (id, email) values
  ('ffffffff-0000-4000-8000-000000000061', 'ines.calder@test.invalid'),
  ('ffffffff-0000-4000-8000-000000000062', 'tomas.reyes@test.invalid');

insert into public.staff (id, full_name, role) values
  ('ffffffff-0000-4000-8000-000000000061', 'Ines Calder', 'owner'),
  ('ffffffff-0000-4000-8000-000000000062', 'Tomas Reyes', 'front_desk');

select throws_ok(
  'insert into public.cash_close
     (day, expected, counted, difference, note, signed_off_by, closed_at)
   values (date ''2099-01-01'', 100, 90, -10, null,
           ''ffffffff-0000-4000-8000-000000000061'',
           timestamptz ''2099-01-01 20:00:00+08'')',
  null, null,
  'a difference without a note is refused');

select throws_ok(
  'insert into public.cash_close
     (day, expected, counted, difference, note, signed_off_by, closed_at)
   values (date ''2099-01-02'', 100, 90, -10, ''drawer short by ten'',
           ''ffffffff-0000-4000-8000-000000000062'',
           timestamptz ''2099-01-02 20:00:00+08'')',
  null, null,
  'a difference signed by the front desk is refused');

select lives_ok(
  'insert into public.cash_close
     (day, expected, counted, difference, note, signed_off_by, closed_at)
   values (date ''2099-01-03'', 100, 90, -10, ''drawer short by ten'',
           ''ffffffff-0000-4000-8000-000000000061'',
           timestamptz ''2099-01-03 20:00:00+08'')',
  'an owner closes a difference with a note');

select lives_ok(
  'insert into public.cash_close
     (day, expected, counted, difference, note, signed_off_by, closed_at)
   values (date ''2099-01-04'', 100, 100, 0, null, null,
           timestamptz ''2099-01-04 20:00:00+08'')',
  'a balanced day closes without a note');

select * from finish();
rollback;
