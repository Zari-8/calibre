// ─────────────────────────────────────────────────────────────────────────────
// Dossier — the commissioned, decision-grade transfer intelligence brief.
//
// This is the deep counterpart to DealReport. Where DealReport is a one-page
// receipt of the on-screen verdict, the Dossier is a multi-section document that
// answers the questions a Director of Football actually weighs before a signing.
//
// It reuses the live engine state already computed on the Transfers page
// (calibreValue, calibreFitValue, computeVerdict, computeSystemFit, comparables)
// — no re-querying — and adds an Opportunity Cost module and the 40-point
// DoF decision scorecard on top.
//
// Rendering: a full-screen overlay, print-optimised (Save as PDF) so it doubles
// as the delivered artifact. Sections that need data we don't yet hold (squad
// depth, medical history) or the human analyst layer are surfaced honestly
// rather than faked.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect } from 'react';

const LIME = '#c8ff00';
const INK = '#0a0a0a';
const BC = "'Barlow Condensed', sans-serif";

const eur = (v) => (v == null || Number.isNaN(Number(v)) ? '—' : `€${Math.round(Number(v))}M`);
const eur1 = (v) => (v == null || Number.isNaN(Number(v)) ? '—' : `€${(Math.round(Number(v) * 10) / 10)}M`);
const pct = (v) => (v == null || Number.isNaN(Number(v)) ? '—' : `${v >= 0 ? '+' : ''}${Math.round(v)}%`);

function verdictColor(v) {
  if (v?.verdictClass === 'red') return '#ef4444';
  if (v?.verdictClass === 'amber') return '#f59e0b';
  return LIME;
}

// ── small presentational helpers ─────────────────────────────────────────────
function Eyebrow({ children }) {
  return <div style={{ fontFamily: BC, fontSize: 10, letterSpacing: '0.22em', color: '#666', textTransform: 'uppercase', marginBottom: 10 }}>{children}</div>;
}
function SectionTitle({ n, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, borderBottom: `1px solid #1c1c1c`, paddingBottom: 10, marginBottom: 18 }}>
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
function Bar({ label, value }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#999', marginBottom: 4 }}>
        <span>{label}</span><span style={{ color: '#fff', fontWeight: 700 }}>{v}</span>
      </div>
      <div style={{ height: 6, background: '#1c1c1c' }}>
        <div style={{ height: '100%', width: `${v}%`, background: LIME }} />
      </div>
    </div>
  );
}

export default function Dossier({ player, team, valuation, fit, dealVerdict, verdict, sysFit, comparables = [], askingPrice, marketValue, recipient, onClose }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape' && onClose) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [onClose]);

  if (!player) return null;

  const name = (player.full_name || player.name || 'Unknown Player');
  const last = name.split(' ').slice(-1)[0];
  const date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const refNo = `CFD-${player.apiPlayerId || '0000'}-${new Date().getFullYear()}`;
  const fee = Number(askingPrice) || 0;
  const vColor = verdictColor(verdict);

  const realFactors = (valuation?.breakdown || []).filter(f => !f.stub);
  const drivers = valuation?.confidenceDrivers || [];

  // ── Opportunity cost: alternatives you could pursue for ≤ this fee ──
  const alternatives = comparables
    .filter(c => c && c.name && (c.estimate != null || c.fee != null))
    .map(c => {
      const val = c.estimate != null ? Number(c.estimate) : Number(c.fee);
      return { ...c, val, vfm: fee ? val / fee : null };
    })
    .filter(c => c.val > 0 && c.val <= fee)
    .sort((a, b) => (b.val || 0) - (a.val || 0))
    .slice(0, 5);

  // ── DoF decision scorecard — themed; computed where the engine supports it ──
  const yes = (t) => ({ status: 'pass', text: t });
  const no = (t) => ({ status: 'fail', text: t });
  const warn = (t) => ({ status: 'warn', text: t });
  const pending = (t) => ({ status: 'pending', text: t });

  const premiumJust = verdict?.premiumJustified;
  const scorecard = [
    ['Value & Price', [
      ['Fee within Calibre fair range', fee <= (valuation?.fairRange?.high ?? Infinity) ? yes(`€${fee}M ≤ €${valuation?.fairRange?.high}M ceiling`) : no(`€${fee}M over €${valuation?.fairRange?.high}M fair-range top`)],
      ['Premium defensible', premiumJust != null ? (premiumJust >= 70 ? yes(`${premiumJust}% of fee justified`) : warn(`only ${premiumJust}% justified`)) : pending('—')],
      ['Below club max sensible bid', fit?.clubMaxSensibleBid != null ? (fee <= fit.clubMaxSensibleBid ? yes(`≤ €${fit.clubMaxSensibleBid}M`) : no(`over €${fit.clubMaxSensibleBid}M`)) : pending('select club')],
      ['Resale value protected', verdict?.ageCurve >= 60 ? yes('age curve supports resale') : warn('limited resale runway')],
    ]],
    ['Performance & Output', [
      ['Calibre rating tier', player?.rating != null ? (player.rating >= 80 ? yes(`elite (${Math.round(player.rating)})`) : player.rating >= 72 ? warn(`solid (${Math.round(player.rating)})`) : no(`below tier (${Math.round(player.rating)})`)) : pending('—')],
      ['Sample size sufficient', valuation?.confidence >= 65 ? yes(`confidence ${valuation.confidence}`) : warn(`thin sample (conf. ${valuation?.confidence ?? '—'})`)],
      ['Output vs position benchmark', pending('analyst layer — event-data percentile')],
    ]],
    ['Tactical System Fit', [
      ['Fits buying-club system', sysFit?.score != null ? (sysFit.score >= 75 ? yes(`${sysFit.score}/100`) : sysFit.score >= 60 ? warn(`${sysFit.score}/100 — adjustment needed`) : no(`${sysFit.score}/100 — stretch`)) : pending('select club')],
      ['Pressing-scheme match', sysFit?.pressing != null ? (sysFit.pressing >= 70 ? yes(`${sysFit.pressing}`) : warn(`${sysFit.pressing}`)) : pending('select club')],
      ['Role need in squad', pending('squad-depth data layer')],
    ]],
    ['Risk & Durability', [
      ['Deal risk', verdict?.dealRisk ? (verdict.dealRiskClass === 'red' ? no(verdict.dealRisk) : verdict.dealRiskClass === 'amber' ? warn(verdict.dealRisk) : yes(verdict.dealRisk)) : pending('—')],
      ['Injury / availability history', pending('medical data layer')],
      ['Contract leverage', player?.hasContractData ? warn('known — see terms') : pending('contract data unknown')],
    ]],
    ['Alternatives & Negotiation', [
      ['Better value available for fee', alternatives.length ? warn(`${alternatives.length} cheaper option(s) rate comparably`) : yes('no cheaper option rates higher')],
      ['Negotiation headroom', verdict?.overpayBy > 0 ? no(`€${verdict.overpayBy}M above ceiling`) : yes('priced at or under ceiling')],
      ['Off-pitch / character', pending('analyst layer — sourced')],
    ]],
  ];

  const statusDot = (s) => s === 'pass' ? LIME : s === 'fail' ? '#ef4444' : s === 'warn' ? '#f59e0b' : '#555';
  const statusMark = (s) => s === 'pass' ? '✓' : s === 'fail' ? '✕' : s === 'warn' ? '!' : '·';

  const btn = { fontFamily: BC, fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '10px 18px', cursor: 'pointer', border: '1px solid', background: 'transparent' };

  return (
    <div className="dossier-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 4000, overflowY: 'auto', padding: '0 0 60px' }}>
      <style>{`
        @media print {
          .dossier-toolbar { display: none !important; }
          .dossier-overlay { position: static !important; background: #0a0a0a !important; overflow: visible !important; padding: 0 !important; }
          .dossier-doc { box-shadow: none !important; border: none !important; margin: 0 !important; max-width: 100% !important; }
          .dossier-section { break-inside: avoid; page-break-inside: avoid; }
          .dossier-pb { break-before: page; page-break-before: always; }
          @page { margin: 12mm; size: A4; }
        }
      `}</style>

      {/* toolbar */}
      <div className="dossier-toolbar" style={{ position: 'sticky', top: 0, zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '14px 20px', background: '#050505', borderBottom: `1px solid #1c1c1c` }}>
        <span style={{ fontFamily: BC, fontSize: 12, letterSpacing: '0.15em', color: '#666', textTransform: 'uppercase' }}>Dossier preview · {refNo}</span>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => window.print()} style={{ ...btn, borderColor: LIME, color: INK, background: LIME }}>↓ Save as PDF</button>
          <button onClick={onClose} style={{ ...btn, borderColor: '#2a2a2a', color: '#888' }}>Close</button>
        </div>
      </div>

      {/* document */}
      <div className="dossier-doc" style={{ position: 'relative', overflow: 'hidden', maxWidth: 860, margin: '24px auto', background: '#0c0c0c', border: '1px solid #1c1c1c', color: '#e8e8e8' }}>

        {(() => { const mark = recipient ? String(recipient).toUpperCase() : 'CALIBRE · PREVIEW'; return (
          <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 1, opacity: 0.045 }}>
            {Array.from({ length: 11 }).map((_, r) => (
              <div key={r} style={{ position: 'absolute', top: `${r * 10 - 4}%`, left: '-12%', right: '-12%', transform: 'rotate(-24deg)', whiteSpace: 'nowrap', fontFamily: BC, fontSize: 30, fontWeight: 800, letterSpacing: '0.3em', color: '#fff', textTransform: 'uppercase' }}>{`${mark}   `.repeat(8)}</div>
            ))}
          </div>
        ); })()}

        {/* COVER */}
        <div className="dossier-section" style={{ padding: '40px 44px', borderBottom: `2px solid ${LIME}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontFamily: BC, fontSize: 26, fontWeight: 900, letterSpacing: '0.04em', color: LIME }}>CALIBRE</div>
              <div style={{ fontFamily: BC, fontSize: 11, letterSpacing: '0.2em', color: '#888', textTransform: 'uppercase', marginTop: 2 }}>Transfer Intelligence Dossier</div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 10, color: '#666', lineHeight: 1.7 }}>
              <div>Ref {refNo}</div>
              <div>{date}</div>
              <div style={{ color: LIME, letterSpacing: '0.1em' }}>CONFIDENTIAL</div>
            </div>
          </div>

          <div style={{ marginTop: 36 }}>
            <h1 style={{ fontFamily: BC, fontSize: 46, fontWeight: 800, textTransform: 'uppercase', lineHeight: 0.95, margin: 0 }}>{name}</h1>
            <div style={{ fontSize: 13, color: '#999', marginTop: 10 }}>
              {[player.pos || player.position, player.age ? `Age ${player.age}` : null, player.club, player.nationality || player.country].filter(Boolean).join('  ·  ')}
            </div>
            <div style={{ fontFamily: BC, fontSize: 13, color: LIME, letterSpacing: '0.08em', marginTop: 6, textTransform: 'uppercase' }}>
              Calibre Rating {player.rating ? Math.round(player.rating) : '—'}
              {team && <span style={{ color: '#888' }}>{'   ·   '}Prepared for {team.name} sporting dept.</span>}
            </div>
          </div>

          <div style={{ marginTop: 30, display: 'flex', alignItems: 'center', gap: 18, background: '#0a0a0a', border: '1px solid #1c1c1c', padding: '18px 22px' }}>
            <div style={{ fontFamily: BC, fontSize: 11, letterSpacing: '0.15em', color: '#555', textTransform: 'uppercase' }}>Headline verdict</div>
            <div style={{ fontFamily: BC, fontSize: 30, fontWeight: 800, color: vColor, textTransform: 'uppercase', letterSpacing: '0.02em' }}>{dealVerdict?.label || verdict?.verdict || '—'}</div>
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Asking €{fee}M · vs Calibre {eur(valuation?.estimatedValue)}</div>
              <div style={{ fontFamily: BC, fontSize: 18, fontWeight: 800, color: vColor }}>{pct(dealVerdict?.premium)} premium</div>
            </div>
          </div>
        </div>

        {/* 01 EXECUTIVE SUMMARY */}
        <div className="dossier-section" style={{ padding: '32px 44px' }}>
          <SectionTitle n="01">Executive Summary</SectionTitle>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: '#cfcfcf', margin: '0 0 16px' }}>
            At <strong style={{ color: '#fff' }}>€{fee}M</strong>, {name} is assessed as <strong style={{ color: vColor }}>{dealVerdict?.label || verdict?.verdict}</strong> against
            Calibre's independent valuation of <strong style={{ color: LIME }}>{eur(valuation?.estimatedValue)}</strong>
            {team ? <> into {team.name}'s system</> : null}. {dealVerdict?.why || ''}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: '#1c1c1c' }}>
            <Stat label="Calibre Value" value={eur(valuation?.estimatedValue)} color={LIME} />
            <Stat label="Fair Ceiling" value={eur(verdict?.fairCeiling ?? fit?.clubMaxSensibleBid)} color={LIME} />
            <Stat label="Asking Price" value={`€${fee}M`} />
            <Stat label="Premium" value={pct(dealVerdict?.premium)} color={vColor} />
          </div>
          <div style={{ marginTop: 16, padding: '14px 16px', borderLeft: `3px solid ${LIME}`, background: '#0a0a0a' }}>
            <span style={{ fontFamily: BC, fontSize: 10, letterSpacing: '0.15em', color: LIME, textTransform: 'uppercase' }}>Bottom line · </span>
            <span style={{ fontSize: 13, color: '#ddd' }}>
              {verdict?.overpayBy > 0
                ? `The fee sits €${verdict.overpayBy}M above Calibre's defensible ceiling — pursue only with the price walked down or the premium offset by structure.`
                : `The fee is at or under Calibre's defensible ceiling — the numbers support proceeding.`}
            </span>
          </div>
        </div>

        {/* 02 VALUATION MODEL */}
        <div className="dossier-section" style={{ padding: '32px 44px', borderTop: '1px solid #1c1c1c' }}>
          <SectionTitle n="02">Valuation Model</SectionTitle>
          <Eyebrow>How Calibre arrives at {eur(valuation?.estimatedValue)}</Eyebrow>
          <div style={{ border: '1px solid #1c1c1c' }}>
            {realFactors.map((f, i) => {
              const isBase = i === 0;
              const c = isBase ? '#fff' : f.impact > 0 ? LIME : f.impact < 0 ? '#ef4444' : '#777';
              const val = isBase ? eur1(f.impact) + ' base' : `${f.impact > 0 ? '+' : f.impact < 0 ? '−' : ''}${eur1(Math.abs(f.impact)).replace('€', '€')}`;
              return (
                <div key={f.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 14px', borderBottom: '1px solid #161616' }}>
                  <div>
                    <div style={{ fontSize: 13, color: '#ddd', fontWeight: 600 }}>{f.name}</div>
                    <div style={{ fontSize: 11, color: '#666', marginTop: 1 }}>{f.note}</div>
                  </div>
                  <div style={{ fontFamily: BC, fontSize: 18, fontWeight: 800, color: c }}>{val}</div>
                </div>
              );
            })}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 14px', background: '#0a0a0a' }}>
              <div style={{ fontFamily: BC, fontSize: 13, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#fff' }}>Calibre Estimated Value</div>
              <div style={{ fontFamily: BC, fontSize: 24, fontWeight: 800, color: LIME }}>{eur(valuation?.estimatedValue)}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 24, marginTop: 14, fontSize: 12, color: '#999', flexWrap: 'wrap' }}>
            <span>Fair range <strong style={{ color: '#fff' }}>{eur(valuation?.fairRange?.low)}–{eur(valuation?.fairRange?.high)}</strong></span>
            <span>Max sensible bid <strong style={{ color: '#fff' }}>{eur(valuation?.maxSensibleBid)}</strong></span>
            <span>Confidence <strong style={{ color: valuation?.confidence >= 70 ? LIME : '#f59e0b' }}>{valuation?.confidence ?? '—'}</strong>{drivers.length ? ` (${drivers.slice(0, 2).join(', ')})` : ''}</span>
          </div>
        </div>

        {/* 03 SYSTEM FIT */}
        <div className="dossier-section dossier-pb" style={{ padding: '32px 44px', borderTop: '1px solid #1c1c1c' }}>
          <SectionTitle n="03">Tactical System Fit</SectionTitle>
          {team && sysFit ? (
            <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 24, alignItems: 'start' }}>
              <div style={{ textAlign: 'center', background: '#0a0a0a', border: '1px solid #1c1c1c', padding: '20px 0' }}>
                <div style={{ fontFamily: BC, fontSize: 54, fontWeight: 800, color: vColor, lineHeight: 1 }}>{sysFit.score}</div>
                <div style={{ fontSize: 10, color: '#666', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 4 }}>System Fit / 100</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#999', marginBottom: 14 }}>
                  {team.name} · {team.formation || '—'} · {team.philosophy || '—'}
                  {team.intensity ? ` · Press ${team.intensity}` : ''}{team.lineHeight ? ` · Line ${team.lineHeight}` : ''}
                </div>
                {sysFit.pressing != null && <Bar label="Pressing-scheme match" value={sysFit.pressing} />}
                {sysFit.transition != null && <Bar label="Transition fit" value={sysFit.transition} />}
                {sysFit.boxThreat != null && <Bar label="Box threat" value={sysFit.boxThreat} />}
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 13, color: '#888' }}>No buying club selected — tactical fit not assessed. Select a club on the Transfers page to populate this section.</p>
          )}
        </div>

        {/* 04 OPPORTUNITY COST */}
        <div className="dossier-section" style={{ padding: '32px 44px', borderTop: '1px solid #1c1c1c' }}>
          <SectionTitle n="04">Opportunity Cost</SectionTitle>
          <Eyebrow>What else €{fee}M could pursue</Eyebrow>
          {alternatives.length ? (
            <div style={{ border: '1px solid #1c1c1c' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px 110px', gap: 1, background: '#1c1c1c', fontFamily: BC, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#666' }}>
                {['Alternative', 'Calibre Value', 'Rating', 'vs fee'].map((h, i) => <div key={h} style={{ background: '#0a0a0a', padding: '8px 12px', textAlign: i ? 'right' : 'left' }}>{h}</div>)}
              </div>
              {alternatives.map(a => (
                <div key={a.name} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px 110px', gap: 1, background: '#161616' }}>
                  <div style={{ background: '#0c0c0c', padding: '10px 12px', fontSize: 13, color: '#ddd' }}>{a.name}<span style={{ color: '#666', fontSize: 11 }}>{a.pos || a.tag ? `  ·  ${a.pos || a.tag}` : ''}</span></div>
                  <div style={{ background: '#0c0c0c', padding: '10px 12px', textAlign: 'right', fontSize: 13, color: LIME }}>{eur(a.val)}</div>
                  <div style={{ background: '#0c0c0c', padding: '10px 12px', textAlign: 'right', fontSize: 13, color: a.rating >= 80 ? LIME : a.rating >= 72 ? '#f59e0b' : '#aaa' }}>{a.rating != null ? a.rating : '—'}</div>
                  <div style={{ background: '#0c0c0c', padding: '10px 12px', textAlign: 'right', fontSize: 13, color: a.vfm >= 0.8 ? LIME : '#f59e0b' }}>{a.vfm != null ? `${a.vfm.toFixed(2)}×` : '—'}</div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: '#888' }}>No comparably-rated alternative is valued at €{fee}M or less — at this fee the target is the efficient option among similar players.</p>
          )}
          <div style={{ fontSize: 11, color: '#555', marginTop: 10 }}>vs fee = the alternative's Calibre value as a multiple of your €{fee}M outlay. Same-position, comparable-rating players, valued on the same engine.</div>
        </div>

        {/* 05 DEAL STRUCTURE */}
        <div className="dossier-section" style={{ padding: '32px 44px', borderTop: '1px solid #1c1c1c' }}>
          <SectionTitle n="05">Deal Structure & Negotiation</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: '#1c1c1c', marginBottom: 16 }}>
            <Stat label="Defensible ceiling" value={eur(verdict?.fairCeiling)} color={LIME} />
            <Stat label={team ? `Max bid · ${team.short || team.name}` : 'Max sensible bid'} value={eur(fit?.clubMaxSensibleBid ?? valuation?.maxSensibleBid)} color={LIME} />
            <Stat label="Overpay at ask" value={verdict?.overpayBy > 0 ? eur(verdict.overpayBy) : '€0M'} color={verdict?.overpayBy > 0 ? '#ef4444' : LIME} />
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.7, color: '#cfcfcf', margin: 0 }}>
            {verdict?.overpayBy > 0
              ? `To bring the deal inside Calibre's ceiling, target a base fee at or below ${eur(verdict?.fairCeiling)} and push the remaining €${verdict.overpayBy}M into performance-linked add-ons (appearances, output, qualification) and a sell-on clause. Walk away above ${eur(fit?.clubMaxSensibleBid ?? verdict?.fairCeiling)}.`
              : `The ask is already within Calibre's ceiling. Anchor the opening bid below ${eur(verdict?.fairCeiling)} and use add-ons to close, retaining a sell-on clause to protect resale upside.`}
          </p>
        </div>

        {/* 06 DECISION SCORECARD */}
        <div className="dossier-section dossier-pb" style={{ padding: '32px 44px', borderTop: '1px solid #1c1c1c' }}>
          <SectionTitle n="06">Director-of-Football Decision Scorecard</SectionTitle>
          <Eyebrow>The questions a signing actually hinges on</Eyebrow>
          {scorecard.map(([cat, rows]) => (
            <div key={cat} style={{ marginBottom: 18 }}>
              <div style={{ fontFamily: BC, fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: LIME, marginBottom: 8 }}>{cat}</div>
              {rows.map(([q, r]) => (
                <div key={q} style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '6px 0', borderBottom: '1px solid #131313' }}>
                  <span style={{ width: 16, textAlign: 'center', color: statusDot(r.status), fontWeight: 800, flexShrink: 0 }}>{statusMark(r.status)}</span>
                  <span style={{ fontSize: 13, color: '#ddd', flex: 1 }}>{q}</span>
                  <span style={{ fontSize: 12, color: r.status === 'pending' ? '#666' : '#aaa', textAlign: 'right', fontStyle: r.status === 'pending' ? 'italic' : 'normal' }}>{r.text}</span>
                </div>
              ))}
            </div>
          ))}
          <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>
            <span style={{ color: LIME }}>✓</span> supported · <span style={{ color: '#f59e0b' }}>!</span> caution · <span style={{ color: '#ef4444' }}>✕</span> fails · <span style={{ color: '#777' }}>·</span> analyst / data layer (squad depth, medical, off-pitch — added in the full commissioned brief).
          </div>
        </div>

        {/* FOOTER */}
        <div style={{ padding: '24px 44px', borderTop: `1px solid #1c1c1c`, background: '#080808' }}>
          <div style={{ fontSize: 10, color: '#555', lineHeight: 1.7 }}>
            Calibre Estimated Value, fair ranges, system-fit and risk scores are computed independently from Calibre's rating engine and TheStatsAPI event data — they are not market quotes. Squad-depth, medical and off-pitch assessments form the analyst layer of the full commissioned dossier. Not financial or sporting advice.
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 10, color: '#666' }}>
            <span style={{ fontFamily: BC, fontWeight: 800, color: '#fff', letterSpacing: '0.08em' }}>calibrefootball.com</span>
            <span>© Calibre Football Intelligence · {new Date().getFullYear()} · {refNo}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
