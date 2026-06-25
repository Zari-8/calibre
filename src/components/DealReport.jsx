// ─────────────────────────────────────────────────────────────────────────────
// DealReport — downloadable PDF for any Calibre transfer analysis
// Gated behind Scout & Club subscription tiers.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { navigateTo } from './NavLink.jsx';
import useAuth from '../hooks/useAuth.js';
import { resolveTier, hasPaidAccess } from '../services/access.js';

// ── Tier check ───────────────────────────────────────────────────────────────
// Access is resolved centrally in services/access.js:
//   • Owner accounts (OWNER_EMAILS) always get full 'founder' access.
//   • Everyone else falls back to the localStorage placeholder for testing:
//       localStorage.setItem('calibre:tier', 'scout' | 'club' | 'founder')  → unlocks
//       localStorage.removeItem('calibre:tier')                             → locks

// ── Styles ───────────────────────────────────────────────────────────────────
const btnStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 8,
  background: 'transparent', color: '#c8ff00',
  border: '1px solid #c8ff00', padding: '10px 16px',
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: 12, fontWeight: 800, letterSpacing: '0.15em',
  textTransform: 'uppercase', cursor: 'pointer',
  transition: 'all 0.15s',
};
const btnHover = { background: '#c8ff00', color: '#0a0a0a' };

const modalBackdrop = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
  zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 20,
};
const modalBox = {
  background: '#0f0f0f', border: '1px solid #2a2a2a',
  padding: 32, maxWidth: 480, width: '100%',
  borderTop: '3px solid #c8ff00',
};

// ─────────────────────────────────────────────────────────────────────────────
export default function DealReport({ player, team, verdict, sysFit, marketValue, askingPrice }) {
  const [generating, setGenerating] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [hover, setHover] = useState(false);
  const { user } = useAuth();

  const tier = resolveTier(user?.email);
  const hasAccess = hasPaidAccess(tier);

  async function handleDownload() {
    if (!hasAccess) {
      setShowUpgrade(true);
      return;
    }
    if (!player || !verdict) {
      alert('Run an analysis first — search a player, then download the report.');
      return;
    }

    setGenerating(true);
    try {
      const { jsPDF } = await import('jspdf');
      await generateReport({ jsPDF, player, team, verdict, sysFit, marketValue, askingPrice });
    } catch (e) {
      console.error('[Calibre] Report generation failed:', e);
      alert('Could not generate the report. Please try again.');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button
          onClick={handleDownload}
          disabled={generating}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          style={{ ...btnStyle, ...(hover && !generating ? btnHover : {}), opacity: generating ? 0.5 : 1 }}
        >
          {generating ? 'Generating…' : '↓ Download PDF Report'}
        </button>
        <span style={{ fontSize: 10, color: hasAccess ? '#c8ff00' : '#666', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: "'Barlow Condensed', sans-serif" }}>
          {hasAccess ? `${(tier || '').toUpperCase()} access` : 'Scout & Club tiers'}
        </span>
      </div>

      {showUpgrade && (
        <div style={modalBackdrop} onClick={() => setShowUpgrade(false)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 10, color: '#c8ff00', letterSpacing: '0.18em', textTransform: 'uppercase', fontFamily: "'Barlow Condensed', sans-serif", marginBottom: 10 }}>
              Calibre Premium
            </div>
            <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 800, textTransform: 'uppercase', margin: '0 0 14px', lineHeight: 1.1 }}>
              Detailed PDF Reports
            </h3>
            <p style={{ fontSize: 14, color: '#888', lineHeight: 1.6, margin: '0 0 22px' }}>
              Downloadable deal reports — full verdict breakdown, fair price model, system fit analysis, comparables, and risk profile — are available on the Scout and Club packages.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button
                onClick={() => { setShowUpgrade(false); navigateTo('/pricing'); }}
                style={{ ...btnStyle, background: '#c8ff00', color: '#0a0a0a' }}
              >
                View Packages →
              </button>
              <button
                onClick={() => setShowUpgrade(false)}
                style={{ ...btnStyle, borderColor: '#2a2a2a', color: '#888' }}
              >
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF GENERATION
// ─────────────────────────────────────────────────────────────────────────────
async function generateReport({ jsPDF, player, team, verdict, sysFit, marketValue, askingPrice }) {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = pdf.internal.pageSize.getWidth();
  const M = 40; // margin

  const playerName = (player.full_name || player.name || 'Unknown Player').toUpperCase();
  const fileSafe = (player.full_name || player.name || 'Calibre').replace(/[^a-zA-Z0-9]/g, '-');

  // ── HEADER BAR ─────────────────────────────────────────────────────────────
  pdf.setFillColor(10, 10, 10);
  pdf.rect(0, 0, W, 90, 'F');
  pdf.setFillColor(200, 255, 0);
  pdf.rect(0, 88, W, 2, 'F');

  pdf.setTextColor(200, 255, 0);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(22);
  pdf.text('CALIBRE', M, 42);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(150, 150, 150);
  pdf.text('TRANSFER INTELLIGENCE · DEAL REPORT', M, 58);
  pdf.text(`Generated ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} · calibrefootball.com`, M, 72);

  // ── PLAYER PROFILE ─────────────────────────────────────────────────────────
  let y = 130;
  pdf.setTextColor(20, 20, 20);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(26);
  pdf.text(playerName, M, y);

  y += 22;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  pdf.setTextColor(110, 110, 110);
  const profileLine = [
    player.pos || player.position,
    player.age ? `Age ${player.age}` : null,
    player.club || player.team,
    player.nationality || player.country,
  ].filter(Boolean).join('  ·  ');
  pdf.text(profileLine, M, y);

  y += 16;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(200, 160, 0);
  pdf.text(`CALIBRE RATING: ${player.rating || '—'}`, M, y);

  // ── VERDICT BLOCK ──────────────────────────────────────────────────────────
  y += 28;
  const verdictColor =
    verdict.verdictClass === 'lime' ? [200, 255, 0] :
    verdict.verdictClass === 'amber' ? [245, 158, 11] :
    verdict.verdictClass === 'red' ? [239, 68, 68] :
    [200, 255, 0];

  pdf.setFillColor(...verdictColor);
  pdf.rect(M, y, W - M * 2, 80, 'F');
  pdf.setTextColor(0, 0, 0);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.text('CALIBRE VERDICT', M + 16, y + 22);
  pdf.setFontSize(32);
  pdf.text(verdict.verdict, M + 16, y + 60);

  // ── KEY NUMBERS GRID ───────────────────────────────────────────────────────
  y += 100;
  pdf.setTextColor(20, 20, 20);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text('DEAL BREAKDOWN', M, y);
  pdf.setDrawColor(220, 220, 220);
  pdf.line(M, y + 4, W - M, y + 4);

  y += 22;
  const cellW = (W - M * 2) / 3;
  const cells = [
    { label: 'MARKET VALUE', value: `€${marketValue}M` },
    { label: 'ASKING PRICE', value: `€${askingPrice}M` },
    { label: 'PREMIUM', value: `${verdict.premium >= 0 ? '+' : ''}${verdict.premium}%` },
    { label: 'FAIR CEILING', value: `€${verdict.fairCeiling}M` },
    { label: 'PREMIUM JUSTIFIED', value: `${verdict.premiumJustified}%` },
    { label: 'DEAL RISK', value: verdict.dealRisk },
  ];
  cells.forEach((c, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = M + col * cellW;
    const yy = y + row * 56;
    pdf.setFillColor(248, 248, 248);
    pdf.rect(x + 4, yy, cellW - 8, 48, 'F');
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(120, 120, 120);
    pdf.text(c.label, x + 14, yy + 14);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.setTextColor(20, 20, 20);
    pdf.text(String(c.value), x + 14, yy + 36);
  });
  y += 56 * 2 + 12;

  // ── FAIR PRICE BREAKDOWN ───────────────────────────────────────────────────
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text('FAIR PRICE MODEL', M, y);
  pdf.line(M, y + 4, W - M, y + 4);

  y += 22;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(60, 60, 60);
  const modelLines = [
    `Base (Transfermarkt consensus):  €${marketValue}M`,
    `Rating multiplier (Calibre ${player.rating || '—'}):  ${verdict.ratingMult || 1.0}x`,
    `Age curve premium (age ${player.age || '—'}):  ${verdict.ageCurve}/100`,
    `Position scarcity (${(player.pos || 'MID').toUpperCase()}):  ${verdict.scarcity}/100`,
    `→ Calibre defensible ceiling:  €${verdict.fairCeiling}M`,
  ];
  modelLines.forEach((line, i) => {
    if (i === modelLines.length - 1) {
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(20, 20, 20);
    }
    pdf.text(line, M + 6, y + i * 16);
  });
  y += modelLines.length * 16 + 14;

  // ── SYSTEM FIT (if team selected) ──────────────────────────────────────────
  if (team && sysFit) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(20, 20, 20);
    pdf.text(`SYSTEM FIT vs ${team.name.toUpperCase()}`, M, y);
    pdf.line(M, y + 4, W - M, y + 4);

    y += 22;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(36);
    pdf.setTextColor(...verdictColor);
    pdf.text(String(sysFit.score), M, y + 30);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(120, 120, 120);
    pdf.text(`SYSTEM FIT / 100`, M, y + 44);

    pdf.setTextColor(60, 60, 60);
    pdf.setFontSize(10);
    pdf.text(`${team.name} · ${team.formation} · ${team.philosophy}`, M + 100, y + 16);
    pdf.text(`Press: ${team.intensity}  ·  Line: ${team.lineHeight}`, M + 100, y + 32);

    y += 64;
    const fitMetrics = [
      { label: 'Press match', value: sysFit.pressing },
      { label: 'Transition', value: sysFit.transition },
      { label: 'Box threat', value: sysFit.boxThreat },
    ];
    fitMetrics.forEach((m, i) => {
      pdf.setFontSize(9);
      pdf.setTextColor(100, 100, 100);
      pdf.text(m.label, M, y + i * 20);
      // Bar
      pdf.setFillColor(230, 230, 230);
      pdf.rect(M + 100, y + i * 20 - 8, 280, 10, 'F');
      pdf.setFillColor(...verdictColor);
      pdf.rect(M + 100, y + i * 20 - 8, Math.min(280, (m.value / 100) * 280), 10, 'F');
      pdf.setTextColor(20, 20, 20);
      pdf.setFont('helvetica', 'bold');
      pdf.text(String(m.value), M + 390, y + i * 20);
      pdf.setFont('helvetica', 'normal');
    });
    y += fitMetrics.length * 20 + 14;
  }

  // ── VERDICT REASONING ──────────────────────────────────────────────────────
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(20, 20, 20);
  pdf.text('CALIBRE READING', M, y);
  pdf.line(M, y + 4, W - M, y + 4);

  y += 22;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(60, 60, 60);
  const reasoning = buildReasoning({ player, team, verdict, sysFit, marketValue, askingPrice });
  const wrapped = pdf.splitTextToSize(reasoning, W - M * 2);
  pdf.text(wrapped, M, y);

  // ── FOOTER ─────────────────────────────────────────────────────────────────
  const PH = pdf.internal.pageSize.getHeight();
  pdf.setDrawColor(220, 220, 220);
  pdf.line(M, PH - 60, W - M, PH - 60);
  pdf.setFontSize(7);
  pdf.setTextColor(140, 140, 140);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Transfer values sourced from Transfermarkt. Calibre ratings, fair price ceilings and system fit scores are computed from TheStatsAPI event data and Calibre\'s proprietary rating engine. Not financial or sporting advice.', M, PH - 44, { maxWidth: W - M * 2 });
  pdf.setFontSize(8);
  pdf.setTextColor(20, 20, 20);
  pdf.setFont('helvetica', 'bold');
  pdf.text('calibrefootball.com', M, PH - 22);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(120, 120, 120);
  pdf.text(`© Calibre Football Intelligence · ${new Date().getFullYear()}`, W - M, PH - 22, { align: 'right' });

  pdf.save(`${fileSafe}-DealReport.pdf`);
}

function buildReasoning({ player, team, verdict, sysFit, marketValue, askingPrice }) {
  const name = player.full_name || player.name || 'This player';
  const teamName = team?.name || 'the buying club';
  const v = verdict.verdict;

  const lead =
    v === 'DEAL'
      ? `At €${askingPrice}M, ${name} represents fair value relative to Calibre's defensible ceiling of €${verdict.fairCeiling}M.`
      : v === 'CONDITIONAL DEAL'
      ? `At €${askingPrice}M, ${name} sits just above Calibre's fair ceiling of €${verdict.fairCeiling}M. The deal works if performance bonuses or sell-on clauses absorb the premium.`
      : v === 'NEGOTIATE HARD'
      ? `At €${askingPrice}M, this transfer asks for a ${verdict.premium}% premium over market value. Calibre's defensible ceiling is €${verdict.fairCeiling}M — there is room to walk the price down.`
      : `At €${askingPrice}M, this transfer significantly exceeds Calibre's defensible ceiling of €${verdict.fairCeiling}M. The asking price cannot be justified by rating, age curve, or position scarcity alone.`;

  const ageBlurb = player.age
    ? player.age <= 21
      ? ` At ${player.age}, ${name.split(' ').slice(-1)[0]} has 5-7 peak years of resale potential, justifying meaningful age curve premium.`
      : player.age <= 24
      ? ` At ${player.age}, the player is at the front end of their peak — premium pricing carries less risk.`
      : player.age <= 27
      ? ` At ${player.age}, the player is in their peak window. Pricing should reflect 3-4 year horizons, not 7-year ones.`
      : ` At ${player.age}, the player is past peak resale value. Any premium must be justified by immediate sporting impact.`
    : '';

  const fitBlurb = team && sysFit
    ? sysFit.score >= 80
      ? ` Tactical fit at ${teamName} is elite (${sysFit.score}/100). The player's profile maps closely to ${team.philosophy.toLowerCase()} demands.`
      : sysFit.score >= 65
      ? ` Tactical fit at ${teamName} is workable (${sysFit.score}/100). Some adjustment will be required but the structure can absorb it.`
      : ` Tactical fit at ${teamName} is a stretch (${sysFit.score}/100). The price assumes a structural shift the club may not be planning.`
    : '';

  return lead + ageBlurb + fitBlurb;
}
