import { useState } from 'react';
import { Crown, Check, Clock, ArrowRight, BarChart3, ShieldCheck, FileText } from 'lucide-react';
import PremierBetBanner from '../components/PremierBetBanner.jsx';
import { navigateTo } from '../components/NavLink.jsx';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    tagline: 'For fans and first-time scouts.',
    badge: null,
    cta: 'Get started free',
    ctaStyle: 'outline',
    paymentEnabled: false,
    features: [
      'Player database + Calibre ratings',
      'Transfer verdict + Calibre Value',
      'Basic System Fit score',
      'Rate Battles + GOAT vote (always free)',
      'Public debate feed',
    ],
    disabled: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$4.99',
    period: '/month',
    tagline: 'For serious fans, creators and analysts.',
    badge: 'MOST POPULAR',
    cta: 'Start Pro',
    ctaStyle: 'lime',
    paymentEnabled: true,
    product: 'pro',
    features: [
      'Everything in Free',
      'Full valuation breakdown — fair range, max bid, premium, age curve',
      'Unlimited analyses',
      'Watchlists',
      'Advanced filters',
      'Player comparison exports (PDF/CSV)',
      'Extended history',
    ],
    disabled: false,
  },
  {
    id: 'scout',
    name: 'Scout',
    price: '$19',
    period: '/month',
    tagline: 'For analysts, scouts and content creators.',
    badge: 'COMING SOON',
    cta: 'Join waitlist',
    ctaStyle: 'outline',
    paymentEnabled: false,
    features: [
      'Everything in Pro',
      'Full System Fit desk — breakdown, role radar, best-fit ranking',
      'Compare two live players',
      'Comparables / similar-player finder',
      'Deal Report PDF',
      'System Fit exports (PDF/CSV)',
      { text: 'Youth trajectory data', soon: true },
      { text: 'Career pathway modelling', soon: true },
    ],
    disabled: true,
  },
  {
    id: 'club',
    name: 'Club',
    price: '$99',
    period: '/month',
    tagline: 'For clubs, agencies and recruitment desks.',
    badge: 'COMING SOON',
    cta: 'Contact us',
    ctaStyle: 'outline',
    paymentEnabled: false,
    features: [
      'Everything in Scout',
      { text: 'Team seats & shared shortlists', soon: true },
      { text: 'Collaborative recruitment board', soon: true },
      { text: 'Higher data limits', soon: true },
      { text: 'API access', soon: true },
      'Custom contracts — talk to us',
    ],
    disabled: true,
  },
];

async function startCheckout(product, setLoading) {
  try {
    setLoading(product);

    const response = await fetch('/api/contipay-create-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product }),
    });

    const data = await response.json();

    if (!response.ok || !data.checkoutUrl) {
      throw new Error(data.error || 'Checkout is not available yet.');
    }

    window.location.href = data.checkoutUrl;
  } catch (error) {
    window.alert(
      error.message ||
      'Checkout setup is still in progress. Please try again shortly.'
    );
  } finally {
    setLoading(null);
  }
}

function PlanCard({ plan, loading, setLoading }) {
  function handleCta() {
    if (plan.disabled) {
      window.alert(
        'Waitlist coming soon. Drop us your email at team@calibrefootball.com'
      );
      return;
    }

    if (plan.paymentEnabled && plan.product) {
      startCheckout(plan.product, setLoading);
    }
  }

  return (
    <div
      className={`pricing-card ${
        plan.badge === 'MOST POPULAR' ? 'pricing-card--featured' : ''
      } ${plan.disabled ? 'pricing-card--disabled' : ''}`}
    >
      {plan.badge && (
        <div
          className={`pricing-badge ${
            plan.badge === 'MOST POPULAR'
              ? 'pricing-badge--hot'
              : 'pricing-badge--soon'
          }`}
        >
          {plan.badge === 'COMING SOON' && (
            <Clock size={11} style={{ marginRight: 4 }} />
          )}
          {plan.badge}
        </div>
      )}

      <div className="pricing-name">{plan.name}</div>

      <div className="pricing-price">
        <span className="pricing-amount">{plan.price}</span>
        <span className="pricing-period">{plan.period}</span>
      </div>

      <p className="pricing-tagline">{plan.tagline}</p>

      <ul className="pricing-features">
        {plan.features.map((feature) => {
          const text = typeof feature === 'object' ? feature.text : feature;
          const soon = typeof feature === 'object' && feature.soon;
          return (
          <li key={text} style={soon ? { opacity: 0.5 } : undefined}>
            {soon ? <Clock size={14} /> : <Check size={14} />}
            {text}{soon && <span style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#888', marginLeft: 6 }}>soon</span>}
          </li>
          );
        })}
      </ul>

      <button
        type="button"
        className={`pricing-cta pricing-cta--${plan.ctaStyle} ${
          plan.disabled ? 'pricing-cta--waitlist' : ''
        }`}
        onClick={handleCta}
        disabled={loading === plan.product}
      >
        {loading === plan.product
          ? 'Opening checkout...'
          : plan.id === 'free'
            ? 'Get started free'
            : plan.cta}

        {!plan.disabled && <ArrowRight size={14} />}
      </button>
    </div>
  );
}

export default function Pricing() {
  const [loading, setLoading] = useState(null);

  return (
    <div className="page pricing-page">
      <div className="pricing-header">
        <Crown size={32} className="pricing-crown" />
        <h1>Get World Cup Founder Pass</h1>
        <p>
          Lock in Pro access for the full World Cup period — one payment, no
          subscription. Launches with the World Cup. Limited availability.
        </p>
      </div>

      <div className="founder-pass-hero">
        <div className="founder-pass-inner">
          <div className="founder-pass-left">
            <Crown size={40} />
            <div>
              <strong>World Cup Founder Pass</strong>
              <span>
                2 months of Pro access · One-time payment · Never charged again
              </span>
            </div>
          </div>

          <div className="founder-pass-right">
            <div className="founder-price">$8.99</div>

            <button
              type="button"
              className="founder-pass-cta"
              onClick={() => startCheckout('founder-pass', setLoading)}
              disabled={loading === 'founder-pass'}
            >
              {loading === 'founder-pass'
                ? 'Opening checkout...'
                : 'Get World Cup Founder Pass'}

              <ArrowRight size={16} />
            </button>
          </div>
        </div>

        <p className="founder-pass-note">
          Includes all Pro features · Supporter pricing · Helps us build Calibre
          · No auto-renewal
        </p>
      </div>

      <div className="pricing-grid">
        {PLANS.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            loading={loading}
            setLoading={setLoading}
          />
        ))}
      </div>

      <section className="dossier-addon" style={{ margin: '8px 0 4px', background: 'linear-gradient(180deg,#0c0d0a,#0a0a0a)', border: '1px solid #1c1c1c', borderLeft: '3px solid #c8ff00', borderRadius: 10, padding: '20px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          <FileText size={26} color="#c8ff00" style={{ flexShrink: 0 }} />
          <div>
            <strong style={{ display: 'block', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 800, textTransform: 'uppercase', color: '#fff' }}>Commission a Dossier — $499</strong>
            <span style={{ color: '#9a9a9a', fontSize: 13, lineHeight: 1.5 }}>A decision-grade scouting brief on any player or talent — the 40-point Director-of-Football framework, or the development-tuned Discovery Dossier for an under-the-radar prospect. One-time, delivered as a watermarked PDF.</span>
          </div>
        </div>
        <button type="button" onClick={() => navigateTo('/talents')} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'transparent', color: '#c8ff00', border: '1px solid #c8ff00', borderRadius: 6, padding: '10px 18px', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>Explore on Talents <ArrowRight size={13} /></button>
      </section>

      <PremierBetBanner source="pricing" variant="card" />

      <section
        className="market-insights-mini"
        aria-label="Optional betting-market intelligence"
      >
        <div className="market-insights-mini__icon">
          <BarChart3 size={17} />
        </div>

        <div className="market-insights-mini__copy">
          <strong>Optional betting-market intelligence</strong>
          <span>
            Small add-on lane for match probability, xG movement and
            goals-market context. Kept separate from the core football product.
          </span>
        </div>

        <div className="market-insights-mini__tags">
          <span>Match probability</span>
          <span>Goals outlook</span>
          <span>BTTS context</span>
          <span>Partner odds</span>
        </div>

        <div className="market-insights-mini__status">
          <ShieldCheck size={14} />
          <span>Coming with official partner · 18+</span>
        </div>
      </section>

      <p className="pricing-footer">
        All plans include access to current-season data. Secure payments
        processed through ContiPay. Questions?{' '}
        <a href="mailto:team@calibrefootball.com">
          team@calibrefootball.com
        </a>
      </p>
    </div>
  );
}
