// ============================================================
// backtestRealData.mjs — DEF/FB/DM/MID/WIDE backtest using ACTUAL per-90
// event stats pulled from the registry (see backtestDataPull3.mjs output),
// run through the real playerTraits() event-stat path (not hand-approximated
// vectors), then through fitDetail()/buildSystemFitReport() exactly as the
// live app does.
//
// Methodology note: for players who actually transferred, we use their
// PRE-move stat line (their traits BEFORE arriving at the destination) as
// the input, and score it against the destination club — so the model isn't
// being fed post-move data that's already shaped by the new environment.
// Bellingham is the clean case: his real Dortmund-era (age 20) stats are
// scored against Real Madrid, and compared against the extremely
// well-documented real outcome (immediate, historic success).
//
// For players who haven't transferred, we test their real current traits
// against a club they're NOT at, purely to sanity-check the formula's
// behaviour on a genuine measured vector — not a transfer prediction.
//
// Run from repo root: node scripts/backtestRealData.mjs
// ============================================================

import { playerTraits } from '../src/services/playerTraits.js';
import { fitDetail, SYSTEM_TEAMS } from '../src/data/systemFitData.js';

function team(name) {
  const t = SYSTEM_TEAMS.find(t => t.name === name);
  if (!t) throw new Error(`Team not found in SYSTEM_TEAMS: ${name}`);
  return t;
}

// Man Utd / West Ham / Everton aren't in the hand-authored 54 (only reachable
// via derived_team_profiles in prod, which this sandbox can't query) — these
// three are REPRESENTATIVE approximations of their real 2025/26 tactical
// identity, not measured data. Flagged wherever used below.
const REPRESENTATIVE_TEAMS = {
  'Manchester United': { name: 'Manchester United', short: 'Man Utd', formation: '3-4-3', philosophy: 'Possession rebuild (representative, not measured)', traits: { control: 78, transition: 76, pressing: 74, width: 70, tempo: 76, defensiveLoad: 68 } },
  'West Ham': { name: 'West Ham', short: 'West Ham', formation: '4-2-3-1', philosophy: 'Direct counter-transition (representative, not measured)', traits: { control: 62, transition: 78, pressing: 68, width: 72, tempo: 72, defensiveLoad: 74 } },
  'Everton': { name: 'Everton', short: 'Everton', formation: '4-4-2', philosophy: 'Compact low block (representative, not measured)', traits: { control: 58, transition: 62, pressing: 66, width: 54, tempo: 58, defensiveLoad: 84 } },
};

function run(label, rawPlayer, destTeamName, { origin = null, expectReal } = {}) {
  const { traits, bucket, basis } = playerTraits(rawPlayer);
  const destTeam = SYSTEM_TEAMS.find(t => t.name === destTeamName) || REPRESENTATIVE_TEAMS[destTeamName];
  const player = { name: rawPlayer.name, position: rawPlayer.position, traits, roleMetrics: {}, team: origin || destTeamName };
  const detail = fitDetail(player, destTeam, true);
  console.log(`\n[${label}]`);
  console.log(`  bucket=${bucket} basis=${basis} traits=${JSON.stringify(traits)}`);
  console.log(`  vs ${destTeamName}: score=${detail.score} rawAlignment=${detail.rawAlignment} nativeClub=${detail.nativeClub} specialist=${detail.specialistProfile}`);
  if (expectReal) console.log(`  real-world outcome: ${expectReal}`);
  return detail;
}

console.log('=== DEF ===');
run('Van Dijk @ Liverpool (native, still elite CB, age 34)', {
  name: 'Van Dijk', position: 'CB', minutes: 4958, passes: 3919, pass_accuracy: 88.8,
  key_passes: 19, dribbles_success: 2, dribbles_attempts: 4, tackles: 29, interceptions: 42,
  duels_won: 277, shots: 41,
}, 'Liverpool', { expectReal: 'Still first-choice, captain-level CB at 34 — real-world consensus is he remains an elite fit for Liverpool\'s system.' });

run('Kim Min-Jae @ Bayern (current) tested vs Napoli (his old title-winning club)', {
  name: 'Kim Min-Jae', position: 'CB', minutes: 2068, passes: 2239, pass_accuracy: 93.6,
  key_passes: 7, dribbles_success: 1, dribbles_attempts: 3, tackles: 27, interceptions: 47,
  duels_won: 94, shots: 6,
}, 'Napoli', { origin: 'Bayern München', expectReal: 'Real-world: Kim was Serie A Defender of the Year at Napoli in a title-winning season — reverse check on whether his current (Bayern-era) trait profile would still read as a fit there.' });

run('Kim Min-Jae @ Bayern (native, current)', {
  name: 'Kim Min-Jae', position: 'CB', minutes: 2068, passes: 2239, pass_accuracy: 93.6,
  key_passes: 7, dribbles_success: 1, dribbles_attempts: 3, tackles: 27, interceptions: 47,
  duels_won: 94, shots: 6,
}, 'Bayern München');

run('Marquinhos @ PSG (native, long-tenure captain, elite CB)', {
  name: 'Marquinhos', position: 'CB', minutes: 2991, passes: 2490, pass_accuracy: 87.4,
  key_passes: 10, dribbles_success: 6, dribbles_attempts: 6, tackles: 36, interceptions: 22,
  duels_won: 127, shots: 11,
}, 'Paris Saint-Germain', { expectReal: 'Real-world: still PSG captain and first-choice CB — clean elite native-fit case.' });

console.log('\n=== FB ===');
run('Wan-Bissaka @ West Ham (destination, real 2026 transfer)', {
  name: 'Wan-Bissaka', position: 'RB', minutes: 2684, passes: 1005, pass_accuracy: 76.8,
  key_passes: 23, dribbles_success: 22, dribbles_attempts: 48, tackles: 38, interceptions: 49,
  duels_won: 107, shots: 0,
}, 'West Ham', { origin: 'Manchester United', expectReal: 'Real move: Man Utd -> West Ham this window, after losing his Old Trafford starting spot.' });

console.log('\n=== DM ===');
run('Casemiro @ Man Utd (native, decline-era, age 33)', {
  name: 'Casemiro', position: 'DM', minutes: 2992, passes: 1920, pass_accuracy: 75.8,
  key_passes: 43, dribbles_success: 10, dribbles_attempts: 21, tackles: 103, interceptions: 34,
  duels_won: 211, shots: 41,
}, 'Manchester United', { expectReal: 'Real-world: mixed/declining reviews at Man Utd — still starts, but no longer the dominant Real Madrid-era destroyer.' });

run('Casemiro @ Man Utd (current traits) tested vs Real Madrid (his real former club)', {
  name: 'Casemiro', position: 'DM', minutes: 2992, passes: 1920, pass_accuracy: 75.8,
  key_passes: 43, dribbles_success: 10, dribbles_attempts: 21, tackles: 103, interceptions: 34,
  duels_won: 211, shots: 41,
}, 'Real Madrid', { origin: 'Manchester United', expectReal: 'Would his CURRENT (declined) trait profile still read as a fit for the club where he was genuinely elite?' });

console.log('\n=== MID ===');
run('Bellingham @ Dortmund (age 20, PRE-move) tested vs Real Madrid', {
  name: 'Bellingham', position: 'CM', minutes: 3137, passes: 1712, pass_accuracy: 88,
  key_passes: 21, dribbles_success: 29, dribbles_attempts: 52, tackles: 68, interceptions: 49,
  duels_won: 173, shots: 23,
}, 'Real Madrid', { origin: 'Borussia Dortmund', expectReal: 'REAL, well-documented outcome: immediate historic success at Real Madrid (Ballon d\'Or runner-up level debut season) — the single cleanest real transfer-fit case available.' });

run('Bellingham @ Real Madrid (native, current, age 22)', {
  name: 'Bellingham', position: 'CM', minutes: 3164, passes: 1791, pass_accuracy: 89,
  key_passes: 59, dribbles_success: 60, dribbles_attempts: 105, tackles: 89, interceptions: 26,
  duels_won: 274, shots: 46,
}, 'Real Madrid');

run('Pedri @ Barcelona (native, elite deep creator)', {
  name: 'Pedri', position: 'CM', minutes: 3098, passes: 2956, pass_accuracy: 90.1,
  key_passes: 82, dribbles_success: 46, dribbles_attempts: 79, tackles: 74, interceptions: 33,
  duels_won: 206, shots: 20,
}, 'FC Barcelona', { expectReal: 'Real-world: undisputed Barcelona first-choice, one of Europe\'s best deep creators — clean elite native case.' });

run('De Bruyne @ Napoli (current, post Man City exit) tested vs Man City (origin)', {
  name: 'De Bruyne', position: 'AM', minutes: 1360, passes: 819, pass_accuracy: 83.4,
  key_passes: 41, dribbles_success: 13, dribbles_attempts: 19, tackles: 16, interceptions: 6,
  duels_won: 41, shots: 22,
}, 'Manchester City', { origin: 'Napoli', expectReal: 'Real-world: City let him leave as his influence/minutes declined with age — reverse check on whether his current (reduced) trait profile still reads as a City fit.' });

console.log('\n=== WIDE ===');
run('Grealish @ Everton (destination, real 2025 loan/decline move) tested vs Man City (origin)', {
  name: 'Grealish', position: 'AM', minutes: 1885, passes: 700, pass_accuracy: 83.6,
  key_passes: 46, dribbles_success: 24, dribbles_attempts: 62, tackles: 21, interceptions: 14,
  duels_won: 119, shots: 21,
}, 'Manchester City', { origin: 'Everton', expectReal: 'Real-world: lost his City starting spot before the Everton move — reverse check on whether his current trait profile still reads as a City fit (should show meaningful drift/gap, not a strong match).' });

run('Grealish @ Everton (destination, native-now)', {
  name: 'Grealish', position: 'AM', minutes: 1885, passes: 700, pass_accuracy: 83.6,
  key_passes: 46, dribbles_success: 24, dribbles_attempts: 62, tackles: 21, interceptions: 14,
  duels_won: 119, shots: 21,
}, 'Everton');

run('Nico Williams @ Athletic Club (native, current — no real transfer, hypothetical only) tested vs FC Barcelona', {
  name: 'Nico Williams', position: 'LW', minutes: 2126, passes: 712, pass_accuracy: 77.3,
  key_passes: 43, dribbles_success: 75, dribbles_attempts: 173, tackles: 23, interceptions: 9,
  duels_won: 151, shots: 43,
}, 'FC Barcelona', { origin: 'Athletic Club', expectReal: 'NO real transfer happened — this is a hypothetical rumoured destination only, not a verified outcome.' });
