import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BookButton } from '@/components/book-button';
import { CancelButton } from '@/components/cancel-button';
import { getViewer, joinedClass } from '@/lib/data';
import { createServerSupabase } from '@/lib/supabase/server';
import { formatWhen } from '@/lib/format';
import { seatsLabel } from '@/lib/seats-label';

export const dynamic = 'force-dynamic';

type CreditRow = { package_id: string; remaining: number };
type SeatRow = { class_id: string; seats_left: number };
type FutureClass = { id: string; name: string; starts_at: string };
type BookingRow = {
  id: string;
  class_id: string;
  cancelled_at: string | null;
  booked_at: string;
  classes?: unknown;
};

export default async function MePage() {
  const viewer = await getViewer();
  if (!viewer.id) redirect('/login');

  if (!viewer.member) {
    return (
      <section className="card">
        <h1>My page</h1>
        <p className="lead">
          This page shows a member&apos;s credits and bookings. You are signed in as
          {' '}{viewer.role ?? 'a user'}.
        </p>
        <p>
          <Link className="btn" href="/schedule">See the schedule</Link>
        </p>
      </section>
    );
  }

  const supabase = await createServerSupabase();
  if (!supabase) redirect('/login');

  const now = new Date().toISOString();
  const [{ data: creditRows }, { data: bookingRows }, { data: seats }, { data: future }] =
    await Promise.all([
      supabase.from('member_credits').select('package_id, remaining'),
      supabase
        .from('bookings')
        .select('id, class_id, cancelled_at, booked_at, classes(name, starts_at)')
        .order('booked_at', { ascending: false }),
      supabase.from('class_seats').select('class_id, seats_left'),
      supabase
        .from('classes')
        .select('id, name, starts_at')
        .gt('starts_at', now)
        .order('starts_at'),
    ]);

  const credits = ((creditRows ?? []) as CreditRow[]).reduce(
    (sum, row) => sum + Number(row.remaining),
    0,
  );
  const seatMap = new Map<string, number>(
    ((seats ?? []) as SeatRow[]).map((row) => [row.class_id, Number(row.seats_left)]),
  );
  const nextClass = ((future ?? []) as FutureClass[]).find(
    (row) => (seatMap.get(row.id) ?? 0) > 0,
  );
  const history = (bookingRows ?? []) as BookingRow[];

  return (
    <section>
      <h1>My page</h1>
      <div className="card">
        <p className="muted">Credits remaining</p>
        <p className="money">
          <span data-testid="credits-remaining">{credits}</span>
        </p>
        {credits === 0 ? <p className="muted">No credits yet. A new package adds more.</p> : null}
      </div>

      {nextClass ? (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Next class with a seat</h2>
          <div className="item-title">{nextClass.name}</div>
          <div className="item-meta">{formatWhen(nextClass.starts_at)}</div>
          <div className="row" style={{ marginTop: 8 }}>
            <span className="seats">{seatsLabel(seatMap.get(nextClass.id))}</span>
            <BookButton memberId={viewer.member.id} classId={nextClass.id} />
          </div>
        </div>
      ) : null}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Bookings</h2>
        {history.length === 0 ? (
          <p className="muted">No bookings yet.</p>
        ) : (
          <ul className="list">
            {history.map((row) => {
              const session = joinedClass(row);
              const started = session.starts_at ? Date.parse(session.starts_at) <= Date.now() : true;
              const active = !row.cancelled_at && !started;
              return (
                <li key={row.id}>
                  <div className="item-title">{session.name ?? 'Class'}</div>
                  <div className="item-meta">
                    {session.starts_at ? formatWhen(session.starts_at) : 'Time unknown'}
                    {' · '}
                    {row.cancelled_at ? 'cancelled' : started ? 'past' : 'booked'}
                  </div>
                  {active ? (
                    <div className="row" style={{ marginTop: 8 }}>
                      <CancelButton bookingId={row.id} />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
