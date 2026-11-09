import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { Nav } from '@/components/nav';
import { getViewer } from '@/lib/data';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Cedarline Studio',
  description: 'A slice of studio software: bookings, credits, the cash close and roles.',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const viewer = await getViewer();
  return (
    <html lang="en">
      <body>
        <Nav viewer={viewer} />
        <main className="wrap">{children}</main>
      </body>
    </html>
  );
}
