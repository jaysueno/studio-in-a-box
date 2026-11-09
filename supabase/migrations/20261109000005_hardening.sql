-- studio-in-a-box, part 1 hardening.
-- A closed day is final for every role. Every booking goes through book_class. Expired packages
-- cannot be spent, and the owner expires them through one idempotent function. anon can execute
-- nothing in public.

-- 1. A closed day is final, even for the owner -----------------------------------------------

create or replace function public.cash_close_final_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.closed_at is not null then
    raise exception 'a closed day is final: row % cannot be %', old.day, lower(tg_op);
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists cash_close_final_guard on public.cash_close;
create trigger cash_close_final_guard
  before update or delete on public.cash_close
  for each row execute function public.cash_close_final_guard();

-- The desk may reach any row it can read, so an attempt on a closed row hits the trigger and is
-- refused loudly instead of quietly changing zero rows. The with-check still stops a desk update
-- from signing a row; only an owner may sign, and only for themselves.
drop policy if exists cash_close_insert_desk on public.cash_close;
create policy cash_close_insert_desk on public.cash_close
  for insert to authenticated
  with check (
    (public.is_owner() and (signed_off_by is null or signed_off_by = auth.uid()))
    or (public.current_staff_role() = 'front_desk' and signed_off_by is null)
  );

drop policy if exists cash_close_update_desk on public.cash_close;
create policy cash_close_update_desk on public.cash_close
  for update to authenticated
  using (public.is_desk())
  with check (
    (public.is_owner() and (signed_off_by is null or signed_off_by = auth.uid()))
    or (public.current_staff_role() = 'front_desk' and signed_off_by is null)
  );

drop policy if exists cash_close_delete_owner on public.cash_close;
create policy cash_close_delete_owner on public.cash_close
  for delete to authenticated
  using (public.is_owner());

-- 2. Every booking goes through book_class ---------------------------------------------------

drop policy if exists bookings_insert_desk on public.bookings;
revoke insert on public.bookings from authenticated;

-- The function spends only from a package that is valid on the class date, oldest first, and the
-- package it writes is joined to the booked member, so the row can never point at someone else's
-- package. A member books for themselves; the desk and the owner may book for any member.
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

  -- Serialize bookings for one member, then for one class.
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

  select count(*) into v_taken from public.bookings b where b.class_id = p_class;
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

-- 3. Expiry ----------------------------------------------------------------------------------

-- The owner expires every package that is past its date with credits left: one 'expire' row per
-- package, equal to minus the remaining balance. A second run finds nothing and returns 0.
create or replace function public.expire_credits(p_as_of date)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rows integer := 0;
begin
  if not public.is_owner() then
    raise exception 'only the owner can expire credits';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('expire_credits', 0));

  with due as (
    select pk.id as package_id,
           pk.member_id,
           (-sum(l.credits))::integer as credits
      from public.packages pk
      join public.credit_ledger l
        on l.package_id = pk.id and l.member_id = pk.member_id
     where pk.expires_on is not null
       and pk.expires_on < p_as_of
     group by pk.id, pk.member_id
    having sum(l.credits) > 0
  ), written as (
    insert into public.credit_ledger
      (package_id, member_id, kind, credits, occurred_at)
    select due.package_id, due.member_id, 'expire', due.credits, now()
      from due
    returning 1
  )
  select count(*) into v_rows from written;

  return v_rows;
end;
$$;

-- 4. anon executes nothing in public ---------------------------------------------------------

revoke execute on all functions in schema public from public, anon;

grant execute on function public.current_staff_role() to authenticated;
grant execute on function public.is_owner() to authenticated;
grant execute on function public.is_desk() to authenticated;
grant execute on function public.is_instructor_of(uuid) to authenticated;
grant execute on function public.book_class(uuid, uuid) to authenticated;
grant execute on function public.expire_credits(date) to authenticated;
