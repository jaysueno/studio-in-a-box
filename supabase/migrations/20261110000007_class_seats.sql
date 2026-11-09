-- studio-in-a-box, part 2: seats left per class.
-- A member can read the class list but not other members' bookings, so row level security hides
-- the count the schedule needs. This view runs with the owner's rights and exposes the aggregate
-- only: a class id, its capacity, how many active bookings it has, and how many seats are left.
-- It carries no member data.

create or replace view public.class_seats as
select c.id as class_id,
       c.capacity,
       count(b.id) filter (where b.cancelled_at is null)::integer as booked,
       (c.capacity - count(b.id) filter (where b.cancelled_at is null))::integer as seats_left
  from public.classes c
  left join public.bookings b on b.class_id = c.id
 group by c.id, c.capacity;

revoke all on public.class_seats from anon, authenticated;
grant select on public.class_seats to authenticated;
