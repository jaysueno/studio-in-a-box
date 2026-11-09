import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/data';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const viewer = await getViewer();
  if (!viewer.id) redirect('/login');
  if (viewer.member) redirect('/me');
  redirect(viewer.role === 'instructor' ? '/schedule' : '/desk');
}
