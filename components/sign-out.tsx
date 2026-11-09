'use client';

import { useRouter } from 'next/navigation';
import { getBrowserSupabase } from '@/lib/supabase/client';

export function SignOut() {
  const router = useRouter();

  async function signOut() {
    await getBrowserSupabase().auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <button className="linklike" type="button" onClick={signOut}>
      Sign out
    </button>
  );
}
