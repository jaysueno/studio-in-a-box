-- studio-in-a-box, part 1: the credit balance view and the booking function.

-- Credits remaining is a live sum over the ledger. It is never stored on the package, so the
-- ledger and the balance can never disagree. Every package gets one row, including packages whose
-- remaining credits are zero.
create or replace view public.member_credits
with (security_invoker = true)
as
select p.member_id,
       p.id as package_id,
       coalesce(sum(l.credits), 0)::integer as remaining
  from public.packages p
  left join public.credit_ledger l
    on l.package_id = p.id and l.member_id = p.member_id
 group by p.member_id, p.id;

-- Role helpers. They read public.staff as the owner so a policy can call them without recursing
-- through row level security on the same table.
create or replace function public.current_staff_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select s.role from public.staff s where s.id = auth.uid()
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.current_staff_role() = 'owner', false)
$$;

create or replace function public.is_desk()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.current_staff_role() in ('front_desk', 'owner'), false)
$$;

create or replace function public.is_instructor_of(p_class uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.classes c
     where c.id = p_class and c.instructor_id = auth.uid()
  )
$$;

-- One booking in one transaction: lock the member, refuse a full class, take exactly one credit
-- from the member's earliest package that still has a balance, write the booking and the ledger
-- row together. A member books only for themselves; the desk and the database owner may book for
-- anyone.
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

  select count(*) into v_taken from public.bookings b where b.class_id = p_class;
  if v_taken >= v_capacity then
    raise exception 'class is full';
  end if;

  select l.package_id
    into v_package
    from public.credit_ledger l
   where l.member_id = p_member
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
