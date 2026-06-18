import { useState } from 'react';
import { navigateTo } from '../components/NavLink.jsx';

const LAST_UPDATED = 'June 18, 2026';
const CONTACT_EMAIL = 'team@calibrefootball.com';
const SITE_URL = 'calibrefootball.com';

const SECTIONS = [
  {
    id: 'acceptance',
    title: '1. Acceptance of Terms',
    content: `By accessing or using Calibre Football Intelligence ("Calibre", "we", "us", "our") at ${SITE_URL}, you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not use the platform.

These Terms apply to all users of Calibre, including visitors, registered users, and subscribers to paid plans. We reserve the right to update these Terms at any time. Continued use of the platform after changes constitutes acceptance of the updated Terms.`,
  },
  {
    id: 'description',
    title: '2. Description of Service',
    content: `Calibre is a football intelligence and analytics platform that provides:

• Player ratings, statistics, and performance analysis powered by the Calibre rating engine
• System Fit analysis comparing player profiles to tactical systems
• Transfer Intelligence tools including deal valuation and fair price modelling
• World Cup and competition coverage with editorial intelligence
• Community debate features, forums, and voting tools
• Optional subscription plans (Free, Pro, Scout, Club) with varying feature access
• Affiliate links to third-party betting platforms (PremierBet Zimbabwe)

All ratings, verdicts, valuations, and analysis produced by Calibre are editorial and informational in nature. They do not constitute financial, sporting, scouting, or investment advice.`,
  },
  {
    id: 'accounts',
    title: '3. User Accounts',
    content: `To access certain features you must create an account. You agree to:

• Provide accurate, current, and complete information during registration
• Maintain the security of your password and account credentials
• Notify us immediately of any unauthorised access to your account
• Accept responsibility for all activity that occurs under your account

We reserve the right to suspend or terminate accounts that violate these Terms, engage in abusive behaviour, or attempt to manipulate platform data or voting systems.

You must be at least 18 years of age to create an account and access paid features.`,
  },
  {
    id: 'subscriptions',
    title: '4. Subscriptions and Payments',
    content: `Calibre offers paid subscription plans processed through ContiPay. By subscribing you agree to:

• Pay all fees associated with your chosen plan at the rates listed at the time of purchase
• Provide valid payment information and authorise recurring charges where applicable
• Understand that subscription fees are non-refundable except where required by applicable law

The World Cup Founder Pass is a one-time payment that grants Pro access for the specified period and does not auto-renew. We reserve the right to modify pricing with reasonable notice. Your continued subscription after a price change constitutes acceptance of the new rate.

Free plan users may access Calibre with limitations as described on the Pricing page. We reserve the right to change the features available on the Free plan at any time.`,
  },
  {
    id: 'data',
    title: '5. Data Sources and Accuracy',
    content: `Calibre aggregates and processes data from multiple third-party sources including:

• API-Football — for player statistics, club data, and match results
• TheStatsAPI — for advanced event statistics including big chances, duel profiles, and territorial metrics
• StatsBomb Open Data — for tournament-level event data (used under CC BY-SA 4.0)
• Transfermarkt — for player market valuations referenced in Transfer Intelligence features
• Editorial and community contributions

While we make reasonable efforts to ensure accuracy, Calibre does not warrant that any data, rating, valuation, or analysis is error-free, complete, or current. Player ratings and transfer valuations are computed outputs of the Calibre rating engine and represent editorial assessments, not definitive facts.

Third-party data is subject to those providers' own terms and accuracy limitations. Calibre accepts no liability for decisions made based on information presented on the platform.`,
  },
  {
    id: 'intellectual-property',
    title: '6. Intellectual Property',
    content: `All content on Calibre, including but not limited to the Calibre rating engine, System Fit methodology, Transfer Intelligence algorithms, design, text, graphics, and software, is the property of Calibre Football Intelligence and is protected by applicable intellectual property laws.

You are granted a limited, non-exclusive, non-transferable licence to access and use the platform for personal, non-commercial purposes only.

You may not:
• Copy, reproduce, or redistribute any content from Calibre without express written permission
• Use Calibre data or ratings in commercial products or services
• Reverse engineer, scrape, or otherwise extract data from the platform at scale
• Use automated tools to access Calibre without prior written agreement

StatsBomb Open Data used on this platform is licensed under Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0). See statsbomb.com for details.`,
  },
  {
    id: 'betting',
    title: '7. Betting Partner and Affiliate Links',
    content: `Calibre has a commercial relationship with PremierBet Zimbabwe as an affiliate partner. We may receive commission when users register with PremierBet using our affiliate links or promotional code (ZW392).

You acknowledge that:
• Calibre's ratings and analysis are independent editorial products and are NOT influenced by our affiliate relationship
• Betting involves financial risk and is not suitable for all users
• You must be 18 years or older to use betting services
• Calibre does not provide betting tips, odds advice, or gambling recommendations
• Any decision to use PremierBet or any other betting platform is made entirely at your own risk

Calibre is not responsible for any losses incurred through the use of affiliated betting services. If you have concerns about problem gambling, please contact the National Responsible Gambling Programme or visit begambleaware.org.`,
  },
  {
    id: 'community',
    title: '8. Community and User Content',
    content: `Calibre provides community features including debate forums, voting tools, and nomination submissions. By participating you agree not to:

• Post content that is defamatory, abusive, threatening, or discriminatory
• Attempt to manipulate vote counts or community metrics
• Post spam, promotional content, or off-topic material
• Impersonate any person or entity
• Post content that infringes third-party intellectual property rights

We reserve the right to remove any user-generated content at our discretion and to suspend or ban users who repeatedly violate community standards. We do not endorse any user-submitted content and accept no liability for it.`,
  },
  {
    id: 'privacy',
    title: '9. Privacy and Data Protection',
    content: `Your use of Calibre is subject to our Privacy Policy, which governs how we collect, use, and protect your personal data. By using Calibre you consent to data practices described in our Privacy Policy.

We use Supabase as our database and authentication provider. Authentication data is processed in accordance with Supabase's privacy practices. Payment data is processed by ContiPay and is not stored by Calibre.

We do not sell your personal data to third parties. We may share anonymised, aggregated usage data for product improvement purposes.`,
  },
  {
    id: 'disclaimers',
    title: '10. Disclaimers and Limitation of Liability',
    content: `Calibre is provided "as is" and "as available" without warranty of any kind, express or implied. We do not warrant that:

• The platform will be available at all times or free from errors
• Any rating, valuation, or analysis will be accurate or suitable for any particular purpose
• Results from using Transfer Intelligence, System Fit, or any other feature will meet your expectations

To the fullest extent permitted by applicable law, Calibre shall not be liable for any indirect, incidental, consequential, or punitive damages arising from your use of the platform, including but not limited to lost profits, data loss, or reputational harm.

Our total liability to you for any claim arising from these Terms or your use of Calibre shall not exceed the amount you paid to Calibre in the twelve months preceding the claim.`,
  },
  {
    id: 'termination',
    title: '11. Termination',
    content: `We reserve the right to suspend or terminate your access to Calibre at any time, with or without cause or notice, including for violation of these Terms.

Upon termination, your right to use the platform ceases immediately. Provisions of these Terms that by their nature should survive termination will survive, including intellectual property rights, disclaimers, and limitations of liability.

You may cancel your account at any time by contacting us at ${CONTACT_EMAIL}.`,
  },
  {
    id: 'governing-law',
    title: '12. Governing Law',
    content: `These Terms shall be governed by and construed in accordance with the laws of England and Wales. Any disputes arising from these Terms or your use of Calibre shall be subject to the non-exclusive jurisdiction of the courts of England and Wales.

We operate internationally and make no representation that Calibre is appropriate or available in all locations. Users access the platform at their own initiative and are responsible for compliance with local laws.

If any provision of these Terms is found to be unenforceable, the remaining provisions shall continue in full force and effect.`,
  },
  {
    id: 'contact',
    title: '13. Contact',
    content: `For questions about these Terms, please contact us at:

Email: ${CONTACT_EMAIL}
Platform: ${SITE_URL}

We aim to respond to all enquiries within 5 business days.`,
  },
];

export default function Terms() {
  const [active, setActive] = useState(null);

  return (
    <div style={page}>
      {/* Header */}
      <div style={header}>
        <div style={headerInner}>
          <div>
            <span style={eyebrow}>Legal</span>
            <h1 style={headline}>Terms of Service</h1>
            <p style={sub}>Last updated: {LAST_UPDATED}</p>
          </div>
          <div style={headerMeta}>
            <div style={metaItem}>
              <span style={metaLabel}>Platform</span>
              <span style={metaVal}>{SITE_URL}</span>
            </div>
            <div style={metaItem}>
              <span style={metaLabel}>Contact</span>
              <span style={metaVal}>{CONTACT_EMAIL}</span>
            </div>
            <div style={metaItem}>
              <span style={metaLabel}>Jurisdiction</span>
              <span style={metaVal}>England & Wales</span>
            </div>
          </div>
        </div>
      </div>

      {/* Intro strip */}
      <div style={introStrip}>
        <div style={introInner}>
          <p style={introText}>
            Please read these Terms carefully before using Calibre Football Intelligence. These Terms form a legally binding agreement between you and Calibre. By using our platform you agree to be bound by them.
          </p>
          <div style={toc}>
            <div style={tocLabel}>Quick navigation</div>
            <div style={tocGrid}>
              {SECTIONS.map(s => (
                <button
                  key={s.id}
                  style={tocLink}
                  onClick={() => {
                    setActive(s.id);
                    document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                >
                  {s.title}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={layout}>
        <div style={main}>
          {SECTIONS.map((s, i) => (
            <div
              key={s.id}
              id={s.id}
              style={{
                ...section,
                borderLeft: active === s.id ? '3px solid #c8ff00' : '3px solid transparent',
              }}
              onClick={() => setActive(s.id)}
            >
              <h2 style={sectionTitle}>{s.title}</h2>
              <div style={sectionBody}>
                {s.content.split('\n\n').map((para, j) => (
                  <p key={j} style={para.startsWith('•') || para.includes('\n•') ? bulletBlock : paragraph}>
                    {para.split('\n').map((line, k) => (
                      <span key={k}>
                        {line.startsWith('•') ? (
                          <span style={bullet}>{line}</span>
                        ) : (
                          line
                        )}
                        {k < para.split('\n').length - 1 && <br />}
                      </span>
                    ))}
                  </p>
                ))}
              </div>
            </div>
          ))}

          {/* Footer note */}
          <div style={footerNote}>
            <div style={footerNoteInner}>
              <span style={footerNoteLabel}>Questions about these Terms?</span>
              <a href={`mailto:${CONTACT_EMAIL}`} style={footerNoteLink}>{CONTACT_EMAIL}</a>
            </div>
            <button style={backBtn} onClick={() => navigateTo('/')}>← Back to Calibre</button>
          </div>
        </div>

        {/* Sticky sidebar */}
        <aside style={sidebar}>
          <div style={sideCard}>
            <div style={sideCardTitle}>On this page</div>
            {SECTIONS.map(s => (
              <button
                key={s.id}
                style={{
                  ...sideLink,
                  color: active === s.id ? '#c8ff00' : '#555',
                  borderLeft: active === s.id ? '2px solid #c8ff00' : '2px solid transparent',
                }}
                onClick={() => {
                  setActive(s.id);
                  document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              >
                {s.title}
              </button>
            ))}
          </div>

          <div style={sideCard}>
            <div style={sideCardTitle}>Related</div>
            <button style={sideRelated} onClick={() => navigateTo('/pricing')}>Pricing & Plans →</button>
            <button style={sideRelated} onClick={() => navigateTo('/bet')}>Betting Partner →</button>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const C = { black: '#0a0a0a', surface: '#0f0f0f', border: '#1c1c1c', lime: '#c8ff00', white: '#fff', muted: '#666', mutedLight: '#999' };
const F = { condensed: "'Barlow Condensed', sans-serif", body: "'Barlow', sans-serif" };

const page = { background: C.black, color: C.white, fontFamily: F.body, paddingBottom: 80 };

const header = { background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '36px 32px 28px' };
const headerInner = { maxWidth: 1000, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 32, flexWrap: 'wrap' };
const eyebrow = { fontFamily: F.condensed, fontSize: 10, letterSpacing: '0.2em', color: C.lime, textTransform: 'uppercase', display: 'block', marginBottom: 8 };
const headline = { fontFamily: F.condensed, fontSize: 48, fontWeight: 800, textTransform: 'uppercase', lineHeight: 1, margin: 0 };
const sub = { fontSize: 12, color: C.muted, marginTop: 8 };
const headerMeta = { display: 'flex', gap: 28, flexWrap: 'wrap' };
const metaItem = { display: 'flex', flexDirection: 'column', gap: 4 };
const metaLabel = { fontSize: 9, letterSpacing: '0.15em', color: C.muted, textTransform: 'uppercase', fontFamily: F.condensed };
const metaVal = { fontFamily: F.condensed, fontSize: 14, fontWeight: 700, color: C.white };

const introStrip = { background: '#0a0a0a', borderBottom: `1px solid ${C.border}`, padding: '20px 32px' };
const introInner = { maxWidth: 1000, margin: '0 auto' };
const introText = { fontSize: 13, color: C.mutedLight, lineHeight: 1.7, marginBottom: 20, maxWidth: 680 };
const toc = {};
const tocLabel = { fontFamily: F.condensed, fontSize: 9, letterSpacing: '0.18em', color: C.muted, textTransform: 'uppercase', marginBottom: 10 };
const tocGrid = { display: 'flex', flexWrap: 'wrap', gap: 6 };
const tocLink = { background: 'none', border: `1px solid ${C.border}`, color: C.muted, fontFamily: F.condensed, fontSize: 11, letterSpacing: '0.05em', padding: '5px 10px', cursor: 'pointer', transition: 'all 0.15s' };

const layout = { maxWidth: 1000, margin: '0 auto', padding: '32px 32px 0', display: 'grid', gridTemplateColumns: '1fr 220px', gap: 40, alignItems: 'start' };
const main = { minWidth: 0 };

const section = {
  padding: '24px 20px',
  marginBottom: 2,
  background: C.surface,
  cursor: 'pointer',
  transition: 'border-color 0.15s',
};
const sectionTitle = { fontFamily: F.condensed, fontSize: 20, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: 14, color: C.white };
const sectionBody = { display: 'flex', flexDirection: 'column', gap: 12 };
const paragraph = { fontSize: 13, color: C.mutedLight, lineHeight: 1.8, margin: 0 };
const bulletBlock = { fontSize: 13, color: C.mutedLight, lineHeight: 1.8, margin: 0 };
const bullet = { display: 'block', paddingLeft: 4 };

const footerNote = { marginTop: 32, padding: '20px', background: C.surface, border: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 };
const footerNoteInner = { display: 'flex', flexDirection: 'column', gap: 4 };
const footerNoteLabel = { fontSize: 12, color: C.muted };
const footerNoteLink = { fontFamily: F.condensed, fontSize: 16, fontWeight: 700, color: C.lime, textDecoration: 'none' };
const backBtn = { background: 'none', border: `1px solid ${C.border}`, color: C.muted, fontFamily: F.condensed, fontSize: 12, letterSpacing: '0.08em', padding: '10px 16px', cursor: 'pointer', transition: 'all 0.15s' };

const sidebar = { position: 'sticky', top: 24, display: 'flex', flexDirection: 'column', gap: 16 };
const sideCard = { background: C.surface, border: `1px solid ${C.border}`, padding: 16 };
const sideCardTitle = { fontFamily: F.condensed, fontSize: 9, letterSpacing: '0.18em', color: C.muted, textTransform: 'uppercase', marginBottom: 12 };
const sideLink = { display: 'block', width: '100%', background: 'none', border: 'none', fontFamily: F.condensed, fontSize: 11, letterSpacing: '0.04em', padding: '6px 8px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', textTransform: 'uppercase' };
const sideRelated = { display: 'block', width: '100%', background: 'none', border: 'none', color: C.muted, fontFamily: F.condensed, fontSize: 12, letterSpacing: '0.05em', padding: '8px 0', cursor: 'pointer', textAlign: 'left', borderBottom: `1px solid ${C.border}` };
