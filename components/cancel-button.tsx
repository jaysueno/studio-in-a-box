'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { plainError } from '@/lib/format';

export function CancelButton({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function cancel() {
    setBusy(true);
    setError('');
    const { error: rpcError } = await getBrowserSupabase().rpc('cancel_booking', {
      p_booking: bookingId,
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
        className="btn"
        type="button"
        data-testid="cancel-button"
        onClick={cancel}
        disabled={busy || done}
      >
        {done ? 'Cancelled' : busy ? 'Cancelling...' : 'Cancel'}
      </button>
      {error ? (
        <p className="error" data-testid="booking-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
