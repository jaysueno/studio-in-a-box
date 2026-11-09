import Link from 'next/link';

export function NotAllowed({ detail }: { detail: string }) {
  return (
    <section className="card">
      <h1>Not allowed</h1>
      <p className="lead">{detail}</p>
      <p>
        <Link className="btn" href="/me">
          Go to your page
        </Link>
      </p>
    </section>
  );
}
