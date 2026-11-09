import { RoleSwitcher } from '@/components/role-switcher';
import { getViewer } from '@/lib/data';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const viewer = await getViewer();
  return (
    <section>
      <h1>Sign in</h1>
      <p className="lead">
        Four seeded demo users, one local password. Nothing here is a real account, and the data
        belongs to the invented studio.
      </p>
      {viewer.email ? <p className="muted">Signed in as {viewer.email}.</p> : null}
      <RoleSwitcher />
    </section>
  );
}
