-- studio-in-a-box, part 1: the tables.
-- Every table carries synthetic studio data only. Times are stored as timestamptz.

create table if not exists public.members (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (length(btrim(full_name)) > 0),
  email text not null unique,
  joined_on date not null default current_date
);

create table if not exists public.staff (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (length(btrim(full_name)) > 0),
  role text not null check (role in ('owner', 'front_desk', 'instructor'))
);

create table if not exists public.packages (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  credits integer not null check (credits > 0),
  price numeric(10, 2) not null check (price >= 0),
  purchased_at timestamptz not null,
  expires_on date not null
);

create index if not exists packages_member_idx on public.packages (member_id);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  instructor_id uuid not null references public.staff (id),
  starts_at timestamptz not null,
  duration_minutes integer not null default 60
    check (duration_minutes between 15 and 240),
  capacity integer not null check (capacity between 1 and 60)
);

create index if not exists classes_starts_at_idx on public.classes (starts_at);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  package_id uuid not null references public.packages (id),
  booked_at timestamptz not null default now(),
  unique (member_id, class_id)
);

create index if not exists bookings_class_idx on public.bookings (class_id);
create index if not exists bookings_member_idx on public.bookings (member_id);

-- The ledger is append only. A row's signed credits must match its kind:
-- issue and refund add credits, use and expire take them away.
create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.packages (id) on delete restrict,
  member_id uuid not null references public.members (id) on delete restrict,
  kind text not null check (kind in ('issue', 'use', 'expire', 'refund')),
  credits integer not null,
  occurred_at timestamptz not null default now(),
  constraint credit_ledger_sign_matches_kind check (
    (kind in ('issue', 'refund') and credits > 0)
    or (kind in ('use', 'expire') and credits < 0)
  )
);

create index if not exists credit_ledger_package_idx on public.credit_ledger (package_id);
create index if not exists credit_ledger_member_idx on public.credit_ledger (member_id);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id),
  package_id uuid references public.packages (id),
  amount numeric(10, 2) not null check (amount > 0),
  method text not null check (method in ('cash', 'card')),
  paid_at timestamptz not null,
  recorded_by uuid references public.staff (id)
);

create index if not exists payments_paid_at_idx on public.payments (paid_at);

create table if not exists public.cash_close (
  day date primary key,
  expected numeric(10, 2) not null check (expected >= 0),
  counted numeric(10, 2) not null check (counted >= 0),
  difference numeric(10, 2) not null,
  note text,
  signed_off_by uuid references public.staff (id),
  closed_at timestamptz,
  constraint cash_close_difference_matches check (difference = counted - expected)
);
