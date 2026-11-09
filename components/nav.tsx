import Link from 'next/link';
import type { Viewer } from '@/lib/data';
import { SignOut } from './sign-out';

export function Nav({ viewer }: { viewer: Viewer }) {
  return (
    <header className="site-header">
      <div className="site-nav">
        <Link className="brand" href="/">
          Cedarline Studio
        </Link>
        <nav>
          <Link href="/schedule">Schedule</Link>
          <Link href="/me">Me</Link>
          {viewer.role === 'front_desk' || viewer.role === 'owner' ? (
            <>
              <Link href="/desk">Desk</Link>
              <Link href="/close">Close</Link>
            </>
          ) : null}
        </nav>
        <div className="who">
          {viewer.email ? (
            <>
              <span>{viewer.email}</span>
              {viewer.role ? <span className="role">{viewer.role.replace('_', ' ')}</span> : null}
              <SignOut />
            </>
          ) : (
            <Link href="/login">Sign in</Link>
          )}
        </div>
      </div>
    </header>
  );
}
