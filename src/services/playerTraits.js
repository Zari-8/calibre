// ─────────────────────────────────────────────────────────────────────────
// Calibre Trait Engine
//
// Turns a player's INDIVIDUAL statistics into the six tactical traits used by
// System Fit (control, transition, pressing, width, tempo, defensiveLoad),
// layered by position/archetype the way a FotMob profile layers per-90 stats by
// role. Two paths:
//
//   • 'event'      — when event-level stats are present (passes, pass accuracy,
//                    key passes, dribbles, tackles, interceptions, duels, shots),
//                    each trait is computed from the real numbers, normalised
//                    per-90 against a position benchmark.
//   • 'aggregate'  — fallback when only season aggregates exist (goals, assists,
//                    minutes, api rating). Position baseline tilted by output and
//                    quality. Clearly flagged so the UI can mark it provisional.
//
// Enrich the registry with the event columns below and every player upgrades to
// the 'event' path automatically — no code change required.
//   passes, pass_accuracy, key_passes, dribbles_success (or dribbles_attempts),
//   tackles, interceptions, duels_won, shots
// ─────────────────────────────────────────────────────────────────────────

const TRAIT_KEYS = ['control', 'transition', 'pressing', 'width', 'tempo', 'defensiveLoad'];

function num(v, d = 0) { const n = Number(v); return Number.isFinite(n) ? n : d; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function per90(v, minutes) { return minutes > 0 ? num(v) / (minutes / 90) : 0; }

// TheStatsAPI's mode-of-matches position (statsapi_position) and
// API-Football's per-competition position tag (api_position) are REAL
// measured behavior — what a player actually lined up as, not a stored
// label that can drift stale. Both are coarse (only Goalkeeper/Defender/
// Midfielder/Forward), so they can't replace the finer FB/DM/WIDE
// subdivisions below, but when they DISAGREE with the coarse group the text
// fields imply, the measured data wins over the label.
function coarseFromMeasured(player) {
  const raw = String(player.statsapi_position || player.api_position || '').toLowerCase();
  if (!raw) return null;
  if (/goalkeeper|^g$/.test(raw)) return 'GK';
  if (/defender|^d$/.test(raw)) return 'DEF';
  if (/midfielder|^m$/.test(raw)) return 'MID';
  if (/forward|attacker|^f$/.test(raw)) return 'ATT';
  return null;
}

// Which coarse group(s) each fine-grained text bucket is compatible with.
// WIDE is deliberately ambiguous — a winger can legitimately show up as
// either M or F in a 4-way feed — so it's never treated as conflicting
// with either.
const COARSE_COMPAT = {
  GK: ['GK'], FB: ['DEF'], DEF: ['DEF'], DM: ['MID'], MID: ['MID'],
  WIDE: ['MID', 'ATT'], ATT: ['ATT'],
};

function positionBucket(player) {
  // v2 bugfix — this used to fold player.archetype into the scanned text,
  // which made bucket detection circular: a stale/wrong LEGACY archetype
  // label (e.g. "Ball-Winning Defender" — not a real label this engine
  // produces) contained the word "defender" and hijacked the DEF check
  // before the DM check ever ran, misclassifying real defensive midfielders
  // (Rúben Neves) as centre-backs. Bucket must be derived only from actual
  // position fields, never from the archetype we're about to (re)compute.
  // Also now reads primary_role/raw_position — the cleaner, unabbreviated
  // fields ("Defensive Midfielder", "Attacker") — alongside the short ones.
  const t = `${player.role || ''} ${player.position || ''} ${player.pos || ''} ${player.primary_role || ''} ${player.raw_position || ''}`.toLowerCase();
  let textBucket = 'MID';
  if (/(goalkeeper|keeper|\bgk\b)/.test(t)) textBucket = 'GK';
  else if (/(wing.?back|full.?back|\brb\b|\blb\b|\brwb\b|\blwb\b)/.test(t)) textBucket = 'FB';
  else if (/(back|defender|centre.?back|center.?back|\bcb\b|\bdef\b)/.test(t)) textBucket = 'DEF';
  // RM/LM ("Right/Left Midfielder") is a real-world wide role, not a central
  // one — a player lined up there is functionally a winger. Previously only
  // rw/lw/"wing"/"winger" matched, so anyone tagged RM/LM (e.g. Saka) fell
  // through to the plain MID default and got scored as a Central
  // Midfielder/Mezzala candidate instead of a Winger/Inside Forward one.
  else if (/(wing|\brw\b|\blw\b|\brm\b|\blm\b|winger)/.test(t)) textBucket = 'WIDE';
  else if (/(forward|striker|\bcf\b|\bst\b|\bfwd\b|\batt\b|attacker|poacher)/.test(t)) textBucket = 'ATT';
  else if (/(defensive mid|\bdm\b|\bcdm\b|anchor|holding|ball-winning)/.test(t)) textBucket = 'DM';

  // v3 — v8.5 added real per-match/per-competition position feeds
  // (api_position, statsapi_position) this session, but nothing ever read
  // them for archetype purposes. Cross-check: if the measured coarse group
  // contradicts the text-derived bucket's coarse group, trust the measured
  // data — but only at the coarse level, since the finer subtype (FB/DM/
  // WIDE) came from the now-contradicted text and shouldn't be kept either.
  const measured = coarseFromMeasured(player);
  if (measured && !COARSE_COMPAT[textBucket].includes(measured)) return measured;
  return textBucket;
}

// Position baselines for the aggregate fallback (no event data).
const BASE = {
  GK:   { control: 68, transition: 38, pressing: 38, width: 28, tempo: 48, defensiveLoad: 86 },
  DEF:  { control: 76, transition: 60, pressing: 72, width: 46, tempo: 64, defensiveLoad: 92 },
  FB:   { control: 76, transition: 82, pressing: 80, width: 88, tempo: 78, defensiveLoad: 80 },
  DM:   { control: 88, transition: 68, pressing: 84, width: 56, tempo: 80, defensiveLoad: 88 },
  MID:  { control: 86, transition: 80, pressing: 80, width: 68, tempo: 84, defensiveLoad: 76 },
  WIDE: { control: 80, transition: 90, pressing: 72, width: 92, tempo: 88, defensiveLoad: 54 },
  ATT:  { control: 72, transition: 90, pressing: 66, width: 70, tempo: 88, defensiveLoad: 48 },
};

function hasEventStats(player) {
  return [
    player.passes, player.tackles, player.interceptions,
    player.key_passes ?? player.keyPasses,
    player.dribbles_success ?? player.dribbles_attempts ?? player.dribbles,
  ].some(v => v != null && Number(v) > 0);
}

// Position-average per-90 levels. A player AT their position average scores 50
// on that signal; double the average scores 100. This is what makes the traits
// position-relative the way FotMob percentiles are.
const AVG = {
  GK:   { passes: 28, key: 0.05, dribbles: 0.05, tackles: 0.10, inter: 0.20, duels: 0.8, shots: 0.0 },
  DEF:  { passes: 55, key: 0.30, dribbles: 0.40, tackles: 1.20, inter: 1.30, duels: 4.5, shots: 0.3 },
  FB:   { passes: 48, key: 0.90, dribbles: 1.00, tackles: 1.80, inter: 1.10, duels: 4.0, shots: 0.4 },
  DM:   { passes: 62, key: 0.80, dribbles: 0.70, tackles: 2.20, inter: 1.40, duels: 4.5, shots: 0.5 },
  MID:  { passes: 55, key: 1.30, dribbles: 1.00, tackles: 1.60, inter: 1.00, duels: 4.0, shots: 1.0 },
  WIDE: { passes: 38, key: 1.80, dribbles: 2.20, tackles: 1.00, inter: 0.50, duels: 4.5, shots: 2.0 },
  ATT:  { passes: 28, key: 1.30, dribbles: 1.60, tackles: 0.70, inter: 0.40, duels: 4.5, shots: 2.8 },
};

// Map a per-90 value to a 0-100 signal where the position average sits at 50.
function sig(value, average) {
  if (average > 0) return clamp(50 * value / average, 0, 100);
  return value > 0 ? 75 : 0; // stat irrelevant to the position (e.g. GK shots)
}

function eventTraits(player, bucket) {
  const m = num(player.stats_minutes ?? player.minutes ?? player.mins);
  const base = BASE[bucket];
  const avg = AVG[bucket];

  const passes90 = per90(player.passes, m);
  const passAcc = num(player.pass_accuracy ?? player.passAccuracy);
  const key90 = per90(player.key_passes ?? player.keyPasses, m);
  const drib90 = per90(player.dribbles_success ?? player.dribbles ?? player.dribbles_attempts, m);
  const tack90 = per90(player.tackles, m);
  const int90 = per90(player.interceptions, m);
  const duel90 = per90(player.duels_won ?? player.duelsWon, m);
  const shots90 = per90(player.shots ?? player.shots_total, m);

  // pass accuracy on its own scale: 60% → 0, 92% → 100
  const accScore = clamp(((passAcc || 78) - 60) / (92 - 60) * 100, 0, 100);

  // Per-trait signals, 50 = positional average. (No goals/assists here — those
  // aren't season-aligned with the event columns, so the event path stays on
  // the enriched per-90 stats only: passes, dribbles, shots, tackles, etc.)
  const controlSig    = 0.60 * sig(passes90, avg.passes) + 0.40 * accScore;
  const transitionSig = 0.55 * sig(drib90, avg.dribbles) + 0.45 * sig(shots90, avg.shots);
  const pressingSig   = 0.55 * sig(tack90, avg.tackles) + 0.45 * sig(int90, avg.inter);
  const widthSig      = 0.60 * sig(drib90, avg.dribbles) + 0.40 * sig(key90, avg.key);
  const tempoSig      = 0.55 * sig(passes90, avg.passes) + 0.45 * sig(drib90, avg.dribbles);
  const defSig        = 0.40 * sig(tack90, avg.tackles) + 0.35 * sig(int90, avg.inter) + 0.25 * sig(duel90, avg.duels);

  // Anchor on the role baseline, then let the individual signal move it ±~22.
  const mod = (b, s, k = 0.45) => b + (s - 50) * k;
  return {
    control: mod(base.control, controlSig),
    transition: mod(base.transition, transitionSig),
    pressing: mod(base.pressing, pressingSig),
    width: mod(base.width, widthSig),
    tempo: mod(base.tempo, tempoSig),
    defensiveLoad: mod(base.defensiveLoad, defSig),
  };
}

function aggregateTraits(player, bucket) {
  const m = num(player.minutes ?? player.mins);
  const ga90 = per90(num(player.goals) + num(player.assists), m);
  const apiR = num(player.api_average_rating ?? player.apiRating);
  const quality = apiR > 0 ? clamp((apiR - 5.8) / (8.4 - 5.8) * 100, 0, 100) : 55;
  const base = BASE[bucket];
  const expected = bucket === 'ATT' || bucket === 'WIDE' ? 0.9 : bucket === 'MID' || bucket === 'FB' ? 0.45 : 0.22;
  const outTilt = clamp((ga90 / expected) * 14 - 7, -9, 16);
  const qTilt = (quality - 55) * 0.12;
  const attacking = bucket === 'ATT' || bucket === 'WIDE';
  return {
    control: base.control + qTilt,
    transition: base.transition + (bucket === 'DEF' ? outTilt * 0.4 : outTilt) + qTilt * 0.5,
    pressing: base.pressing + qTilt * 0.4,
    width: base.width + (attacking ? outTilt * 0.6 : 0),
    tempo: base.tempo + outTilt * 0.4 + qTilt * 0.4,
    defensiveLoad: base.defensiveLoad - (attacking ? outTilt * 0.3 : 0),
  };
}

function roleMetricsFrom(t) {
  return {
    Positioning: Math.round((t.control + t.defensiveLoad) / 2),
    'Decision making': Math.round((t.control + t.tempo) / 2),
    'Link-up play': Math.round((t.control + t.width) / 2),
    'Final-third impact': Math.round((t.transition + t.width) / 2),
    'Press resistance': Math.round((t.control + t.pressing) / 2),
    'Transition contribution': Math.round(t.transition),
  };
}

export function playerTraits(player = {}) {
  const bucket = positionBucket(player);
  const minutes = num(player.stats_minutes ?? player.minutes ?? player.mins);
  const event = hasEventStats(player) && minutes > 0;
  const raw = event ? eventTraits(player, bucket) : aggregateTraits(player, bucket);
  const traits = {};
  for (const k of TRAIT_KEYS) traits[k] = clamp(Math.round(raw[k]), 0, 99);
  return { traits, roleMetrics: roleMetricsFrom(traits), basis: event ? 'event' : 'aggregate', bucket };
}

// v3 — each label now names 2-3 DEFINING traits instead of one. The old
// design picked whichever single trait had the largest delta above the
// position baseline and looked up one label for it — which meant a small,
// possibly noisy edge on ONE trait could decide the label even when it
// wasn't really the player's standout skill (e.g. Rashford's control delta
// edging out everything else landed him on "False Nine" despite a real
// transition/width/pressing profile that's textbook Inside Forward — the
// "least-worst trait" problem). Now every candidate label is scored by the
// AVERAGE delta across its own defining traits, so a label only wins when
// several of its real requirements are actually met, not just one. Several
// labels below already had multiple traits independently triggering them
// in the old single-key map (e.g. ATT's Advanced Forward: transition OR
// width OR pressing) — those are simply grouped into one signature here.
const ARCHETYPE_LABELS = {
  GK: {
    labels: [
      { name: 'Sweeper Keeper', traits: ['control', 'tempo'] },
    ],
    default: 'Shot-Stopper',
  },
  DEF: {
    labels: [
      { name: 'Ball-Playing Defender', traits: ['control', 'transition'] },
      { name: 'Stopper', traits: ['pressing', 'defensiveLoad'] },
    ],
    default: 'Stopper',
  },
  FB: {
    labels: [
      { name: 'Wing-Back', traits: ['width', 'transition'] },
      { name: 'Inverted Full-Back', traits: ['control', 'tempo'] },
    ],
    default: 'Full-Back',
  },
  DM: {
    labels: [
      { name: 'Deep-Lying Playmaker', traits: ['control', 'tempo'] },
      { name: 'Ball-Winning Midfielder', traits: ['pressing', 'defensiveLoad'] },
      { name: 'Anchor', traits: ['defensiveLoad'] },
    ],
    default: 'Holding Midfielder',
  },
  MID: {
    labels: [
      { name: 'Deep-Lying Playmaker', traits: ['control', 'defensiveLoad'] },
      { name: 'Box-to-Box Midfielder', traits: ['transition', 'pressing', 'tempo'] },
      { name: 'Ball-Winning Midfielder', traits: ['pressing', 'defensiveLoad'] },
      { name: 'Mezzala', traits: ['width', 'transition'] },
      { name: 'Advanced Playmaker', traits: ['tempo', 'transition'] },
    ],
    default: 'Central Midfielder',
  },
  WIDE: {
    labels: [
      { name: 'Winger', traits: ['width', 'transition'] },
      { name: 'Inside Forward', traits: ['control', 'tempo'] },
    ],
    default: 'Winger',
  },
  ATT: {
    labels: [
      { name: 'Advanced Forward', traits: ['transition', 'width', 'pressing'] },
      { name: 'False Nine', traits: ['control', 'pressing'] },
      { name: 'Second Striker', traits: ['tempo', 'transition'] },
      { name: 'Target Man', traits: ['defensiveLoad', 'control'] },
    ],
    default: 'Poacher',
  },
};

export function deriveArchetype(player = {}) {
  const { traits, bucket } = playerTraits(player);
  const base = BASE[bucket] || BASE.MID;
  const config = ARCHETYPE_LABELS[bucket] || ARCHETYPE_LABELS.MID;

  let best = null;
  let bestScore = -Infinity;
  for (const label of config.labels) {
    const deltas = label.traits.map((k) => traits[k] - (base[k] ?? 70));
    const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    // Coverage bonus — plain averaging structurally punishes labels that
    // require MORE corroborating traits: a 3-trait signature only wins if
    // ALL three legs are strong, but averaging means a weaker third leg
    // drags it below a 2-trait label that gets to cherry-pick just its best
    // two legs from the same trait pool. Made worse by real correlation in
    // the underlying formulas — transition/width/tempo all partly derive
    // from the same dribbles-carrying signal (drib90), so Mezzala
    // (width+transition) rides that correlation and out-scored Box-to-Box
    // Midfielder (transition+pressing+tempo) even for a genuinely elite,
    // defensively-strong box-to-box profile, since Mezzala never has to
    // clear the less-correlated `pressing` leg at all. +2/extra-trait wasn't
    // enough to overcome that; +4 was verified (synthetic profile sweep:
    // pure destroyer/genuine box-to-box/moderate box-to-box/pure creator)
    // to correctly separate Ball-Winning Midfielder (pressing alone) from
    // Box-to-Box (pressing AND transition/tempo together) without wrongly
    // promoting a pure creator with weak pressing.
    const score = avg + (label.traits.length - 2) * 4;
    if (score > bestScore) { bestScore = score; best = label.name; }
  }
  // Same >3 bar as before — a label only overrides the position default
  // when its defining traits, averaged (plus coverage bonus), clear a real
  // threshold.
  return best && bestScore > 3 ? best : config.default;
}

export default playerTraits;
