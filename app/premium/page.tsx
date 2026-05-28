import Link from 'next/link';

export default function PremiumPage() {
  return (
    <main className="container section">
      <span className="kicker">Premium</span>
      <h1>The full Calibre engine.</h1>
      <p className="lead">Premium routes to the World Cup Founder Pass for launch. This keeps the curiosity CTA while still making the paid path real.</p>
      <div className="card glow">
        <h2>World Cup Founder Pass</h2>
        <p className="price">$8.99 <span>one-time</span></p>
        <p>90 days of Pro access: player comparisons, system fit, GOAT cards, talent boards and World Cup intelligence.</p>
        <Link href="/pricing" className="cta">Get World Cup Founder Pass</Link>
      </div>
    </main>
  );
}
