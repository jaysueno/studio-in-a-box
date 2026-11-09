import { redirect } from 'next/navigation';
import { NotAllowed } from '@/components/not-allowed';
import { DeskBookForm } from '@/components/desk-book-form';
import { getViewer, isDeskRole, latestPaymentDay, joinedClass } from '@/lib/data';
import { createServerSupabase } from '@/lib/supabase/server';
import { formatShortWhen, formatWhen, isValidDay, money, nextDay } from '@/lib/format';
import { seatsLabel } from '@/lib/seats-label';

export const dynamic = 'force-dynamic';

type PaymentRow = {
  id: string;
  amount: number;
  method: string;
  paid_at: string;
  member_id: string;
};
type ClassRow = { id: string; name: string; starts_at: string };
type BookingRow = {
  id: string;
  member_id: string;
  class_id: string;
  cancelled_at: string | null;
  classes?: unknown;
};
type MemberRow = { id: string; full_name: string; email: string };
type CreditRow = { member_id: string; remaining: number };
type SeatRow = { class_id: string; seats_left: number };

export default async function DeskPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer.id) redirect('/login');
  if (!isDeskRole(viewer.role)) {
    return <NotAllowed detail="The desk is for the front desk and the owner." />;
  }
  const supabase = await createServerSupabase();
  if (!supabase) redirect('/login');

  const params = await searchParams;
  const latest = await latestPaymentDay(supabase);
  const day = isValidDay(params.day)
    ? params.day
    : latest ?? new Date().toISOString().slice(0, 10);

  const start = `${day}T00:00:00Z`;
  const end = `${nextDay(day)}T00:00:00Z`;
  const now = new Date().toISOString();

  const [
    { data: payments },
    { data: dayClasses },
    { data: memberRows },
    { data: creditRows },
    { data: seats },
    { data: future },
  ] = await Promise.all([
    supabase
      .from('payments')
      .select('id, amount, method, paid_at, member_id')
      .gte('paid_at', start)
      .lt('paid_at', end)
      .order('paid_at'),
    supabase
      .from('classes')
      .select('id, name, starts_at')
      .gte('starts_at', start)
      .lt('starts_at', end)
      .order('starts_at'),
    supabase.from('members').select('id, full_name, email').order('full_name'),
    supabase.from('member_credits').select('member_id, remaining'),
    supabase.from('class_seats').select('class_id, seats_left'),
    supabase
      .from('classes')
      .select('id, name, starts_at')
      .gt('starts_at', now)
      .order('starts_at'),
  ]);

  const classIds = ((dayClasses ?? []) as ClassRow[]).map((row) => row.id);
  const bookingResult = classIds.length
    ? await supabase
        .from('bookings')
        .select('id, member_id, class_id, cancelled_at, classes(name, starts_at)')
        .in('class_id', classIds)
        .order('booked_at')
    : { data: [] as BookingRow[] };
  const bookings = (bookingResult.data ?? []) as BookingRow[];

  const members = (memberRows ?? []) as MemberRow[];
  const memberName = new Map(members.map((row) => [row.id, row.full_name]));
  const creditByMember = new Map<string, number>();
  for (const row of (creditRows ?? []) as CreditRow[]) {
    creditByMember.set(
      row.member_id,
      (creditByMember.get(row.member_id) ?? 0) + Number(row.remaining),
    );
  }
  const seatMap = new Map<string, number>(
    ((seats ?? []) as SeatRow[]).map((row) => [row.class_id, Number(row.seats_left)]),
  );
  const bookMembers = members
    .filter((row) => (creditByMember.get(row.id) ?? 0) > 0)
    .map((row) => ({ id: row.id, label: row.full_name }));
  const bookClasses = ((future ?? []) as ClassRow[])
    .filter((row) => (seatMap.get(row.id) ?? 0) > 0)
    .map((row) => ({
      id: row.id,
      label: `${row.name}, ${formatShortWhen(row.starts_at)}, ${seatsLabel(seatMap.get(row.id))}`,
    }));

  return (
    <section>
      <h1>Desk</h1>
      <p className="lead">The day&apos;s payments and bookings, and a booking for any member.</p>

      <div className="card">
        <form method="get" className="row">
          <div className="field">
            <label htmlFor="day">Day</label>
            <input id="day" name="day" type="date" defaultValue={day} style={{ maxWidth: 220 }} />
          </div>
          <button className="btn" type="submit">View day</button>
        </form>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Book for a member</h2>
        <DeskBookForm members={bookMembers} classes={bookClasses} />
      </div>

      <div className="two-col">
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Payments</h2>
          {payments && payments.length ? (
            <ul className="list">
              {(payments as PaymentRow[]).map((row) => (
                <li key={row.id}>
                  <div className="item-title">{memberName.get(row.member_id) ?? 'Member'}</div>
                  <div className="item-meta">
                    {formatWhen(row.paid_at)} · {row.method} · {money(row.amount)}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No payments recorded for this day.</p>
          )}
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>Bookings</h2>
          {bookings.length ? (
            <ul className="list">
              {bookings.map((row) => {
                const session = joinedClass(row);
                return (
                  <li key={row.id}>
                    <div className="item-title">{memberName.get(row.member_id) ?? 'Member'}</div>
                    <div className="item-meta">
                      {session.name ?? 'Class'}
                      {session.starts_at ? ` · ${formatWhen(session.starts_at)}` : ''}
                      {row.cancelled_at ? ' · cancelled' : ''}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="muted">No bookings for this day.</p>
          )}
        </div>
      </div>
    </section>
  );
}
