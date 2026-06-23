// src/services/calibreValue.js
// ─────────────────────────────────────────────────────────────────────────────
// CALIBRE VALUATION ENGINE — v1
//
// Calibre's INDEPENDENT estimate of a player's open-market value. This is the
// number Calibre publishes as an authority — not a quote of Transfermarkt/CIES.
//
// DESIGN PRINCIPLE — clean seam to the rating layer:
//   This engine never recomputes the rating. It CONSUMES a rating as its single
//   biggest input. The day xG/xA sharpens calibreRating, a better number simply
//   arrives in the `rating` slot and flows through untouched. Value is a LAYER
//   on top of the rating, not a multiple of it.
//
// THE STACK (each term visible + inspectable in the breakdown):
//   base curve(rating)  →  × position  →  × league/club  →  × age  →  − risk
//   = Calibre Estimated Value
//   ...with a fair range, a max sensible bid (scaled by scarcity; fit extends it
//   in Piece 2), and a confidence score reported separately.
//
// v1 STUBS (deliberately neutral until we have the data — they lower CONFIDENCE,
// they do not invent value): international status, contract leverage, market heat,
// archetype/rarity. League-jump risk lives in the fit layer (Piece 2), since it
// needs a buying club.
// ─────────────────────────────────────────────────────────────────────────────

// ── 1) BASE CURVE ────────────────────────────────────────────────────────────
// Anchored to a PEAK-AGE (~24) NEUTRAL MIDFIELDER in the reference league (EPL).
// Values in €m. Curve is fit log-linearly between anchors, so it honours each
// point exactly and grows multiplicatively (the natural shape for value).
const BASE_ANCHORS = [
  [70, 4],
  [78, 25],
  [85, 90],
  [90, 150],
  [94, 200],
];
const RATING_FLOOR = 50;   // below this we clamp (squad-filler territory)
const RATING_CEIL = 96;    // above this is effectively non-existent
const VALUE_FLOOR = 0.3;   // never price a senior pro at literally zero (€m)

function curveBaseValue(ratingRaw) {
  const rating = clamp(Number(ratingRaw) || RATING_FLOOR, RATING_FLOOR, RATING_CEIL);
  const a = BASE_ANCHORS;
  // pick the segment to interpolate / extrapolate on
  let lo = 0;
  for (let i = 0; i < a.length - 1; i++) {
    if (rating >= a[i][0]) lo = i;
  }
  if (rating < a[0][0]) lo = 0;                 // extrapolate down on first segment
  if (rating >= a[a.length - 1][0]) lo = a.length - 2; // extrapolate up on last segment
  const [r0, v0] = a[lo];
  const [r1, v1] = a[lo + 1];
  const t = (rating - r0) / (r1 - r0);
  const lnV = Math.log(v0) + t * (Math.log(v1) - Math.log(v0));
  return Math.max(VALUE_FLOOR, Math.exp(lnV));
}

// ── 2) POSITION MULTIPLIER ───────────────────────────────────────────────────
// Reference = neutral central midfielder (1.00). Forwards up, keepers down.
const POSITION_MULT = {
  ST: 1.30, W: 1.10, AM: 1.10, CM: 1.00, FB: 0.85, CB: 0.85, DM: 0.80, GK: 0.55,
};
function positionGroup(posRaw = '') {
  const t = String(posRaw).toLowerCase();
  if (/(gk|keeper|goal)/.test(t)) return 'GK';
  if (/(cb|centre.?back|center.?back|central def)/.test(t)) return 'CB';
  if (/(\blb\b|\brb\b|wing.?back|full.?back|\bfb\b|left.?back|right.?back)/.test(t)) return 'FB';
  if (/(\bdm\b|cdm|defensive mid|anchor|regista|holding|destroyer)/.test(t)) return 'DM';
  if (/(\blw\b|\brw\b|\bwing|wide|inside forward)/.test(t)) return 'W';
  if (/(\bst\b|\bcf\b|striker|forward|\bfw\b|\bfwd\b|attacker|poacher|number 9|no\.?9)/.test(t)) return 'ST';
  if (/(\bam\b|attacking mid|playmaker|creator|number 10|no\.?10|second striker)/.test(t)) return 'AM';
  if (/(\bcm\b|midfield|box.?to.?box|number 8|no\.?8)/.test(t)) return 'CM';
  return 'CM';
}
function positionMultiplier(pos) { return POSITION_MULT[positionGroup(pos)] ?? 1.0; }

// ── 3) LEAGUE / CLUB MULTIPLIER ──────────────────────────────────────────────
// Elite five hand-pinned (0.05 steps; EPL carries the "tax"). Premium selling
// leagues (Brazil, Eredivisie) pinned above the tail. Genuine long tail decays
// ~0.05 per rung, floored at 0.40. NOTE: this multiplier captures BOTH "how rich
// is this market" and "how proven is this level" — league-JUMP risk is a separate
// term in the fit layer so they never double-count.
const LEAGUE_MULT = {
  'premier league': 1.00,
  'bundesliga': 0.85,
  'serie a': 0.80,
  'ligue 1': 0.75,
  'la liga': 0.70,
  'brasileirão série a': 0.55, 'brasileirao serie a': 0.55, 'brazilian série a': 0.55,
  'eredivisie': 0.50,
  'primeira liga': 0.50,
  'championship': 0.45,
  'belgian pro league': 0.40,
  // cup competitions (fallbacks when a domestic league isn't carried)
  'champions league': 0.80, 'europa league': 0.60, 'europa conference league': 0.45,
  // women's leagues are NOT calibrated in v1 — the men's base curve does not
  // transfer to the women's market. Treat these as placeholder until a separate
  // women's base curve exists.
  "women's super league": 0.25, 'liga f': 0.22, 'nwsl': 0.24, "women's champions league": 0.25,
};
const LEAGUE_FLOOR = 0.40;
const SUPERCLUB_FLOOR = 0.90; // prestige clubs escape their league's discount (floor, never a cap)
const SUPERCLUBS = [
  'real madrid', 'barcelona', 'bayern', 'paris saint-germain', 'paris sg', 'psg',
  'juventus', 'internazionale', 'inter milan', 'ac milan',
];
function leagueMultiplier(leagueRaw, clubRaw) {
  const league = String(leagueRaw || '').trim().toLowerCase();
  let mult = LEAGUE_MULT[league];
  if (mult == null) mult = 0.45; // unknown domestic league → modest mid-low default
  mult = Math.max(mult, LEAGUE_FLOOR);
  const club = String(clubRaw || '').trim().toLowerCase();
  if (club && SUPERCLUBS.some(s => club.includes(s))) {
    mult = Math.max(mult, SUPERCLUB_FLOOR); // lift up only, never drag down
  }
  return mult;
}

// ── 4) AGE MULTIPLIER ────────────────────────────────────────────────────────
// Steep: heavy youth premium, peak 24–26 = 1.00, sharp decline after 30.
const AGE_ANCHORS = [
  [19, 1.40], [22, 1.25], [24, 1.00], [26, 1.00], [28, 0.85], [30, 0.65], [32, 0.45], [34, 0.38],
];
function ageMultiplier(ageRaw) {
  const age = Number(ageRaw);
  if (!Number.isFinite(age)) return 1.0; // unknown age → neutral (confidence takes the hit)
  const a = AGE_ANCHORS;
  if (age <= a[0][0]) return a[0][1];
  if (age >= a[a.length - 1][0]) return a[a.length - 1][1];
  for (let i = 0; i < a.length - 1; i++) {
    if (age >= a[i][0] && age <= a[i + 1][0]) {
      const [x0, y0] = a[i], [x1, y1] = a[i + 1];
      return y0 + (age - x0) / (x1 - x0) * (y1 - y0);
    }
  }
  return 1.0;
}

// ── 5) RISK DISCOUNT (light in v1) ───────────────────────────────────────────
// Only the data we genuinely hold: thin minutes → a modest haircut. League-jump,
// injury and resale risk are richer terms for later / the fit layer.
function riskDiscount(player) {
  const mins = Number(player.minutes);
  let d = 0;
  if (Number.isFinite(mins)) {
    if (mins < 600) d += 0.10;
    else if (mins < 1200) d += 0.05;
  }
  return Math.min(d, 0.20);
}

// ── 6) CONFIDENCE ────────────────────────────────────────────────────────────
// Honesty layer: how much should anyone trust this number. Missing data lowers
// confidence rather than fabricating a value.
function confidence(player) {
  let c = 78;
  const drivers = [];
  if (!Number.isFinite(Number(player.age)))          { c -= 10; drivers.push(['Age data', 'Missing']); }
  else                                                 drivers.push(['Age data', 'Known']);
  if (!Number.isFinite(Number(player.minutes)))      { c -= 10; drivers.push(['Minutes sample', 'Unknown']); }
  else if (Number(player.minutes) < 600)             { c -= 12; drivers.push(['Minutes sample', 'Very thin']); }
  else if (Number(player.minutes) < 1200)            { c -= 6;  drivers.push(['Minutes sample', 'Medium']); }
  else                                                 drivers.push(['Minutes sample', 'Strong']);
  if (!player.hasContractData)                       { c -= 8;  drivers.push(['Contract data', 'Missing']); }
  else                                                 drivers.push(['Contract data', 'Known']);
  const leagueKnown = LEAGUE_MULT[String(player.league || '').trim().toLowerCase()] != null;
  if (!leagueKnown)                                  { c -= 7;  drivers.push(['League proof', 'Uncalibrated']); }
  else                                                 drivers.push(['League proof', 'Calibrated']);
  return { score: clamp(Math.round(c), 25, 92), drivers };
}

// ── 7) SCARCITY (drives the max sensible bid premium) ────────────────────────
function scarcity(player) {
  const g = positionGroup(player.position);
  const posS = ({ ST: 0.85, W: 0.75, AM: 0.75, CM: 0.50, FB: 0.45, CB: 0.45, DM: 0.40, GK: 0.30 })[g] ?? 0.5;
  const age = Number(player.age);
  const ageS = !Number.isFinite(age) ? 0.5
    : age <= 20 ? 1.0 : age <= 23 ? 0.8 : age <= 26 ? 0.6 : age <= 29 ? 0.4 : 0.2;
  const r = Number(player.rating) || 70;
  const ratS = r >= 88 ? 1.0 : r >= 85 ? 0.8 : r >= 80 ? 0.6 : r >= 75 ? 0.4 : 0.25;
  return clamp(0.40 * posS + 0.30 * ageS + 0.30 * ratS, 0, 1);
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
const round1 = (n) => Math.round(n * 10) / 10;

export function calibreValue(player = {}) {
  const rating = Number(player.rating) || 70;
  const posMult = positionMultiplier(player.position);
  const lgMult = leagueMultiplier(player.league, player.club);
  const ageMult = ageMultiplier(player.age);
  const risk = riskDiscount(player);

  // stack — each step's marginal € effect feeds the breakdown
  const base = curveBaseValue(rating);
  const afterPos = base * posMult;
  const afterLeague = afterPos * lgMult;
  const afterAge = afterLeague * ageMult;
  const value = afterAge * (1 - risk);

  const conf = confidence(player);
  const conf01 = conf.score / 100;
  const sc = scarcity(player);

  // fair range widens as confidence drops
  const lowBand = 0.85 - (1 - conf01) * 0.10;
  const highBand = 1.20 + (1 - conf01) * 0.10;
  const fairRange = { low: round1(value * lowBand), high: round1(value * highBand) };

  // max sensible bid: walk-away ceiling, scaled by scarcity (fit extends in Piece 2)
  const maxSensibleBid = round1(value * (1.20 + sc * 0.40));

  const breakdown = [
    factor('Performance Level', rating, base, 'Rating-derived base value'),
    factor('Position Scarcity', scoreFromMult(posMult, 0.55, 1.30), afterPos - base, positionGroup(player.position)),
    factor('League Strength', Math.round(lgMult * 100), afterLeague - afterPos, prettyLeague(player.league, player.club)),
    factor('Age Curve', scoreFromMult(ageMult, 0.38, 1.40), afterAge - afterLeague, Number.isFinite(Number(player.age)) ? `${player.age} yrs` : 'age unknown'),
    factor('Risk Discount', Math.round((1 - risk) * 100), value - afterAge, risk > 0 ? 'Thin sample' : 'No flags (v1)'),
    // v1 stubs — neutral € impact, surfaced so the card is complete and honest
    factor('Minutes / Sample', null, 0, sampleLabel(player.minutes), true),
    factor('International Status', null, 0, 'Not modelled (v1)', true),
    factor('Contract Leverage', null, 0, player.hasContractData ? 'Known' : 'Unknown — neutral', true),
    factor('Market Heat', null, 0, 'Not modelled (v1)', true),
  ];

  return {
    estimatedValue: round1(value),
    fairRange,
    maxSensibleBid,
    confidence: conf.score,
    confidenceDrivers: conf.drivers,
    scarcity: Math.round(sc * 100),
    breakdown,
    inputs: { rating, posMult, lgMult: round2(lgMult), ageMult: round2(ageMult), risk },
  };
}

// ── VERDICT (given an asking price) ──────────────────────────────────────────
// Club-agnostic verdict. Piece 2 adds fit-conditional outcomes (System Risk,
// Conditional Deal) once a buying club is selected.
export function valuationVerdict(v, askingPrice) {
  const ask = Number(askingPrice);
  if (!Number.isFinite(ask)) return { label: '—', tone: 'neutral', why: 'Enter an asking price.' };
  const { estimatedValue, fairRange, maxSensibleBid } = v;
  const premium = Math.round((ask / estimatedValue - 1) * 100);
  let label, tone;
  if (ask <= estimatedValue)        { label = 'VALUE BUY';     tone = 'good'; }
  else if (ask <= fairRange.high)   { label = 'FAIR DEAL';     tone = 'good'; }
  else if (ask <= maxSensibleBid)   { label = 'NEGOTIATE HARD';tone = 'warn'; }
  else                              { label = 'WALK AWAY';     tone = 'bad'; }
  const why = label === 'VALUE BUY' ? `Asking price is at or below Calibre's estimate (€${estimatedValue}m).`
    : label === 'FAIR DEAL' ? `Within the fair range (€${fairRange.low}m–€${fairRange.high}m).`
    : label === 'NEGOTIATE HARD' ? `Above fair value but under the €${maxSensibleBid}m walk-away — defensible only with conviction.`
    : `€${round1(ask - maxSensibleBid)}m above the €${maxSensibleBid}m max sensible bid. Premium of +${premium}% over Calibre value.`;
  return { label, tone, premium, why };
}

// ── helpers for the breakdown rows ───────────────────────────────────────────
function factor(name, score, impactM, note, stub = false) {
  return { name, score, impact: round1(impactM), note, stub };
}
function scoreFromMult(mult, min, max) { return clamp(Math.round((mult - min) / (max - min) * 100), 0, 100); }
function round2(n) { return Math.round(n * 100) / 100; }
function sampleLabel(mins) {
  const m = Number(mins);
  if (!Number.isFinite(m)) return 'Unknown';
  if (m < 600) return 'Very thin';
  if (m < 1200) return 'Medium';
  return 'Strong';
}
function prettyLeague(league, club) {
  const c = String(club || '').trim().toLowerCase();
  if (c && SUPERCLUBS.some(s => c.includes(s))) return `${league || 'league'} · superclub`;
  return league || 'unknown league';
}

// ── SELF-TEST: run `node calibreValue.js` to eyeball known players ────────────
const isMain = (() => {
  try { return import.meta.url === `file://${process.argv[1]}`; } catch { return false; }
})();
if (isMain) {
  const samples = [
    { name: 'Junior Kroupi (target)', rating: 81, age: 19, position: 'ST', league: 'Ligue 1', club: 'LOSC Lille', minutes: 1800, hasContractData: false },
    { name: 'Oyarzabal', rating: 67, age: 28, position: 'FW', league: 'La Liga', club: 'Real Sociedad', minutes: 2400, hasContractData: true },
    { name: 'Elite young ST (EPL)', rating: 88, age: 21, position: 'ST', league: 'Premier League', club: 'Arsenal', minutes: 2700, hasContractData: true },
    { name: 'Peak CM (EPL) ref', rating: 85, age: 24, position: 'CM', league: 'Premier League', club: 'Man City', minutes: 2700, hasContractData: true },
    { name: 'Top GK (Serie A)', rating: 86, age: 27, position: 'GK', league: 'Serie A', club: 'Inter Milan', minutes: 2700, hasContractData: true },
    { name: 'Aging CB (La Liga)', rating: 83, age: 31, position: 'CB', league: 'La Liga', club: 'Atletico', minutes: 2400, hasContractData: true },
    { name: 'Madrid winger (override)', rating: 87, age: 23, position: 'RW', league: 'La Liga', club: 'Real Madrid', minutes: 2500, hasContractData: true },
    { name: 'Eredivisie wonderkid', rating: 79, age: 18, position: 'AM', league: 'Eredivisie', club: 'Ajax', minutes: 1500, hasContractData: false },
    { name: 'Thin-sample teen (unknown mins)', rating: 80, age: 18, position: 'ST', league: 'Ligue 1', club: 'Monaco' },
  ];
  const pad = (s, n) => String(s).padEnd(n);
  console.log('\nCALIBRE VALUATION ENGINE v1 — self-test\n' + '─'.repeat(96));
  console.log(pad('Player', 32) + pad('Est', 8) + pad('Fair range', 16) + pad('MaxBid', 9) + pad('Conf', 6) + 'pos×lg×age');
  console.log('─'.repeat(96));
  for (const p of samples) {
    const v = calibreValue(p);
    const i = v.inputs;
    console.log(
      pad(p.name, 32) +
      pad(`€${v.estimatedValue}m`, 8) +
      pad(`€${v.fairRange.low}-${v.fairRange.high}m`, 16) +
      pad(`€${v.maxSensibleBid}m`, 9) +
      pad(`${v.confidence}`, 6) +
      `${i.posMult}×${i.lgMult}×${i.ageMult}`
    );
  }
  console.log('─'.repeat(96));
  // verdict demo on Kroupi at €100m
  const k = calibreValue(samples[0]);
  const verdict = valuationVerdict(k, 100);
  console.log(`\nKroupi @ €100m ask → ${verdict.label} (+${verdict.premium}%)\n  why: ${verdict.why}`);
  console.log('\nKroupi breakdown:');
  for (const f of k.breakdown) {
    const imp = f.impact > 0 ? `+€${f.impact}m` : f.impact < 0 ? `−€${Math.abs(f.impact)}m` : '—';
    console.log(`  ${pad(f.name, 22)} ${pad(f.score == null ? '·' : f.score + '/100', 9)} ${pad(imp, 9)} ${f.note}`);
  }
  console.log('');
}
