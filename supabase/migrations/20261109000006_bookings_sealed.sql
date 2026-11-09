-- studio-in-a-box, round 3: bookings are written only by functions.
-- book_class creates a booking, cancel_booking cancels one and refunds its credit. No role updates
-- or deletes a booking directly. A cancelled booking stops counting toward class capacity.

alter table public.bookings add column if not exists cancelled_at timestamptz;

-- Direct writes: no policy, no grant. The trigger is the second guard for any role that still has
-- a grant, including the database owner.
drop policy if exists bookings_update_desk on public.bookings;
drop policy if exists bookings_delete_desk on public.bookings;
revoke update, delete on public.bookings from authenticated;
revoke update, delete on public.bookings from anon;

create or replace function public.bookings_write_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_owner text;
begin
  select pg_get_userbyid(c.relowner) into v_owner
    from pg_class c
   where c.oid = 'public.bookings'::regclass;

  -- The only allowed change is the cancellation done by cancel_booking: the function marks the
  -- transaction, runs as the table owner, and touches only cancelled_at.
  if tg_op = 'UPDATE'
     and current_setting('studio.booking_write', true) = 'cancel'
     and current_user = v_owner
     and old.cancelled_at is null
     and new.cancelled_at is not null
     and new.member_id = old.member_id
     and new.class_id = old.class_id
     and new.package_id = old.package_id
     and new.booked_at = old.booked_at then
    return new;
  end if;

  raise exception 'bookings are written only by book_class and cancel_booking';
end;
$$;

drop trigger if exists bookings_write_guard on public.bookings;
create trigger bookings_write_guard
  before update or delete on public.bookings
  for each row execute function public.bookings_write_guard();

-- Creation: a cancelled booking no longer holds a seat.
create or replace function public.book_class(p_member uuid, p_class uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_booking uuid := gen_random_uuid();
  v_capacity integer;
  v_starts_at timestamptz;
  v_class_date date;
  v_taken integer;
  v_package uuid;
begin
  if not exists (select 1 from public.members m where m.id = p_member) then
    raise exception 'member not found';
  end if;

  if auth.uid() is not null and auth.uid() <> p_member and not public.is_desk() then
    raise exception 'a member can only book for themselves';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_member::text, 0));

  select c.capacity, c.starts_at
    into v_capacity, v_starts_at
    from public.classes c
   where c.id = p_class
   for update;

  if not found then
    raise exception 'class not found';
  end if;
  if v_starts_at <= now() then
    raise exception 'class has already started';
  end if;

  v_class_date := (v_starts_at at time zone 'UTC')::date;

  select count(*) into v_taken
    from public.bookings b
   where b.class_id = p_class and b.cancelled_at is null;
  if v_taken >= v_capacity then
    raise exception 'class is full';
  end if;

  select l.package_id
    into v_package
    from public.credit_ledger l
    join public.packages pk
      on pk.id = l.package_id and pk.member_id = p_member
   where l.member_id = p_member
     and (pk.expires_on is null or pk.expires_on >= v_class_date)
   group by l.package_id
  having sum(l.credits) > 0
   order by min(l.occurred_at) asc, l.package_id asc
   limit 1;

  if v_package is null then
    raise exception 'member has no credits available';
  end if;

  insert into public.bookings (id, member_id, class_id, package_id, booked_at)
  values (v_booking, p_member, p_class, v_package, now());

  insert into public.credit_ledger
    (package_id, member_id, kind, credits, occurred_at)
  values (v_package, p_member, 'use', -1, now());

  return v_booking;
end;
$$;

-- Cancellation: the booked member, the desk or the owner. One refund row, one transaction.
create or replace function public.cancel_booking(p_booking uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member uuid;
  v_package uuid;
  v_cancelled timestamptz;
  v_starts_at timestamptz;
begin
  select b.member_id, b.package_id, b.cancelled_at, c.starts_at
    into v_member, v_package, v_cancelled, v_starts_at
    from public.bookings b
    join public.classes c on c.id = b.class_id
   where b.id = p_booking
   for update of b;

  if not found then
    raise exception 'booking not found';
  end if;

  if auth.uid() is not null and auth.uid() <> v_member and not public.is_desk() then
    raise exception 'a member can only cancel their own booking';
  end if;

  if v_cancelled is not null then
    raise exception 'booking is already cancelled';
  end if;

  if v_starts_at <= now() then
    raise exception 'class has already started';
  end if;

  if not exists (
    select 1 from public.packages pk
     where pk.id = v_package and pk.member_id = v_member
  ) then
    raise exception 'the booking package does not belong to the member';
  end if;

  perform set_config('studio.booking_write', 'cancel', true);

  update public.bookings set cancelled_at = now() where id = p_booking;

  insert into public.credit_ledger
    (package_id, member_id, kind, credits, occurred_at)
  values (v_package, v_member, 'refund', 1, now());
end;
$$;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.current_staff_role() to authenticated;
grant execute on function public.is_owner() to authenticated;
grant execute on function public.is_desk() to authenticated;
grant execute on function public.is_instructor_of(uuid) to authenticated;
grant execute on function public.book_class(uuid, uuid) to authenticated;
grant execute on function public.expire_credits(date) to authenticated;
grant execute on function public.cancel_booking(uuid) to authenticated;
