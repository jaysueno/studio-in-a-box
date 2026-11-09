import { redirect } from 'next/navigation';
import { BookButton } from '@/components/book-button';
import { getViewer } from '@/lib/data';
import { createServerSupabase } from '@/lib/supabase/server';
import { formatWhen } from '@/lib/format';
import { seatsLabel } from '@/lib/seats-label';

export const dynamic = 'force-dynamic';

type ClassRow = { id: string; name: string; starts_at: string; capacity: number };
type SeatRow = { class_id: string; seats_left: number };

export default async function SchedulePage() {
  const viewer = await getViewer();
  if (!viewer.id) redirect('/login');
  const supabase = await createServerSupabase();
  if (!supabase) redirect('/login');

  const now = new Date().toISOString();
  const [{ data: classes }, { data: seats }] = await Promise.all([
    supabase
      .from('classes')
      .select('id, name, starts_at, capacity')
      .gt('starts_at', now)
      .order('starts_at'),
    supabase.from('class_seats').select('class_id, seats_left'),
  ]);

  const seatMap = new Map<string, number>(
    ((seats ?? []) as SeatRow[]).map((row) => [row.class_id, Number(row.seats_left)]),
  );
  const open = ((classes ?? []) as ClassRow[]).filter(
    (row) => (seatMap.get(row.id) ?? 0) > 0,
  );

  return (
    <section>
      <h1>Schedule</h1>
      <p className="lead">Classes with a seat left. A booking takes one credit.</p>
      {open.length === 0 ? (
        <p className="card">No class has a free seat right now. Check again after a cancellation.</p>
      ) : (
        <ul className="class-grid">
          {open.map((row) => (
            <li className="card" key={row.id}>
              <div className="item-title">{row.name}</div>
              <div className="item-meta">{formatWhen(row.starts_at)}</div>
              <div className="row" style={{ marginTop: 8 }}>
                <span className="seats">{seatsLabel(seatMap.get(row.id))}</span>
                {viewer.member ? (
                  <BookButton memberId={viewer.member.id} classId={row.id} />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
