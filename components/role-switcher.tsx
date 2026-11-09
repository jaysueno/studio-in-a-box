'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DEMO_PASSWORD, DEMO_USERS } from '@/lib/seed.mjs';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { plainError } from '@/lib/format';

export function RoleSwitcher() {
  const router = useRouter();
  const [email, setEmail] = useState(DEMO_USERS[0].email);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const { error: signInError } = await getBrowserSupabase().auth.signInWithPassword({
      email,
      password: DEMO_PASSWORD,
    });
    if (signInError) {
      setError(plainError(signInError.message));
      setBusy(false);
      return;
    }
    const chosen = DEMO_USERS.find((entry) => entry.email === email);
    const target = chosen?.role === 'member'
      ? '/me'
      : chosen?.role === 'instructor' ? '/schedule' : '/desk';
    router.push(target);
    router.refresh();
  }

  return (
    <form className="card stack" onSubmit={submit}>
      <div className="field">
        <label htmlFor="role">Sign in as</label>
        <select
          id="role"
          data-testid="role-switcher"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        >
          {DEMO_USERS.map((entry) => (
            <option key={entry.email} value={entry.email}>
              {entry.label} ({entry.email})
            </option>
          ))}
        </select>
      </div>
      <div className="row">
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? 'Signing in...' : 'Sign in'}
        </button>
      </div>
      {error ? <p className="error" role="alert">{error}</p> : null}
    </form>
  );
}
