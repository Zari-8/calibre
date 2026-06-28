// ─────────────────────────────────────────────────────────────────────────────
// DiscoveryDossier — the commissioned brief for a developmental talent.
//
// The Talents-side counterpart to the Deal Dossier. It answers "should we bet on
// a player nobody's watching?" — ceiling, trajectory, pathway and risk of
// stalling, fused with the value spine.
//
// The quantitative spine (Calibre signal, ceiling band, value, opportunity cost)
// AND the written sections are now auto-drafted from the talent's engine data, so
// the document reads as a finished draft rather than a template of prompts. The
// analyst layer refines this per paid commission; the engine writes the floor.
//
// Print: a dedicated print stylesheet isolates the dossier (so the page behind it
// no longer leaks into the PDF) and flips the palette to dark-text-on-white, so
// the file is readable whether or not the browser prints background graphics.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { calibreValue } from '../services/calibreValue.js';

const LIME = '#c8ff00';
const INK = '#0a0a0a';
const BC = "'Barlow Condensed', sans-serif";

const num = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
const usd = (v) => (v == null ? '\u2014' : `$${Math.round(Number(v))}M`);
const usd1 = (v) => (v == null ? '\u2014' : `$${Math.round(Number(v) * 10) / 10}M`);
const cap = (s) => (s == null ? '' : String(s).replace(/^\w/, (c) => c.toUpperCase()));

const PRINT_CSS = `
@media print {
  @page { margin: 12mm; }
  html, body { background: #fff !important; }
  body > *:not(.dd-overlay) { display: none !important; }
  .dd-overlay { position: static !important; background: #fff !important; overflow: visible !important; padding: 0 !important; }
  .dd-noprint { display: none !important; }
  .dd-doc { max-width: 100% !important; margin: 0 !important; background: #fff !important; box-shadow: none !important; }
  .dd-doc, .dd-doc * { color: #1b1b1b !important; }
  .dd-doc .dd-muted { color: #6a6a6a !important; }
  .dd-doc .dd-accent { color: #5a7d00 !important; }
  .dd-doc .dd-box { background: #fff !important; border-color: #d2d2d2 !important; }
  .dd-doc .dd-cover { background: #fff !important; border-bottom-color: #5a7d00 !important; }
  .dd-doc .dd-rule { border-bottom-color: #d2d2d2 !important; }
  .dd-watermark { opacity: 0.05 !important; }
  .dd-watermark * { color: #5a7d00 !important; }
}
`;

function SectionTitle({ n, children }) {
  return (
    <div className="dd-rule" style={{ display: 'flex', alignItems: 'baseline', gap: 12, borderBottom: '1px solid #1c1c1c', paddingBottom: 10, marginBottom: 16 }}>
      <span className="dd-accent" style={{ fontFamily: BC, fontSize: 12, fontWeight: 800, color: LIME, letterSpacing: '0.1em' }}>{n}</span>
      <h2 style={{ fontFamily: BC, fontSize: 22, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.02em', margin: 0 }}>{children}</h2>
    </div>
  );
}
function Stat({ label, value, accent = false }) {
  return (
    <div className="dd-box" style={{ background: '#0a0a0a', border: '1px solid #1c1c1c', padding: '12px 14px' }}>
      <div className="dd-muted" style={{ fontFamily: BC, fontSize: 9, letterSpacing: '0.12em', color: '#555', textTransform: 'uppercase', marginBottom: 5 }}>{label}</div>
      <div className={accent ? 'dd-accent' : undefined} style={{ fontFamily: BC, fontSize: 24, fontWeight: 800, color: accent ? LIME : '#fff' }}>{value}</div>
    </div>
  );
}
function Para({ children }) {
  return <p style={{ color: '#cfcfcf', fontSize: 14, lineHeight: 1.72, margin: '0 0 10px' }}>{children}</p>;
}
function Watermark({ mark }) {
  if (!mark) return null;
  const rows = Array.from({ length: 9 });
  return (
    <div className="dd-watermark" aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0, opacity: 0.05 }}>
      {rows.map((_, r) => (
        <div key={r} style={{ position: 'absolute', top: `${r * 12 - 6}%`, left: '-10%', right: '-10%', transform: 'rotate(-24deg)', whiteSpace: 'nowrap', fontFamily: BC, fontSize: 30, fontWeight: 800, letterSpacing: '0.3em', color: '#fff', textTransform: 'uppercase' }}>
          {`${mark}   `.repeat(8)}
        </div>
      ))}
    </div>
  );
}

export default function DiscoveryDossier({ player, buyerKind = 'club', recipient, commissionId, comparables = [], onClose }) {
  const [kind, setKind] = useState(buyerKind === 'agent' ? 'agent' : 'club');
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose?.(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  if (!player) return null;

  const isAgent = kind === 'agent';
  const name = player.full_name || player.name || 'This talent';
  const rating = num(player.rating);
  const ceiling = num(player.potential) ?? (rating != null ? Math.min(94, rating + (String(player.trajectory || '').toLowerCase().includes('ris') ? 7 : 3)) : null);
  const headroom = rating != null && ceiling != null ? Math.max(0, Math.round(ceiling - rating)) : null;
  const age = num(player.age);
  const position = player.position || player.pos || player.role || 'this role';
  const arche = player.archetype || player.role || position;
  const club = player.club || null;
  const league = player.league || player.leagueName || player.leagueContext || null;
  const mins = num(player.minutes);
  const trajRaw = (player.trajectory || 'rising').toString();
  const rising = /ris|high|\+/.test(trajRaw.toLowerCase());

  let curVal = null, ceilVal = null;
  try { curVal = calibreValue({ rating, age, position, minutes: mins })?.estimatedValue ?? null; } catch { curVal = null; }
  try { ceilVal = ceiling != null ? (calibreValue({ rating: ceiling, age: age != null ? age + 3 : null, position })?.estimatedValue ?? null) : null; } catch { ceilVal = null; }
  const multiple = curVal && ceilVal ? (ceilVal / curVal) : null;

  const tierFor = (r) => r == null ? 'a competitive Tier-1' : r >= 83 ? 'a Champions-League-level' : r >= 78 ? 'an established Tier-1' : r >= 73 ? 'a mid-table Tier-1' : 'a strong Tier-2';
  const tierNow = tierFor(rating);
  const tierNext = tierFor(ceiling);

  let call, conviction;
  if (headroom != null && headroom >= 6 && rising) { call = isAgent ? 'Priority placement' : 'Sign'; conviction = 'high-conviction'; }
  else if (headroom != null && headroom >= 4) { call = isAgent ? 'Active placement' : 'Sign / monitor'; conviction = 'moderate-conviction'; }
  else { call = 'Monitor'; conviction = 'watching-brief'; }

  const mark = recipient ? recipient.toUpperCase() : 'CALIBRE \u00b7 PREVIEW';
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  // ── Auto-drafted prose ──────────────────────────────────────────────────────
  const verdict = isAgent
    ? `${call} \u2014 ${conviction}. ${name} rates ${rating ?? '\u2014'} now with a projected ceiling of ${ceiling ?? '\u2014'}${headroom != null ? ` (+${headroom} headroom)` : ''} on a ${cap(trajRaw)} curve. He fits ${tierNow} club today with a credible line to ${tierNext} level, and the comparable trajectory below makes him a clean sell to a sporting director. The hook is the asymmetry: he is under-covered, so the club that listens first sets the terms.`
    : `${call} \u2014 ${conviction}. ${name} rates ${rating ?? '\u2014'} today against a projected ceiling of ${ceiling ?? '\u2014'}${headroom != null ? ` (+${headroom} of headroom)` : ''} on a ${cap(trajRaw)} curve. The bet is cheap relative to the upside \u2014 value reads ~${usd1(curVal)} now against ~${usd(ceilVal)} if the curve holds${multiple ? `, roughly ${multiple.toFixed(1)}\u00d7` : ''}. The edge is timing: the wider market has no read on ${league || 'this market'} yet, so the look is worth taking before he is priced.`;

  const opportunity = `${name} sits below the radar of conventional scouting networks. Most clubs carry no coverage of ${league || club || 'this market'}, no data depth, and no independent read \u2014 the value of this brief is precisely that information gap. He is invisible for structural reasons (thin vendor coverage, ${rating != null && rating < 76 ? 'a profile still building its senior sample' : 'a market few desks track'}, no scouts in the room), not because the signal is weak. Calibre rates the underlying production directly, which is what surfaces him here while others have nothing on file.`;

  const projection = `At ${age ?? '\u2014'}, ${name} is ${age != null && age <= 19 ? 'early in his development arc' : age != null && age <= 21 ? 'inside his core development window' : 'in the back half of the U22 window'}. The model carries a ceiling of ${ceiling != null ? `${ceiling - 2}\u2013${ceiling}` : '\u2014'}${headroom != null ? ` \u2014 +${headroom} points of headroom` : ''} on ${mins != null ? `${mins} minutes` : 'the minutes'} logged this season${league ? ` in ${league}` : ''}. The growth looks ${rising ? 'front-loaded: the trajectory arrow is steep, so most of the gain should land inside the next 12\u201318 months provided he holds a role' : 'steady rather than explosive \u2014 gains come through consolidation rather than a leap'}. Honest probability of reaching the band rather than stalling below it sits ${headroom != null && headroom >= 6 ? 'in the strong range, conditional on minutes at the right level' : 'in the moderate range, and hinges on a defined starting role'}.`;

  const pathway = isAgent
    ? `The ladder is straightforward: target ${tierNow} now, position for ${tierNext} on the next contract. Lead the pitch with the headroom and the under-coverage, cite the comparable trajectory below, and frame ${club || 'the current club'} as a stepping stone, not a destination. The window to move is while almost nobody else has a read on him.`
    : `Next step: ${rating != null && rating < 75 ? 'a guaranteed-minutes move \u2014 a strong Tier-2 side or a Tier-1 bottom-half club where he starts every week' : `a defined starting role at ${tierNow} level, not a rotation seat at a bigger name`}. The step after that is ${tierNext}. Avoid the direct-to-top-five jump \u2014 the comparable profiles below took the laddered route, and it is the route the data supports for this profile.`;

  const comparablesNote = comparables.length
    ? `These are the closest-rated ${position} profiles in the live index. ${comparables.length} land in the same band, which makes the ${headroom != null && headroom >= 6 ? 'ceiling ambitious but peer-supported' : 'projection well-anchored to its peers'}. The ones who kicked on share a pattern \u2014 minutes secured at the right tier, early \u2014 and that is the single variable to track from here.`
    : `No profiles sit close enough in the current index to cite as comparables with confidence, which is itself part of the asymmetry: there is little to benchmark him against because few desks are looking.`;

  const value = `The bet is the gap between today's negligible cost and the value if the trajectory holds \u2014 ~${usd1(curVal)} now against ~${usd(ceilVal)} at the projected ceiling${multiple ? `, around ${multiple.toFixed(1)}\u00d7` : ''}. The cost of passing is the same player acquired later, at that multiple, by whoever moved first. For an under-covered profile the asymmetry is at its widest right now and compresses with every match that adds to his visibility.`;

  const risk = `The downside is concrete. ${league ? `The step up from ${league} into a higher-tier environment is the largest unknown \u2014 end-product against organised, well-drilled defences is the one thing the rating cannot yet prove. ` : ''}${mins != null && mins < 1500 ? `At ${mins} senior minutes the sample is still thin. ` : ''}As ${/^[aeiou]/i.test(arche) ? 'an' : 'a'} ${arche}, the projection carries role dependence \u2014 the value assumes he is used in-position, not shoehorned to fill a gap. Availability and temperament are the usual caveats. The projection is wrong if he fails to secure minutes a tier up, or if the production simply does not travel.`;

  const judgment = isAgent
    ? `Stripped to one line: a ${tierNow}-ready ${arche} with a clean pathway and a comparable already trending in the open market. A sporting director should remember the asymmetry \u2014 almost nobody else has a read on him yet, and that is the entire edge. Move while it is still true.`
    : `Stripped to one line: ${name} is a ${conviction} bet \u2014 low cost today, ${headroom != null ? `+${headroom} of headroom` : 'real headroom'}, floor at ${rating != null && rating >= 76 ? 'Tier-1 rotation' : 'a guaranteed starter a tier down'}. A board should hear it as buying the look before the market prices him. Act if he holds a starting role through the next window; revisit if the minutes dry up.`;

  const page = { position: 'relative', maxWidth: 880, margin: '0 auto', background: '#070708', color: '#e8e8e8', padding: '0 0 56px' };
  const body = { position: 'relative', zIndex: 1, padding: '0 40px' };
  const section = { marginBottom: 30 };
  const togBtn = (active) => ({ background: active ? LIME : 'transparent', color: active ? INK : '#9a9a9a', border: `1px solid ${active ? LIME : '#2a2a2a'}`, padding: '7px 14px', fontFamily: BC, fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' });

  return createPortal((
    <div className="dd-overlay" style={{ position: 'fixed', inset: 0, zIndex: 9500, background: 'rgba(0,0,0,0.92)', overflowY: 'auto', padding: '24px 0 60px' }}>
      <style>{PRINT_CSS}</style>

      <div className="dd-noprint" style={{ maxWidth: 880, margin: '0 auto 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '0 40px', flexWrap: 'wrap' }}>
        <button onClick={onClose} style={{ background: 'transparent', color: '#9a9a9a', border: '1px solid #2a2a2a', padding: '7px 14px', fontFamily: BC, fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: 6 }}>← Close</button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: BC, fontSize: 10, letterSpacing: '0.16em', color: '#666', textTransform: 'uppercase' }}>Prepared for</span>
          <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden' }}>
            <button onClick={() => setKind('club')} style={togBtn(!isAgent)}>Club</button>
            <button onClick={() => setKind('agent')} style={togBtn(isAgent)}>Agent</button>
          </div>
          <button onClick={() => window.print()} style={{ background: LIME, color: INK, border: 'none', padding: '8px 16px', fontFamily: BC, fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: 6 }}>↓ Save as PDF</button>
        </div>
      </div>

      <div className="dd-doc" style={page}>
        <Watermark mark={mark} />

        <div className="dd-cover" style={{ position: 'relative', zIndex: 1, padding: '34px 40px 24px', borderBottom: `3px solid ${LIME}`, background: 'linear-gradient(180deg, #0c0d0a, #070708)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
            <div>
              <div className="dd-accent" style={{ fontFamily: BC, fontSize: 11, letterSpacing: '0.2em', color: LIME, textTransform: 'uppercase' }}>Calibre Discovery Dossier</div>
              <h1 style={{ fontFamily: BC, fontSize: 46, fontWeight: 800, textTransform: 'uppercase', margin: '6px 0 4px', lineHeight: 0.98 }}>{name}</h1>
              <div className="dd-muted" style={{ color: '#9a9a9a', fontSize: 14 }}>{[position, club, age != null ? `${age} yrs` : null, player.nation].filter(Boolean).join('  \u00b7  ')}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="dd-accent" style={{ fontFamily: BC, fontSize: 44, fontWeight: 800, color: LIME, lineHeight: 1 }}>{rating ?? '\u2014'}</div>
              <div className="dd-muted" style={{ fontFamily: BC, fontSize: 10, letterSpacing: '0.12em', color: '#666', textTransform: 'uppercase' }}>Calibre rating</div>
              <div className="dd-muted" style={{ fontFamily: BC, fontSize: 11, letterSpacing: '0.12em', color: '#9a9a9a', textTransform: 'uppercase', marginTop: 12 }}>{isAgent ? 'Prepared for an agent' : 'Prepared for a club'}</div>
            </div>
          </div>
          <div className="dd-muted" style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap', fontFamily: BC, fontSize: 10, letterSpacing: '0.1em', color: '#555', textTransform: 'uppercase' }}>
            <span>{today}</span><span>·</span><span>{commissionId ? `Ref ${commissionId}` : 'Preview draft'}</span><span>·</span><span>Confidential — {mark}</span>
          </div>
        </div>

        <div style={{ ...body, paddingTop: 28 }}>
          <div style={section}>
            <SectionTitle n="01">Executive verdict</SectionTitle>
            <Para>{verdict}</Para>
          </div>

          <div style={section}>
            <SectionTitle n="02">The opportunity</SectionTitle>
            <Para>{opportunity}</Para>
          </div>

          <div style={section}>
            <SectionTitle n="03">Calibre signal</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 10 }}>
              <Stat label="Calibre rating" value={rating ?? '\u2014'} accent />
              <Stat label="Archetype / role" value={arche} />
              <Stat label="Age" value={age ?? '\u2014'} />
              <Stat label="Trajectory" value={cap(trajRaw)} />
            </div>
            <p className="dd-muted" style={{ color: '#888', fontSize: 12, lineHeight: 1.6, margin: 0 }}>Computed from the shared engine on current-season data. Where stat depth is thin (common for under-covered leagues) the rating is interim and the analyst layer flags it on a paid commission.</p>
          </div>

          <div style={section}>
            <SectionTitle n="04">Development projection &mdash; the bet</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
              <Stat label="Current rating" value={rating ?? '\u2014'} />
              <Stat label="Projected ceiling" value={ceiling != null ? `${ceiling - 2}\u2013${ceiling}` : '\u2014'} accent />
              <Stat label="Headroom" value={headroom != null ? `+${headroom}` : '\u2014'} />
            </div>
            <Para>{projection}</Para>
          </div>

          <div style={section}>
            <SectionTitle n="05">Pathway</SectionTitle>
            <Para>{pathway}</Para>
          </div>

          <div style={section}>
            <SectionTitle n="06">Comparable profiles</SectionTitle>
            {comparables.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                {comparables.map((c, i) => (
                  <div key={c.name || i} className="dd-box" style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#0a0a0a', border: '1px solid #1c1c1c', padding: '10px 14px' }}>
                    <span style={{ fontFamily: BC, fontWeight: 800, color: '#555', width: 22 }}>{String(i + 1).padStart(2, '0')}</span>
                    <span style={{ flex: 1, minWidth: 0 }}><strong style={{ color: '#fff' }}>{c.name}</strong><span className="dd-muted" style={{ color: '#888', fontSize: 12 }}>{'  \u00b7  '}{[c.position || c.role, c.club, c.age != null ? `${c.age}y` : null].filter(Boolean).join(' \u00b7 ')}</span></span>
                    <span className="dd-accent" style={{ fontFamily: BC, fontWeight: 800, color: LIME }}>{num(c.rating) ?? '\u2014'}</span>
                  </div>
                ))}
              </div>
            ) : null}
            <Para>{comparablesNote}</Para>
          </div>

          <div style={section}>
            <SectionTitle n="07">Value &amp; opportunity cost</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
              <Stat label="Calibre value (now)" value={usd1(curVal)} />
              <Stat label="Projected at ceiling" value={usd(ceilVal)} accent />
              <Stat label="Upside multiple" value={multiple ? `${multiple.toFixed(1)}\u00d7` : '\u2014'} />
            </div>
            <Para>{value}</Para>
          </div>

          <div style={section}>
            <SectionTitle n="08">Risk profile</SectionTitle>
            <Para>{risk}</Para>
          </div>

          <div style={section}>
            <SectionTitle n="09">The judgment</SectionTitle>
            <Para>{judgment}</Para>
          </div>

          <div className="dd-rule dd-muted" style={{ borderTop: '1px solid #1c1c1c', paddingTop: 16, marginTop: 4, color: '#555', fontSize: 11, lineHeight: 1.6 }}>
            Calibre Discovery Dossier · {mark} · {today}. Engine-assembled draft; the analyst layer refines verdict, pathway and risk per paid commission. Quantitative outputs derive from available data and are projections, not guarantees. Confidential to the named recipient.
          </div>
        </div>
      </div>
    </div>
  ), document.body);
}
