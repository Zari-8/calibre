import { useState } from 'react';
import { Crown, Check, Clock, ArrowRight, BarChart3, ShieldCheck } from 'lucide-react';
import PremierBetBanner from '../components/PremierBetBanner.jsx';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    tagline: 'For casual fans and public debate traffic.',
    badge: null,
    cta: 'Get started free',
    ctaStyle: 'outline',
    paymentEnabled: false,
    features: [
      'Basic Rate Battles',
      'Current-season comparisons',
      'Limited player pages',
      'Public debate feed',
    ],
    disabled: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$4.99',
    period: '/month',
    tagline: 'For serious fans and creators.',
    badge: 'MOST POPULAR',
    cta: 'Start Pro',
    ctaStyle: 'lime',
    paymentEnabled: true,
    product: 'pro',
    features: [
      'Everything in Free',
      'GOAT debate tools',
      'Deeper player comparisons',
      'PDF and CSV report exports',
      'Watchlists',
      'Extended history',
      'Advanced filters',
    ],
    disabled: false,
  },
  {
    id: 'scout',
    name: 'Scout',
    price: '$19',
    period: '/month',
    tagline: 'For analysts, scouts and academy staff.',
    badge: 'COMING SOON',
    cta: 'Join waitlist',
    ctaStyle: 'outline',
    paymentEnabled: false,
    features: [
      'Everything in Pro',
      'Youth trajectory data',
      'Career pathway modelling',
      'Larger watchlists',
      'Similar-player finder',
      'Scout notes and exports',
    ],
    disabled: true,
  },
  {
    id: 'club',
    name: 'Club',
    price: '$99',
    period: '/month',
    tagline: 'For clubs, agencies and media teams.',
    badge: 'COMING SOON',
    cta: 'Join waitlist',
    ctaStyle: 'outline',
    paymentEnabled: false,
    features: [
      'Everything in Scout',
      'Team workflows',
      'Higher data limits',
      'Deeper API access',
      'Custom contracts available',
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
        {plan.features.map((feature) => (
          <li key={feature}>
            <Check size={14} />
            {feature}
          </li>
        ))}
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
