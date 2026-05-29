import { Crown, Check, Clock, ArrowRight } from 'lucide-react';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    tagline: 'For casual fans & public debate traffic.',
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
    lemonUrl: 'https://calibrefooty.lemonsqueezy.com/checkout/buy/pro', // replace with real URL
    features: [
      'Everything in Free',
      'GOAT debate tools',
      'Deeper player comparisons',
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
    tagline: 'For analysts, scouts & academy staff.',
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
      'Scout notes & exports',
    ],
    disabled: true,
  },
  {
    id: 'club',
    name: 'Club',
    price: '$99',
    period: '/month',
    tagline: 'For clubs, agencies & media teams.',
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

function PlanCard({ plan }) {
  const isFounder = plan.id === 'pro'; // Founder Pass is the pro CTA on this page

  function handleCta() {
    if (plan.disabled) {
      // Waitlist — could open a modal or mailto in future
      alert('Waitlist coming soon. Drop us your email at hello@calibrefooty.com');
      return;
    }
    if (plan.paymentEnabled && plan.lemonUrl) {
      window.open(plan.lemonUrl, '_blank', 'noopener');
    }
  }

  return (
    <div className={`pricing-card ${plan.badge === 'MOST POPULAR' ? 'pricing-card--featured' : ''} ${plan.disabled ? 'pricing-card--disabled' : ''}`}>
      {plan.badge && (
        <div className={`pricing-badge ${plan.badge === 'MOST POPULAR' ? 'pricing-badge--hot' : 'pricing-badge--soon'}`}>
          {plan.badge === 'COMING SOON' && <Clock size={11} style={{marginRight:4}}/>}
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
        {plan.features.map(f => (
          <li key={f}><Check size={14} />{f}</li>
        ))}
      </ul>

      <button
        type="button"
        className={`pricing-cta pricing-cta--${plan.ctaStyle} ${plan.disabled ? 'pricing-cta--waitlist' : ''}`}
        onClick={handleCta}
      >
        {plan.id === 'free' ? 'Get started free' : plan.cta}
        {!plan.disabled && <ArrowRight size={14}/>}
      </button>
    </div>
  );
}

export default function Pricing() {
  return (
    <div className="page pricing-page">
      {/* Header */}
      <div className="pricing-header">
        <Crown size={32} className="pricing-crown" />
        <h1>Get World Cup Founder Pass</h1>
        <p>
          Lock in Pro access for 90 days — one payment, no subscription.
          Launches with the World Cup. Limited availability.
        </p>
      </div>

      {/* Founder Pass hero card */}
      <div className="founder-pass-hero">
        <div className="founder-pass-inner">
          <div className="founder-pass-left">
            <Crown size={40} />
            <div>
              <strong>World Cup Founder Pass</strong>
              <span>90 days of Pro access · One-time payment · Never charged again</span>
            </div>
          </div>
          <div className="founder-pass-right">
            <div className="founder-price">$8.99</div>
            <button
              type="button"
              className="founder-pass-cta"
              onClick={() => window.open('https://calibrefooty.lemonsqueezy.com/checkout/buy/founder-pass', '_blank', 'noopener')}
            >
              Get World Cup Founder Pass <ArrowRight size={16}/>
            </button>
          </div>
        </div>
        <p className="founder-pass-note">
          Includes all Pro features · Supporter pricing · Helps us build Calibre · No auto-renewal
        </p>
      </div>

      {/* Plan grid */}
      <div className="pricing-grid">
        {PLANS.map(plan => <PlanCard key={plan.id} plan={plan} />)}
      </div>

      <p className="pricing-footer">
        All plans include access to current-season data. Paid plans powered by Lemon Squeezy — cancel anytime.
        Questions? <a href="mailto:hello@calibrefooty.com">hello@calibrefooty.com</a>
      </p>
    </div>
  );
}
