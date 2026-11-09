'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { money, plainError } from '@/lib/format';

type Props = {
  day: string;
  expected: number;
  counted: number;
  note: string | null;
  closed: boolean;
  hasRow: boolean;
  isOwner: boolean;
};

export function CloseForm({ day, expected, counted, note, closed, hasRow, isOwner }: Props) {
  const router = useRouter();
  const [countedValue, setCountedValue] = useState(money(counted));
  const [noteValue, setNoteValue] = useState(note ?? '');
  const [isClosed, setIsClosed] = useState(closed);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const difference = Number(countedValue || 0) - Number(expected);

  async function sign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const client = getBrowserSupabase();
    const { data: { user } } = await client.auth.getUser();
    const payload = {
      counted: Number(countedValue || 0),
      difference,
      note: noteValue.trim() ? noteValue.trim() : null,
      signed_off_by: user?.id ?? null,
      closed_at: new Date().toISOString(),
    };
    const result = hasRow
      ? await client.from('cash_close').update(payload).eq('day', day)
      : await client.from('cash_close').insert({ day, expected, ...payload });
    setBusy(false);
    if (result.error) {
      setError(plainError(result.error.message));
      return;
    }
    setIsClosed(true);
    router.refresh();
  }

  return (
    <form className="stack" onSubmit={sign}>
      <p>
        Expected <span className="money" data-testid="close-expected">{money(expected)}</span>
      </p>
      <div className="field">
        <label htmlFor="counted">Counted in the drawer</label>
        <input
          id="counted"
          data-testid="close-counted"
          type="number"
          step="0.01"
          value={countedValue}
          onChange={(event) => setCountedValue(event.target.value)}
          disabled={isClosed}
        />
      </div>
      <p>
        Difference <span className="money">{money(difference)}</span>
      </p>
      <div className="field">
        <label htmlFor="note">Note</label>
        <textarea
          id="note"
          data-testid="close-note"
          value={noteValue}
          onChange={(event) => setNoteValue(event.target.value)}
          disabled={isClosed}
          placeholder="What explains the difference"
        />
      </div>
      <div className="row">
        <button
          className="btn btn-primary"
          type="submit"
          data-testid="close-sign"
          disabled={isClosed || !isOwner || busy}
        >
          {isClosed ? 'Closed' : busy ? 'Signing...' : 'Sign and close'}
        </button>
        <span
          className={`status ${isClosed ? 'status-closed' : 'status-open'}`}
          data-testid="close-status"
        >
          {isClosed ? 'closed' : 'open'}
        </span>
      </div>
      {!isOwner ? <p className="muted">Only the owner can sign the close.</p> : null}
      {error ? <p className="error" role="alert">{error}</p> : null}
    </form>
  );
}
