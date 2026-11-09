-- studio-in-a-box, part 1: row level security and grants.
-- A member reads only their own rows. The front desk reads members, classes and bookings, and
-- writes payments and bookings through the functions. An instructor reads the roster of their
-- own classes. The owner reads everything and signs the close. The ledger is written only by the
-- security definer functions (book_class, cancel_booking, expire_credits).

alter table public.members enable row level security;
alter table public.staff enable row level security;
alter table public.packages enable row level security;
alter table public.classes enable row level security;
alter table public.bookings enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.payments enable row level security;
alter table public.cash_close enable row level security;

drop policy if exists members_select_self on public.members;
create policy members_select_self on public.members
  for select to authenticated
  using (id = auth.uid() or public.is_desk());

drop policy if exists staff_select_self_or_owner on public.staff;
create policy staff_select_self_or_owner on public.staff
  for select to authenticated
  using (id = auth.uid() or public.is_owner());

drop policy if exists packages_select_own on public.packages;
create policy packages_select_own on public.packages
  for select to authenticated
  using (member_id = auth.uid() or public.is_desk());

drop policy if exists packages_insert_desk on public.packages;
create policy packages_insert_desk on public.packages
  for insert to authenticated
  with check (public.is_desk());

drop policy if exists classes_select_signed_in on public.classes;
create policy classes_select_signed_in on public.classes
  for select to authenticated
  using (true);

drop policy if exists classes_insert_desk on public.classes;
create policy classes_insert_desk on public.classes
  for insert to authenticated
  with check (public.is_desk());

drop policy if exists classes_update_desk on public.classes;
create policy classes_update_desk on public.classes
  for update to authenticated
  using (public.is_desk())
  with check (public.is_desk());

drop policy if exists bookings_select_own on public.bookings;
create policy bookings_select_own on public.bookings
  for select to authenticated
  using (
    member_id = auth.uid()
    or public.is_desk()
    or public.is_instructor_of(class_id)
  );

drop policy if exists bookings_insert_desk on public.bookings;
create policy bookings_insert_desk on public.bookings
  for insert to authenticated
  with check (public.is_desk());

drop policy if exists bookings_update_desk on public.bookings;
create policy bookings_update_desk on public.bookings
  for update to authenticated
  using (public.is_desk())
  with check (public.is_desk());

drop policy if exists bookings_delete_desk on public.bookings;
create policy bookings_delete_desk on public.bookings
  for delete to authenticated
  using (public.is_desk());

-- Read only for the desk and the member who owns the row. There is deliberately no insert,
-- update or delete policy: the write paths are the security definer functions book_class,
-- cancel_booking and expire_credits.
drop policy if exists credit_ledger_select_own on public.credit_ledger;
create policy credit_ledger_select_own on public.credit_ledger
  for select to authenticated
  using (member_id = auth.uid() or public.is_desk());

drop policy if exists payments_select_own on public.payments;
create policy payments_select_own on public.payments
  for select to authenticated
  using (member_id = auth.uid() or public.is_desk());

drop policy if exists payments_insert_desk on public.payments;
create policy payments_insert_desk on public.payments
  for insert to authenticated
  with check (public.is_desk());

drop policy if exists cash_close_select_desk on public.cash_close;
create policy cash_close_select_desk on public.cash_close
  for select to authenticated
  using (public.is_desk());

drop policy if exists cash_close_insert_desk on public.cash_close;
create policy cash_close_insert_desk on public.cash_close
  for insert to authenticated
  with check (
    public.is_desk()
    and (signed_off_by is null or signed_off_by = auth.uid() or public.is_owner())
  );

drop policy if exists cash_close_update_desk on public.cash_close;
create policy cash_close_update_desk on public.cash_close
  for update to authenticated
  using (public.is_desk())
  with check (
    public.is_desk()
    and (signed_off_by is null or signed_off_by = auth.uid() or public.is_owner())
  );

drop policy if exists cash_close_delete_owner on public.cash_close;
create policy cash_close_delete_owner on public.cash_close
  for delete to authenticated
  using (public.is_owner());

-- Grants. The local stack does not auto expose new tables, so every privilege is explicit.
grant usage on schema public to anon, authenticated;

revoke all on all tables in schema public from anon, authenticated;

grant select on
  public.members,
  public.staff,
  public.packages,
  public.classes,
  public.bookings,
  public.credit_ledger,
  public.payments,
  public.cash_close,
  public.member_credits
  to authenticated;

grant insert on
  public.packages,
  public.classes,
  public.bookings,
  public.payments,
  public.cash_close
  to authenticated;

grant update on
  public.classes,
  public.bookings,
  public.cash_close
  to authenticated;

grant delete on
  public.bookings,
  public.cash_close
  to authenticated;

revoke all on function public.book_class(uuid, uuid) from public, anon;
grant execute on function public.book_class(uuid, uuid) to authenticated;
