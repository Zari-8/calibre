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

function positionBucket(player) {
  const t = `${player.role || ''} ${player.position || ''} ${player.archetype || ''} ${player.pos || ''}`.toLowerCase();
  if (/(goalkeeper|keeper|\bgk\b)/.test(t)) return 'GK';
  if (/(wing.?back|full.?back|\brb\b|\blb\b|\brwb\b|\blwb\b)/.test(t)) return 'FB';
  if (/(back|defender|centre.?back|center.?back|\bcb\b|\bdef\b)/.test(t)) return 'DEF';
  if (/(wing|\brw\b|\blw\b|winger)/.test(t)) return 'WIDE';
  if (/(forward|striker|\bcf\b|\bst\b|attacker|poacher)/.test(t)) return 'ATT';
  if (/(defensive mid|\bdm\b|\bcdm\b|anchor|holding|ball-winning)/.test(t)) return 'DM';
  return 'MID';
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

// Map a player's standout trait (vs their position baseline) to an individual
// archetype label, so registry players stop sharing one label per position.
const ARCHETYPE_LABELS = {
  GK:   { map: { control: 'Sweeper Keeper' }, default: 'Shot Stopper' },
  DEF:  { map: { control: 'Ball-Playing Defender', transition: 'Stepping-Out Defender', pressing: 'Front-Foot Stopper', defensiveLoad: 'Anchor Defender' }, default: 'Stopper' },
  FB:   { map: { width: 'Overlapping Full-Back', transition: 'Flying Full-Back', control: 'Inverted Full-Back', defensiveLoad: 'Defensive Full-Back', pressing: 'Pressing Full-Back' }, default: 'Full-Back' },
  DM:   { map: { control: 'Deep-Lying Playmaker', tempo: 'Tempo Controller', defensiveLoad: 'Anchor', pressing: 'Ball-Winner' }, default: 'Holding Midfielder' },
  MID:  { map: { control: 'Tempo Controller', transition: 'Box-to-Box', pressing: 'Ball-Winner', width: 'Wide Mover', tempo: 'Playmaker' }, default: 'Central Midfielder' },
  WIDE: { map: { width: 'Touchline Winger', transition: 'Direct Winger', control: 'Inside Creator', pressing: 'Pressing Winger', tempo: 'Roaming Winger' }, default: 'Wide Outlet' },
  ATT:  { map: { transition: 'Transition Forward', width: 'Wide Forward', control: 'Link Forward', tempo: 'Movement Forward', pressing: 'Pressing Forward' }, default: 'Poacher' },
};

export function deriveArchetype(player = {}) {
  const { traits, bucket } = playerTraits(player);
  const base = BASE[bucket] || BASE.MID;
  const labels = ARCHETYPE_LABELS[bucket] || ARCHETYPE_LABELS.MID;
  let bestKey = null;
  let bestDelta = -Infinity;
  for (const k of TRAIT_KEYS) {
    if (!labels.map[k]) continue;
    const delta = traits[k] - (base[k] ?? 70);
    if (delta > bestDelta) { bestDelta = delta; bestKey = k; }
  }
  return bestKey && bestDelta > 3 ? labels.map[bestKey] : labels.default;
}

export default playerTraits;
