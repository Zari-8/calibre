// ─────────────────────────────────────────────────────────────────────────
// Calibre Rating Engine  (v1)
//
// One pure function that turns a stored player row into a single 0–99 Calibre
// rating plus a 5-part breakdown, so every page (Players, Talents, Home,
// Competitions) reads the SAME number for the same player.
//
// Weighting (from calibreData.ratingFormula):
//   Performance 35 · Consistency 20 · Form 20 · Impact 15 · Trajectory 10
//
// Honest data note: rows are season/career AGGREGATES. Performance,
// Consistency and Trajectory are computed from real columns. Form and Impact
// have no per-match source yet, so v1 uses transparent proxies (flagged via
// `provisional`) and will be replaced once event data is ingested.
// ─────────────────────────────────────────────────────────────────────────

const WEIGHTS = { Performance: 0.35, Consistency: 0.20, Form: 0.20, Impact: 0.15, Trajectory: 0.10 };

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function num(v, d = 0) { const n = Number(v); return Number.isFinite(n) ? n : d; }

// League strength. 1.00 = elite benchmark. Used to discount raw output so a
// 7.5 in a weaker league is not equal to a 7.5 in La Liga. Penalty is SOFTENED
// (see effectiveLeague) so discovery-league talent is not crushed to nothing.
const LEAGUE_STRENGTH = {
  'la liga': 1.00, 'premier league': 1.00, 'bundesliga': 0.98, 'serie a': 0.96, 'ligue 1': 0.92,
  'primeira liga': 0.86, 'eredivisie': 0.85, 'liga portugal': 0.86,
  'championship': 0.82, 'belgian pro league': 0.82, 'jupiler pro league': 0.82, 'pro league': 0.82,
  'super lig': 0.80, 'süper lig': 0.80, 'saudi pro league': 0.80, 'brazil serie a': 0.84,
  'brasileiro': 0.84, 'serie a brazil': 0.84, 'mls': 0.74, 'j-league': 0.74, 'j1 league': 0.74,
  '2. bundesliga': 0.70, 'bundesliga 2': 0.70, 'serie b': 0.70, 'la liga 2': 0.70, 'segunda': 0.70,
  'eerste divisie': 0.62, 'national league': 0.55,
  'uruguay primera': 0.72, 'ekstraklasa': 0.70, 'qatar stars league': 0.66,
  'ligue 2': 0.68, 'npfl': 0.62, 'zimbabwe psl': 0.55,
};
const DEFAULT_LEAGUE = 0.75;

function leagueStrength(league = '') {
  const key = String(league).trim().toLowerCase();
  if (LEAGUE_STRENGTH[key] != null) return LEAGUE_STRENGTH[key];
  for (const name in LEAGUE_STRENGTH) if (key.includes(name)) return LEAGUE_STRENGTH[name];
  return DEFAULT_LEAGUE;
}
// Soften the multiplier so weaker leagues are discounted, not erased.
function effectiveLeague(strength) { return 1 - (1 - strength) * 0.55; }

// Position bucket from any of role / position / archetype.
function positionBucket(player) {
  const text = `${player.role || ''} ${player.position || ''} ${player.archetype || ''} ${player.pos || ''}`.toLowerCase();
  if (/(goalkeeper|keeper|\bgk\b)/.test(text)) return 'GK';
  if (/(defender|centre.?back|center.?back|full.?back|wing.?back|\bcb\b|\brb\b|\blb\b|\bdef\b)/.test(text)) return 'DEF';
  if (/(striker|forward|winger|wide creator|wide forward|attack|\bst\b|\brw\b|\blw\b|\bcf\b|inside forward|poacher|fox)/.test(text)) return 'ATT';
  return 'MID';
}

// Per-bucket "good" benchmark for goal involvement per 90 (G+A per 90).
const GA90_BENCHMARK = { ATT: 0.60, MID: 0.42, DEF: 0.20, GK: 0.10 };
// How much end-product matters to the Performance score per bucket.
const OUTPUT_WEIGHT  = { ATT: 0.55, MID: 0.42, DEF: 0.22, GK: 0.10 };

// Map an api average match rating (≈5.8–8.5) onto 0–100.
function qualityFromApi(r) { return clamp(((r - 5.8) / (8.4 - 5.8)) * 100, 0, 100); }

export function calibreRating(player = {}) {
  const minutes = num(player.minutes ?? player.mins);
  const apps    = num(player.appearances ?? player.apps);
  const starts  = num(player.starts);
  const goals   = num(player.goals);
  const assists = num(player.assists);
  const apiR    = num(player.api_average_rating ?? player.apiAverageRating ?? player.apiRating);
  const age     = num(player.age, 0);
  const bucket  = positionBucket(player);
  const lg      = effectiveLeague(leagueStrength(player.league));

  // If a real Calibre rating is already stored, trust it (model has run).
  const stored = num(player.rating);
  // If there is essentially no evidence, signal "not ratable yet".
  const hasEvidence = minutes > 0 || apps > 0 || apiR > 0;
  if (!hasEvidence && !(stored > 0)) {
    return { rating: null, breakdown: null, confidence: 'none', provisional: true };
  }

  const per90 = minutes > 0 ? minutes / 90 : 0;
  const ga90  = per90 > 0 ? (goals + assists) / per90 : 0;
  const g90   = per90 > 0 ? goals / per90 : 0;
  const startRate = apps > 0 ? starts / apps : (minutes > 0 ? 0.7 : 0);
  const minsPerApp = apps > 0 ? minutes / apps : 0;

  const quality = apiR > 0 ? qualityFromApi(apiR) : 50; // 0–100

  // Goalkeepers can't be judged on outfield output, and we don't yet ingest
  // keeper stats (saves, clean sheets, goals prevented). So GK rating is
  // quality-led (league-discounted api rating) with a light reliability factor,
  // and stays flagged provisional until keeper data exists — rather than letting
  // the outfield model inflate every regular keeper into the mid-80s.
  if (bucket === 'GK') {
    const startScoreGk = clamp(startRate * 100, 0, 100);
    const loadScoreGk = clamp((minsPerApp / 90) * 100, 0, 100);
    const reliability = startScoreGk * 0.6 + loadScoreGk * 0.4;
    const gk = clamp(Math.round(44 + (quality * lg) * 0.42 + (reliability - 50) * 0.12), 1, 92);
    return {
      rating: stored > 0 ? stored : gk,
      computed: gk,
      breakdown: {
        Performance: Math.round(quality * lg),
        Consistency: Math.round(reliability),
        Form: Math.round(quality * lg),
        Impact: Math.round(quality * lg),
        Trajectory: age > 0 ? Math.round(clamp(48 + clamp((24 - age) / 7, 0, 1) * 40, 0, 100)) : 55,
      },
      bucket, confidence: apiR > 0 ? 'low' : 'none', provisional: true,
    };
  }

  const benchmark = GA90_BENCHMARK[bucket];
  const outputRaw = clamp((ga90 / benchmark) * 60, 0, 100); // 60 = "at benchmark"
  const output = outputRaw * lg; // discount output by league strength

  // 1) PERFORMANCE — quality blended with role-relative, league-adjusted output.
  const ow = OUTPUT_WEIGHT[bucket];
  const Performance = clamp((quality * lg) * (1 - ow) + output * ow, 0, 100);

  // 2) CONSISTENCY — reliability: regular starter + full-game minutes load.
  const startScore = clamp(startRate * 100, 0, 100);
  const loadScore  = clamp((minsPerApp / 90) * 100, 0, 100);
  const Consistency = clamp(startScore * 0.6 + loadScore * 0.4, 0, 100);

  // 3) FORM — PROXY (no per-match data): season quality stands in for recent
  // form, league-discounted so an inflated lower-league average isn't elite form.
  const Form = clamp(quality * lg, 0, 100);

  // 4) IMPACT — PROXY (no clutch data): end-product rate, league-adjusted.
  // Attackers/wingers are judged on end product; defenders on league-adjusted
  // quality; deep midfielders get a quality floor so a low-output controller
  // isn't zeroed. (Goalkeepers handled in their own path above.)
  let impactRaw;
  if (bucket === 'DEF') {
    impactRaw = quality;
  } else {
    const outputImpact = clamp((ga90 / (benchmark * 1.15)) * 65, 0, 100);
    impactRaw = bucket === 'MID' ? Math.max(outputImpact, quality * 0.55) : outputImpact;
  }
  const Impact = clamp(impactRaw * lg, 0, 100);

  // 5) TRAJECTORY — youth curve crossed with current level. Younger + good = steep.
  const youth = clamp((24 - age) / (24 - 17), 0, 1); // age17→1, age24+→0
  const Trajectory = age > 0
    ? clamp(48 + youth * 44 + (quality - 50) * 0.12, 0, 100)
    : 55;

  const breakdown = {
    Performance: Math.round(Performance),
    Consistency: Math.round(Consistency),
    Form: Math.round(Form),
    Impact: Math.round(Impact),
    Trajectory: Math.round(Trajectory),
  };

  const weighted =
    Performance * WEIGHTS.Performance +
    Consistency * WEIGHTS.Consistency +
    Form * WEIGHTS.Form +
    Impact * WEIGHTS.Impact +
    Trajectory * WEIGHTS.Trajectory;

  // Map the 0–100 weighted blend onto the 0–99 display band. The blend tends to
  // sit ~35–80, so we stretch it gently to a footballing 50–95 feel.
  const computed = clamp(Math.round(38 + weighted * 0.62), 1, 99);

  const rating = stored > 0 ? stored : computed;
  const confidence = apiR > 0 && minutes > 0 ? 'high' : minutes > 0 || apps > 0 ? 'medium' : 'low';

  return {
    rating,
    computed,
    breakdown,
    bucket,
    confidence,
    // Form & Impact are proxied until per-match data exists.
    provisional: !(stored > 0),
  };
}

export default calibreRating;
