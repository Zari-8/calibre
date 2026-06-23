// src/services/calibreFitValue.js
// ─────────────────────────────────────────────────────────────────────────────
// CALIBRE FIT-ADJUSTED VALUE — v1  (Piece 2)
//
// The centerpiece move: the SAME player is worth a DIFFERENT amount to a
// DIFFERENT club, because the buying club's system changes how much his
// decisive actions are actually worth to THEM.
//
//   Base value (club-agnostic, from calibreValue.js)  →  €40m
//   × fit multiplier (driven by the System Fit score)  →  €52m to a club he suits
//                                                          €31m to one he doesn't
//
// CLEAN SEAM — this module is a PURE COMBINER. It does NOT recompute fit. It
// takes (1) the base result object from calibreValue() and (2) a System Fit
// SCORE (0–100). Piece 3 (the page) wires in the real number via
// buildSystemFitReport(player, team).score. Swap in a smarter fit engine later
// and this file never changes.
//
// It also unlocks the fit-conditional verdicts the mockup calls for:
//   BACK IT · FAIR DEAL · NEGOTIATE HARD · CONDITIONAL DEAL · SYSTEM RISK · PUNT
// ─────────────────────────────────────────────────────────────────────────────

const FIT_PIVOT = 72;        // neutral fit — no value adjustment at this score
const FIT_SLOPE = 0.014;     // value sensitivity per point of fit away from pivot
const FIT_MULT_MIN = 0.68;   // a terrible fit can't zero a player out entirely
const FIT_MULT_MAX = 1.36;   // a perfect fit premium is meaningful but bounded
const POOR_FIT = 58;         // below this, fit dominates the verdict (system risk)
const ELITE_FIT = 82;        // at/above this, an overpay can be "conditional"

function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
const round1 = (n) => Math.round(n * 10) / 10;
const round2 = (n) => Math.round(n * 100) / 100;

// Fit → value multiplier. Linear off the pivot, clamped so neither extreme runs away.
export function fitMultiplier(fitScore) {
  const f = Number(fitScore);
  if (!Number.isFinite(f)) return 1.0; // no club selected → club-agnostic (base) value
  return clamp(1 + (f - FIT_PIVOT) * FIT_SLOPE, FIT_MULT_MIN, FIT_MULT_MAX);
}

// Adjust a base valuation for one specific buying club.
//   base    = the object returned by calibreValue(player)
//   fitScore= buildSystemFitReport(player, team).score   (0–100)
export function fitAdjustedValue(base, fitScore) {
  const mult = fitMultiplier(fitScore);
  const value = round1(base.estimatedValue * mult);
  const fitFairRange = {
    low: round1(base.fairRange.low * mult),
    high: round1(base.fairRange.high * mult),
  };
  // the club ceiling is re-derived off the fit-adjusted value, so a great fit
  // genuinely extends how far this club can defensibly stretch
  const sc = (base.scarcity ?? 50) / 100;
  const clubMaxSensibleBid = round1(value * (1.20 + sc * 0.40));
  return {
    fitScore: Number.isFinite(Number(fitScore)) ? Math.round(Number(fitScore)) : null,
    fitMultiplier: round2(mult),
    fitPremiumPct: Math.round((mult - 1) * 100), // +30% means "worth 30% more to this club"
    fitAdjustedValue: value,
    fitFairRange,
    clubMaxSensibleBid,
  };
}

// Club-aware verdict. Uses the fit-adjusted value as the reference and adds the
// fit-conditional outcomes a club-agnostic verdict can't express.
export function fitVerdict(base, fit, askingPrice) {
  const ask = Number(askingPrice);
  if (!Number.isFinite(ask)) return { label: '—', tone: 'neutral', why: 'Enter an asking price.' };
  const v = fit.fitAdjustedValue;
  const premium = Math.round((ask / v - 1) * 100);

  // A poor fit dominates — a player who doesn't suit the system is a risk even cheap.
  if (fit.fitScore != null && fit.fitScore < POOR_FIT) {
    return ask <= v * 0.8
      ? { label: 'PUNT', tone: 'warn', premium,
          why: `Weak system fit (${fit.fitScore}/100) — only sensible as a cut-price gamble.` }
      : { label: 'SYSTEM RISK', tone: 'bad', premium,
          why: `Fit of ${fit.fitScore}/100 is too low for this system; the fee isn't justified regardless of raw value.` };
  }

  if (ask <= v)
    return { label: 'BACK IT', tone: 'good', premium,
      why: `Good fit (${fit.fitScore}/100) and at or below the €${v}m he's worth to this club.` };
  if (ask <= fit.fitFairRange.high)
    return { label: 'FAIR DEAL', tone: 'good', premium,
      why: `Within the fit-adjusted fair range (€${fit.fitFairRange.low}–${fit.fitFairRange.high}m).` };
  if (ask <= fit.clubMaxSensibleBid)
    return { label: 'NEGOTIATE HARD', tone: 'warn', premium,
      why: `Above fair value but under the €${fit.clubMaxSensibleBid}m sensible ceiling for this club.` };

  // above the club ceiling
  if (fit.fitScore != null && fit.fitScore >= ELITE_FIT)
    return { label: 'CONDITIONAL DEAL', tone: 'warn', premium,
      why: `€${round1(ask - fit.clubMaxSensibleBid)}m over the ceiling — but an elite fit (${fit.fitScore}/100) can carry it if role and resale conviction are high.` };
  return { label: 'WALK AWAY', tone: 'bad', premium,
    why: `€${round1(ask - fit.clubMaxSensibleBid)}m above the €${fit.clubMaxSensibleBid}m ceiling, and the fit doesn't justify the premium.` };
}

// ── SELF-TEST: run `node calibreFitValue.js` ─────────────────────────────────
const isMain = (() => {
  try { return import.meta.url === `file://${process.argv[1]}`; } catch { return false; }
})();
if (isMain) {
  const { calibreValue } = await import('./calibreValue.js');
  const player = { name: 'Junior Kroupi', rating: 81, age: 19, position: 'ST', league: 'Ligue 1', club: 'LOSC Lille', minutes: 1800, hasContractData: false };
  const base = calibreValue(player);

  // representative fit scores for three buying-club archetypes (Piece 3 feeds the
  // REAL buildSystemFitReport().score here):
  const clubs = [
    ['Bournemouth (high-press, needs a 9)', 88],
    ['Neutral mid-table side', 72],
    ['Deep-block, slow build-up', 54],
  ];

  const pad = (s, n) => String(s).padEnd(n);
  console.log(`\nFIT-ADJUSTED VALUE — ${player.name} (base €${base.estimatedValue}m, scarcity ${base.scarcity})`);
  console.log('─'.repeat(92));
  console.log(pad('Buying club', 38) + pad('Fit', 6) + pad('×', 7) + pad('Fit value', 12) + pad('Club ceiling', 14) + 'verdict @ €70m');
  console.log('─'.repeat(92));
  for (const [name, fitScore] of clubs) {
    const fit = fitAdjustedValue(base, fitScore);
    const verdict = fitVerdict(base, fit, 70);
    console.log(
      pad(name, 38) + pad(`${fit.fitScore}`, 6) + pad(`${fit.fitMultiplier}`, 7) +
      pad(`€${fit.fitAdjustedValue}m`, 12) + pad(`€${fit.clubMaxSensibleBid}m`, 14) + verdict.label
    );
  }
  console.log('─'.repeat(92));

  // verdict ladder for the best-fit club across asking prices
  const fit = fitAdjustedValue(base, 88);
  console.log(`\nBournemouth (fit 88, worth €${fit.fitAdjustedValue}m, ceiling €${fit.clubMaxSensibleBid}m) — verdict by asking price:`);
  for (const ask of [40, 55, 75, 100]) {
    const vd = fitVerdict(base, fit, ask);
    console.log(`  €${pad(ask + 'm', 6)} → ${pad(vd.label, 18)} (${vd.premium >= 0 ? '+' : ''}${vd.premium}%)  ${vd.why}`);
  }

  // contrast: same player, poor-fit club
  const poor = fitAdjustedValue(base, 54);
  console.log(`\nDeep-block side (fit 54, worth €${poor.fitAdjustedValue}m) — verdict by asking price:`);
  for (const ask of [25, 55, 90]) {
    const vd = fitVerdict(base, poor, ask);
    console.log(`  €${pad(ask + 'm', 6)} → ${pad(vd.label, 18)} ${vd.why}`);
  }
  console.log('');
}
