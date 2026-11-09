'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { plainError } from '@/lib/format';

export function BookButton({ memberId, classId }: { memberId: string; classId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function book() {
    setBusy(true);
    setError('');
    const { error: rpcError } = await getBrowserSupabase().rpc('book_class', {
      p_member: memberId,
      p_class: classId,
    });
    setBusy(false);
    if (rpcError) {
      setError(plainError(rpcError.message));
      return;
    }
    setDone(true);
    router.refresh();
  }

  return (
    <div>
      <button
        className="btn btn-primary"
        type="button"
        data-testid="book-button"
        onClick={book}
        disabled={busy || done}
      >
        {done ? 'Booked' : busy ? 'Booking...' : 'Book'}
      </button>
      {error ? (
        <p className="error" data-testid="booking-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
