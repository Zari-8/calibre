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

// ── BUYER LEAGUE COST FACTOR ─────────────────────────────────────────────
// Real transfer economics, separate from fit. calibreValue.js's LEAGUE_MULT
// already prices "how rich/proven is the league the PLAYER is IN right now"
// — but nothing anywhere priced "how rich is the league DOING the buying,"
// which is a different, real effect: the same player, at the same ability,
// costs more when a Premier League club is the one negotiating, because
// PL clubs have more money and the market (agents, selling clubs, rival
// bidders) prices that in — not because the player becomes more valuable.
// This belongs in the fit layer, not calibreValue.js, because it's a
// buyer-specific cost, exactly like fit itself (same "club changes the
// number" principle the whole Piece 2 seam exists for).
//
// Grounded in published research, not invented: a cross-league study found
// Premier League clubs carry roughly a 40% valuation premium over
// comparable continental fees, largely attributed to the league's outsized
// TV revenue; separately, CIES Football Observatory data has found English
// clubs account for ~51% of total transfer spend across Europe's big five
// leagues. Applied conservatively here — NOT the full ~40% — because this
// is one aggregated academic estimate, not the multi-anchor, cross-checked
// discipline the rest of this engine holds itself to before shipping a
// number at full strength (see calibreValue.js's AGE_ANCHORS comment on the
// Mbappé open item for why a single data point stays held back). Revisit
// upward with a real anchor — a closed window where the same player profile
// drew a PL bid vs a continental bid — rather than trusting one paper's
// aggregate outright.
const BUYER_LEAGUE_COST_MULT = {
  'premier league': 1.15,
};
export function buyerLeagueCostMultiplier(leagueRaw) {
  return BUYER_LEAGUE_COST_MULT[String(leagueRaw || '').trim().toLowerCase()] ?? 1.0;
}

// Adjust a base valuation for one specific buying club.
//   base       = the object returned by calibreValue(player)
//   fitScore   = buildSystemFitReport(player, team).score   (0–100)
//   buyerLeague= the BUYING club's league (e.g. team.league from systemFitData.js)
//                — distinct from the player's own current league, which
//                calibreValue.js's LEAGUE_MULT already accounts for.
export function fitAdjustedValue(base, fitScore, buyerLeague) {
  const fMult = fitMultiplier(fitScore);
  const costMult = buyerLeagueCostMultiplier(buyerLeague);
  const mult = fMult * costMult;
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
    fitMultiplier: round2(fMult),
    fitPremiumPct: Math.round((fMult - 1) * 100), // +30% means "worth 30% more to this club" — fit only
    buyerLeagueCostMultiplier: round2(costMult),
    buyerLeagueCostPct: Math.round((costMult - 1) * 100), // +15% means "costs 15% more because this buyer is in a richer league"
    combinedMultiplier: round2(mult), // fMult × costMult — the actual multiplier applied to base.estimatedValue below
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

  // above the club ceiling — an elite fit can stretch it, but only so far, never infinitely
  const elite = fit.fitScore != null && fit.fitScore >= ELITE_FIT;
  const fitStretch = elite ? 1 + Math.min(0.18, 0.06 + (fit.fitScore - ELITE_FIT) * 0.01) : 1;
  const conditionalCeiling = round1(fit.clubMaxSensibleBid * fitStretch);
  if (elite && ask <= conditionalCeiling)
    return { label: 'CONDITIONAL DEAL', tone: 'warn', premium,
      why: `€${round1(ask - fit.clubMaxSensibleBid)}m over the €${fit.clubMaxSensibleBid}m ceiling — an elite fit (${fit.fitScore}/100) can carry a stretch this size if role and resale conviction are high.` };
  return { label: 'WALK AWAY', tone: 'bad', premium,
    why: elite
      ? `€${round1(ask - fit.clubMaxSensibleBid)}m over the €${fit.clubMaxSensibleBid}m ceiling — beyond what even an elite fit (${fit.fitScore}/100) can justify.`
      : `€${round1(ask - fit.clubMaxSensibleBid)}m above the €${fit.clubMaxSensibleBid}m ceiling, and the fit doesn't justify the premium.` };
}

// ── SELF-TEST: run `node calibreFitValue.js` ─────────────────────────────────
const isMain = (() => {
  try { return import.meta.url === `file://${process.argv[1]}`; } catch { return false; }
})();
if (isMain) {
  const { calibreValue } = await import('./calibreValue.js');
  const player = { name: 'Junior Kroupi', rating: 81, age: 19, position: 'ST', league: 'Ligue 1', club: 'LOSC Lille', minutes: 1800, hasContractData: false };
  const base = calibreValue(player);

  // representative fit scores for buying-club archetypes (Piece 3 feeds the
  // REAL buildSystemFitReport().score here). Two Premier League entries
  // included to show the buyer-league cost factor stacking with fit.
  const clubs = [
    ['Bournemouth (high-press, needs a 9, PL)', 88, 'Premier League'],
    ['Neutral mid-table side (Ligue 1)', 72, 'Ligue 1'],
    ['Deep-block, slow build-up (PL)', 54, 'Premier League'],
  ];

  const pad = (s, n) => String(s).padEnd(n);
  console.log(`\nFIT-ADJUSTED VALUE — ${player.name} (base €${base.estimatedValue}m, scarcity ${base.scarcity})`);
  console.log('─'.repeat(104));
  console.log(pad('Buying club', 42) + pad('Fit', 6) + pad('Fit×', 7) + pad('PL×', 6) + pad('Fit value', 12) + pad('Club ceiling', 14) + 'verdict @ €70m');
  console.log('─'.repeat(104));
  for (const [name, fitScore, buyerLeague] of clubs) {
    const fit = fitAdjustedValue(base, fitScore, buyerLeague);
    const verdict = fitVerdict(base, fit, 70);
    console.log(
      pad(name, 42) + pad(`${fit.fitScore}`, 6) + pad(`${fit.fitMultiplier}`, 7) + pad(`${fit.buyerLeagueCostMultiplier}`, 6) +
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
