'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { plainError } from '@/lib/format';

type Choice = { id: string; label: string };

export function DeskBookForm({ members, classes }: { members: Choice[]; classes: Choice[] }) {
  const router = useRouter();
  const [memberId, setMemberId] = useState(members[0]?.id ?? '');
  const [classId, setClassId] = useState(classes[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [booked, setBooked] = useState('');

  if (!members.length || !classes.length) {
    return (
      <p className="muted">
        {members.length ? 'No class with a free seat is available.' : 'No member with credits is available.'}
      </p>
    );
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setBooked('');
    const { error: rpcError } = await getBrowserSupabase().rpc('book_class', {
      p_member: memberId,
      p_class: classId,
    });
    setBusy(false);
    if (rpcError) {
      setError(plainError(rpcError.message));
      return;
    }
    setBooked('Booked. The credit was taken and the class is on the roster.');
    router.refresh();
  }

  return (
    <form className="stack" onSubmit={submit}>
      <div className="field">
        <label htmlFor="desk-member">Member</label>
        <select
          id="desk-member"
          value={memberId}
          onChange={(event) => setMemberId(event.target.value)}
        >
          {members.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="desk-class">Class</label>
        <select
          id="desk-class"
          value={classId}
          onChange={(event) => setClassId(event.target.value)}
        >
          {classes.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.label}
            </option>
          ))}
        </select>
      </div>
      <div className="row">
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? 'Booking...' : 'Book for this member'}
        </button>
      </div>
      {error ? (
        <p className="error" data-testid="booking-error" role="alert">
          {error}
        </p>
      ) : null}
      {booked ? <p className="ok" role="status">{booked}</p> : null}
    </form>
  );
}
