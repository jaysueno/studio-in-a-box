'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null = null;

// The browser client uses the anon key and the signed-in user's session. It never sees a
// service-role key.
export function getBrowserSupabase(): SupabaseClient {
  if (browserClient) return browserClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('The local Supabase environment is missing. Run pnpm env:local.');
  }
  browserClient = createBrowserClient(url, key);
  return browserClient;
}
