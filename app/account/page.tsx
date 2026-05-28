ßimport Link from 'next/link';

type AccountPageProps = {
  searchParams?: Promise<{ upgraded?: string }>;
};

export default async function AccountPage({ searchParams }: AccountPageProps) {
  const params = await searchParams;
  const upgraded = params?.upgraded === 'true';

  return (
    <main className="container section">
      <span className="kicker">Account</span>
      <h1>{upgraded ? 'Founder Pass received.' : 'Your Calibre account.'}</h1>
      <p className="lead">
        {upgraded
          ? 'Payment succeeded. Once Supabase auth is connected, this page will show your Pro expiry and founder badge.'
          : 'Sign-in/auth wiring belongs here once Supabase Auth is connected.'}
      </p>

      <div className="card glow">
        <h2>Founder Status</h2>
        <p className="muted">
          V7 includes the entitlement table and webhook route. Add Supabase keys to make this page read live user access.
        </p>
        <Link href="/players" className="cta">
          Use Calibre
        </Link>
      </div>
    </main>
  );
}
