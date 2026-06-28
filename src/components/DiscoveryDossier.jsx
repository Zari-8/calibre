// ─────────────────────────────────────────────────────────────────────────────
// DiscoveryDossier — the commissioned brief for a developmental talent.
//
// The Talents-side counterpart to Dossier (which is the established-player Deal
// Dossier). Where the Deal Dossier answers "is this move good value?", this
// answers "should we bet on a player nobody's watching?" — ceiling, trajectory,
// pathway and the risk of stalling, fused with the value spine.
//
// STEP 3 (auto-assembly): the quantitative spine — Calibre signal, ceiling band,
// value, opportunity cost — is computed from the talent's existing engine data.
// The judgment sections (verdict, pathway read, risk read) are surfaced as
// labelled prompts for the human layer rather than faked.
//
// STEP 4 (delivery, buildable half): every page carries a diagonal watermark of
// the recipient's identity + the commission id. The owner (founder) generates it
// directly with no payment — the payment-gated external delivery page is the only
// part still waiting on ContiPay.
//
// Rendering: a full-screen, print-optimised overlay (Save as PDF) so it doubles
// as the delivered artifact, exactly like Dossier.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect } from 'react';
import { calibreValue } from '../services/calibreValue.js';

const LIME = '#c8ff00';
const INK = '#0a0a0a';
const BC = "'Barlow Condensed', sans-serif";

const num = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
const usd = (v) => (v == null ? '—' : `$${Math.round(Number(v))}M`);
const usd1 = (v) => (v == null ? '—' : `$${Math.round(Number(v) * 10) / 10}M`);

function Eyebrow({ children }) {
  return <div style={{ fontFamily: BC, fontSize: 10, letterSpacing: '0.22em', color: '#666', textTransform: 'uppercase', marginBottom: 10 }}>{children}</div>;
}
function SectionTitle({ n, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, borderBottom: '1px solid #1c1c1c', paddingBottom: 10, marginBottom: 18 }}>
      <span style={{ fontFamily: BC, fontSize: 12, fontWeight: 800, color: LIME, letterSpacing: '0.1em' }}>{n}</span>
      <h2 style={{ fontFamily: BC, fontSize: 22, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.02em', margin: 0 }}>{children}</h2>
    </div>
  );
}
function Stat({ label, value, color = '#fff' }) {
  return (
    <div style={{ background: '#0a0a0a', border: '1px solid #1c1c1c', padding: '12px 14px' }}>
      <div style={{ fontFamily: BC, fontSize: 9, letterSpacing: '0.12em', color: '#555', textTransform: 'uppercase', marginBottom: 5 }}>{label}</div>
      <div style={{ fontFamily: BC, fontSize: 24, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}
function HumanPrompt({ children }) {
  return (
    <div style={{ background: 'rgba(200,255,0,0.04)', border: '1px dashed #2c3a00', borderRadius: 6, padding: '12px 14px', color: '#9aa77a', fontSize: 13, lineHeight: 1.6 }}>
      <span style={{ fontFamily: BC, fontSize: 9, letterSpacing: '0.14em', color: LIME, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Analyst layer — written per commission</span>
      {children}
    </div>
  );
}

// Diagonal repeated watermark across the whole page.
function Watermark({ mark }) {
  if (!mark) return null;
  const rows = Array.from({ length: 9 });
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0, opacity: 0.05 }}>
      {rows.map((_, r) => (
        <div key={r} style={{ position: 'absolute', top: `${r * 12 - 6}%`, left: '-10%', right: '-10%', transform: 'rotate(-24deg)', whiteSpace: 'nowrap', fontFamily: BC, fontSize: 30, fontWeight: 800, letterSpacing: '0.3em', color: '#fff', textTransform: 'uppercase' }}>
          {`${mark}   `.repeat(8)}
        </div>
      ))}
    </div>
  );
}

export default function DiscoveryDossier({ player, buyerKind = 'club', recipient, commissionId, comparables = [], onClose }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose?.(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  if (!player) return null;

  const isAgent = buyerKind === 'agent';
  const name = player.full_name || player.name || 'Talent';
  const rating = num(player.rating);
  const ceiling = num(player.potential) ?? (rating != null ? Math.min(94, rating + (player.trajectory === 'rising' ? 7 : 3)) : null);
  const headroom = rating != null && ceiling != null ? Math.max(0, Math.round(ceiling - rating)) : null;
  const age = num(player.age);
  const position = player.position || player.pos || player.role || '—';

  // Value spine (current + projected-at-ceiling), guarded for thin talent data.
  let curVal = null, ceilVal = null;
  try { curVal = calibreValue({ rating, age, position, minutes: num(player.minutes) })?.estimatedValue ?? null; } catch { curVal = null; }
  try { ceilVal = ceiling != null ? (calibreValue({ rating: ceiling, age: age != null ? age + 3 : null, position })?.estimatedValue ?? null) : null; } catch { ceilVal = null; }

  const mark = recipient ? recipient.toUpperCase() : 'CALIBRE · PREVIEW';
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const page = { position: 'relative', maxWidth: 880, margin: '0 auto', background: '#070708', color: '#e8e8e8', padding: '0 0 60px' };
  const body = { position: 'relative', zIndex: 1, padding: '0 40px' };
  const section = { marginBottom: 34 };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9500, background: 'rgba(0,0,0,0.92)', overflowY: 'auto', padding: '24px 0 60px' }}>
      <div style={{ maxWidth: 880, margin: '0 auto 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 40px' }}>
        <button onClick={onClose} style={{ background: 'transparent', color: '#9a9a9a', border: '1px solid #2a2a2a', padding: '7px 14px', fontFamily: BC, fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: 6 }}>← Close</button>
        <button onClick={() => window.print()} style={{ background: LIME, color: INK, border: 'none', padding: '8px 16px', fontFamily: BC, fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: 6 }}>↓ Save as PDF</button>
      </div>

      <div style={page}>
        <Watermark mark={mark} />

        {/* Cover */}
        <div style={{ position: 'relative', zIndex: 1, padding: '36px 40px 26px', borderBottom: `3px solid ${LIME}`, background: 'linear-gradient(180deg, #0c0d0a, #070708)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontFamily: BC, fontSize: 11, letterSpacing: '0.2em', color: LIME, textTransform: 'uppercase' }}>Calibre Discovery Dossier</div>
              <h1 style={{ fontFamily: BC, fontSize: 46, fontWeight: 800, textTransform: 'uppercase', margin: '6px 0 4px', lineHeight: 0.98 }}>{name}</h1>
              <div style={{ color: '#9a9a9a', fontSize: 14 }}>{[position, player.club, age != null ? `${age} yrs` : null, player.nation].filter(Boolean).join('  ·  ')}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: BC, fontSize: 44, fontWeight: 800, color: LIME, lineHeight: 1 }}>{rating ?? '—'}</div>
              <div style={{ fontFamily: BC, fontSize: 10, letterSpacing: '0.12em', color: '#666', textTransform: 'uppercase' }}>Calibre rating</div>
              <div style={{ fontFamily: BC, fontSize: 11, letterSpacing: '0.12em', color: '#9a9a9a', textTransform: 'uppercase', marginTop: 12 }}>{isAgent ? 'Prepared for an agent' : 'Prepared for a club'}</div>
            </div>
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap', fontFamily: BC, fontSize: 10, letterSpacing: '0.1em', color: '#555', textTransform: 'uppercase' }}>
            <span>{today}</span><span>·</span><span>{commissionId ? `Ref ${commissionId}` : 'Preview draft'}</span><span>·</span><span>Confidential — {mark}</span>
          </div>
        </div>

        <div style={{ ...body, paddingTop: 30 }}>
          {/* 1 — Executive verdict */}
          <div style={section}>
            <Eyebrow>Section 01</Eyebrow>
            <SectionTitle n="01">Executive verdict</SectionTitle>
            <HumanPrompt>
              {isAgent
                ? `One-paragraph pitch: the tier of club ${name} fits now and in three years, the headline ceiling, and the single most compelling reason a sporting director should move. Lead with conviction.`
                : `One-paragraph call: Sign / Monitor / Pass, with conviction level and the fee ceiling. Lead with the bet in plain terms — what you are buying and at what risk.`}
            </HumanPrompt>
          </div>

          {/* 2 — The opportunity (asymmetry) */}
          <div style={section}>
            <SectionTitle n="02">The opportunity</SectionTitle>
            <p style={{ color: '#bbb', fontSize: 14, lineHeight: 1.7, margin: '0 0 12px' }}>
              {name} sits below the radar of conventional scouting networks. The value of this dossier is the information gap: most clubs have no coverage of {player.league || player.club || 'this market'}, no data depth, and no read. Calibre does.
            </p>
            <HumanPrompt>Sharpen the asymmetry: <i>why</i> is he invisible (no scouts in the market, weak-division stats, no vendor coverage), and what does Calibre see that others don&apos;t?</HumanPrompt>
          </div>

          {/* 3 — Calibre signal */}
          <div style={section}>
            <SectionTitle n="03">Calibre signal</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 8 }}>
              <Stat label="Calibre rating" value={rating ?? '—'} color={LIME} />
              <Stat label="Archetype / role" value={player.archetype || player.role || position} />
              <Stat label="Age" value={age ?? '—'} />
              <Stat label="Trajectory" value={(player.trajectory || 'rising').toString().replace(/^\w/, c => c.toUpperCase())} />
            </div>
            <p style={{ color: '#888', fontSize: 12, lineHeight: 1.6, margin: 0 }}>Computed from the shared engine on the player&apos;s current-season data. Where stat depth is thin (common for under-covered leagues), the rating is interim and the analyst note flags it.</p>
          </div>

          {/* 4 — Development projection */}
          <div style={section}>
            <SectionTitle n="04">Development projection — the bet</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
              <Stat label="Current rating" value={rating ?? '—'} />
              <Stat label="Projected ceiling" value={ceiling != null ? `${ceiling - 2}–${ceiling}` : '—'} color={LIME} />
              <Stat label="Headroom" value={headroom != null ? `+${headroom}` : '—'} />
            </div>
            <HumanPrompt>Read the curve: realistic time-to-peak, where the headroom actually sits (one elite trait vs all-round growth), and the honest probability he reaches the band rather than stalling below it.</HumanPrompt>
          </div>

          {/* 5 — Pathway */}
          <div style={section}>
            <SectionTitle n="05">Pathway</SectionTitle>
            <HumanPrompt>
              {isAgent
                ? `The realistic ladder: the tier of club to target now, the step after, and the comparable trajectory to cite. Name the clubs, in order, with the rationale.`
                : `The realistic next step for this player — the level he slots into now vs in 2–3 years, where he fits your structure, and the comparable path a similar profile took. Avoid the direct-to-top-five fantasy unless the data supports it.`}
            </HumanPrompt>
          </div>

          {/* 6 — Comparable profiles (real DB comparables) */}
          <div style={section}>
            <SectionTitle n="06">Comparable profiles</SectionTitle>
            {comparables && comparables.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                {comparables.map((c, i) => (
                  <div key={c.name || i} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#0a0a0a', border: '1px solid #1c1c1c', padding: '10px 14px' }}>
                    <span style={{ fontFamily: BC, fontWeight: 800, color: '#555', width: 22 }}>{String(i + 1).padStart(2, '0')}</span>
                    <span style={{ flex: 1, minWidth: 0 }}><strong style={{ color: '#fff' }}>{c.name}</strong><span style={{ color: '#888', fontSize: 12 }}>{'  \u00b7  '}{[c.position || c.role, c.club, c.age != null ? `${c.age}y` : null].filter(Boolean).join(' \u00b7 ')}</span></span>
                    <span style={{ fontFamily: BC, fontWeight: 800, color: LIME }}>{num(c.rating) ?? '\u2014'}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: '#888', fontSize: 13, lineHeight: 1.6 }}>No close comparables in the current talent index for this profile.</p>
            )}
            <HumanPrompt>The outcome read: of these like-profiled players, who kicked on and who stalled \u2014 the honest base rate the engine surfaces but only judgment interprets.</HumanPrompt>
          </div>

          {/* 7 — Value & opportunity cost */}
          <div style={section}>
            <SectionTitle n="07">Value &amp; opportunity cost</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
              <Stat label="Calibre value (now)" value={usd1(curVal)} />
              <Stat label="Projected at ceiling" value={usd(ceilVal)} color={LIME} />
              <Stat label="Upside multiple" value={curVal && ceilVal ? `${(ceilVal / curVal).toFixed(1)}×` : '—'} />
            </div>
            <p style={{ color: '#bbb', fontSize: 14, lineHeight: 1.7, margin: 0 }}>
              The bet is the gap between today&apos;s negligible cost and the value if the trajectory holds. The cost of passing is the same player acquired later, at a multiple, by someone who moved first.
            </p>
          </div>

          {/* 7 — Risk profile */}
          <div style={section}>
            <SectionTitle n="08">Risk profile</SectionTitle>
            <HumanPrompt>The honest downside: the league step-up, end-product against organised defences, role dependence, minutes/availability, temperament. What would make this projection wrong?</HumanPrompt>
          </div>

          {/* 8 — Judgment */}
          <div style={section}>
            <SectionTitle n="09">The judgment</SectionTitle>
            <HumanPrompt>
              The read between the numbers — the recommendation in {isAgent ? 'an agent\u2019s' : 'a club\u2019s'} voice, the conditions under which the bet works, and the one sentence a {isAgent ? 'sporting director should remember' : 'board should hear'}. This is the part the engine cannot write.
            </HumanPrompt>
          </div>

          <div style={{ borderTop: '1px solid #1c1c1c', paddingTop: 16, marginTop: 8, color: '#555', fontSize: 11, lineHeight: 1.6 }}>
            Calibre Discovery Dossier · {mark} · {today}. Engine-assembled spine with a written analyst layer. Quantitative outputs derive from available data and are projections, not guarantees. Confidential to the named recipient.
          </div>
        </div>
      </div>
    </div>
  );
}
