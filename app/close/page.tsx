import { redirect } from 'next/navigation';
import { NotAllowed } from '@/components/not-allowed';
import { CloseForm } from '@/components/close-form';
import { cashTotal, getViewer, isDeskRole, latestPaymentDay } from '@/lib/data';
import { createServerSupabase } from '@/lib/supabase/server';
import { isValidDay, money, nextDay } from '@/lib/format';

export const dynamic = 'force-dynamic';

type CloseRow = {
  day: string;
  expected: number;
  counted: number;
  difference: number;
  note: string | null;
  signed_off_by: string | null;
  closed_at: string | null;
};

export default async function ClosePage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer.id) redirect('/login');
  if (!isDeskRole(viewer.role)) {
    return <NotAllowed detail="The close is for the front desk and the owner. Only the owner signs." />;
  }
  const supabase = await createServerSupabase();
  if (!supabase) redirect('/login');

  const params = await searchParams;
  const latest = await latestPaymentDay(supabase);
  const day = isValidDay(params.day)
    ? params.day
    : latest ?? new Date().toISOString().slice(0, 10);

  const [{ data: rowData }, { data: payments }] = await Promise.all([
    supabase
      .from('cash_close')
      .select('day, expected, counted, difference, note, signed_off_by, closed_at')
      .eq('day', day)
      .maybeSingle(),
    supabase
      .from('payments')
      .select('id, method')
      .gte('paid_at', `${day}T00:00:00Z`)
      .lt('paid_at', `${nextDay(day)}T00:00:00Z`),
  ]);

  const row = (rowData as CloseRow | null) ?? null;
  const expected = row ? Number(row.expected) : await cashTotal(supabase, day);
  const paymentCount = payments?.length ?? 0;
  const isOwner = viewer.role === 'owner';

  return (
    <section>
      <h1>Close</h1>
      <p className="lead">
        Expected is the day&apos;s cash. The desk counts the drawer, and only the owner signs.
        Once signed, the day cannot change.
      </p>

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
        <h2 style={{ marginTop: 0 }}>{day}</h2>
        <CloseForm
          day={day}
          expected={expected}
          counted={row ? Number(row.counted) : expected}
          note={row?.note ?? null}
          closed={!!row?.closed_at}
          hasRow={!!row}
          isOwner={isOwner}
        />
        <p className="muted" style={{ marginTop: 12 }}>
          {paymentCount} payment{paymentCount === 1 ? '' : 's'} recorded this day.
          {' '}Expected cash: {money(expected)}.
        </p>
      </div>
    </section>
  );
}
