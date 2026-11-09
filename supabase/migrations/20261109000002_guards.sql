-- studio-in-a-box, part 1: guards.
-- The ledger refuses a row whose sign contradicts its kind, and refuses every update and delete.
-- The close refuses a difference without a note and an owner once closed_at is set.

create or replace function public.credit_ledger_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if (new.kind in ('issue', 'refund') and new.credits <= 0)
       or (new.kind in ('use', 'expire') and new.credits >= 0) then
      raise exception 'credit_ledger sign does not match kind %', new.kind
        using errcode = 'check_violation';
    end if;
    return new;
  end if;
  raise exception 'credit_ledger is append only: a row cannot be %', lower(tg_op)
    using errcode = 'insufficient_privilege';
end;
$$;

drop trigger if exists credit_ledger_append_only on public.credit_ledger;
create trigger credit_ledger_append_only
  before insert or update or delete on public.credit_ledger
  for each row execute function public.credit_ledger_guard();

create or replace function public.cash_close_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.closed_at is not null and new.difference <> 0 then
    if new.note is null or btrim(new.note) = '' then
      raise exception 'a close with a difference needs a note';
    end if;
    if new.signed_off_by is null
       or not exists (
         select 1 from public.staff s
          where s.id = new.signed_off_by and s.role = 'owner'
       ) then
      raise exception 'a close with a difference must be signed off by an owner';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists cash_close_guard on public.cash_close;
create trigger cash_close_guard
  before insert or update on public.cash_close
  for each row execute function public.cash_close_guard();
