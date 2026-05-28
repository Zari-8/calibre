import { CheckoutButton } from '@/components/CheckoutButton';

export default function PricingPage() {
  return (
    <main className="container section">
      <span className="kicker">Launch Access</span>
      <h1>Get the full Calibre engine for the World Cup runway.</h1>
      <p className="lead">Free users can play. Founder Pass users go deeper.</p>
      <div className="grid grid-3" style={{marginTop:28}}>
        <div className="card">
          <span className="pill">Free</span>
          <h2>Public fan mode</h2>
          <div className="price">$0</div>
          <p className="muted">Limited comparisons, public debates, GOAT frames and open World Cup cards.</p>
          <a className="cta dark" href="/players">Start Free</a>
        </div>
        <div className="card glow">
          <span className="pill">Best launch offer</span>
          <h2>World Cup Founder Pass</h2>
          <div className="price">$8.99</div>
          <p className="muted">One-time payment. 90 days of Pro during the launch period. Advanced comparisons, system fit, World Cup boards and founder status.</p>
          <CheckoutButton />
        </div>
        <div className="card">
          <span className="pill">Later</span>
          <h2>Calibre Pro Monthly</h2>
          <div className="price">$4.99</div>
          <p className="muted">Available after the Founder period. Built for fans who want the engine all season.</p>
          <button className="cta dark">After Founder Period</button>
        </div>
      </div>
    </main>
  );
}
