import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabase } from './supabase/server';
import { nextDay } from './format';

export type Role = 'owner' | 'front_desk' | 'instructor';

export type Viewer = {
  id: string | null;
  email: string | null;
  role: Role | null;
  member: { id: string; full_name: string; email: string } | null;
};

export const EMPTY_VIEWER: Viewer = { id: null, email: null, role: null, member: null };

export async function getViewer(): Promise<Viewer> {
  const supabase = await createServerSupabase();
  if (!supabase) return EMPTY_VIEWER;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return EMPTY_VIEWER;

  const [staffResult, memberResult] = await Promise.all([
    supabase.from('staff').select('role').eq('id', user.id).maybeSingle(),
    supabase.from('members').select('id, full_name, email').eq('id', user.id).maybeSingle(),
  ]);

  return {
    id: user.id,
    email: user.email ?? null,
    role: ((staffResult.data?.role as Role | undefined) ?? null),
    member: ((memberResult.data as Viewer['member']) ?? null),
  };
}

export async function latestPaymentDay(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase
    .from('payments')
    .select('paid_at')
    .order('paid_at', { ascending: false })
    .limit(1);
  const value = data?.[0]?.paid_at as string | undefined;
  return value ? value.slice(0, 10) : null;
}

export async function cashTotal(supabase: SupabaseClient, day: string): Promise<number> {
  const { data } = await supabase
    .from('payments')
    .select('amount')
    .eq('method', 'cash')
    .gte('paid_at', `${day}T00:00:00Z`)
    .lt('paid_at', `${nextDay(day)}T00:00:00Z`);
  return (data ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
}

export function joinedClass(row: { classes?: unknown }): { name?: string; starts_at?: string } {
  const value = row.classes;
  if (Array.isArray(value)) return (value[0] as { name?: string; starts_at?: string }) ?? {};
  return (value as { name?: string; starts_at?: string }) ?? {};
}

export function isDeskRole(role: Role | null): boolean {
  return role === 'front_desk' || role === 'owner';
}
