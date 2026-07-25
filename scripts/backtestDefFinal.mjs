// ============================================================
// backtestDefFinal.mjs — corrected, complete rerun of the DEF weighting
// backtest. Rounds 1 and 2 each accidentally omitted some fields
// productionComponents('DEF') actually reads (round 1 skipped duels_total;
// round 2 skipped ground_duel_win_pct/aerial_duel_win_pct/duels_total
// entirely), which forced some players onto the crude raw-tackle-count
// fallback in the SCRIPT even though the real app would have used the
// win-rate-blended path (duelQualityScore) for them. Cristian Romero's
// alarming defend=116.1 in round 2 was exactly this — an artifact of an
// incomplete query, not his real number.
//
// This selects every field the DEF formula touches in one query, so the
// defend/build/prog/att breakdown printed here matches what the live app
// actually computes.
//
// Run this LOCALLY (sandbox has no live network egress to Supabase).
// USAGE:
//   cd ~/Desktop/calibre-github
//   node scripts/backtestDefFinal.mjs
// Paste the FULL console output back into the chat.
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const f of ['.env', '.env.local']) {
  const p = join(ROOT, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const [k, ...r] = t.split('=');
    process.env[k.trim()] ??= r.join('=').trim().replace(/^["']|["']$/g, '');
  }
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const sb = createClient(url, key, { auth: { persistSession: false } });

const { productionComponents, resolveRating } = await import('../src/services/calibreRating.js');
const { deriveArchetype } = await import('../src/services/playerTraits.js');

// Every field productionComponents('DEF') and duelQualityScore/dribbleScore/
// territorialIndex/defensiveExtrasNudge touch — the full real input set,
// not a partial guess.
const RAW_FIELDS = [
  'name', 'full_name', 'team', 'club', 'league_id', 'minutes', 'stats_minutes', 'appearances',
  'passes', 'total_passes', 'pass_accuracy', 'key_passes',
  'tackles', 'interceptions', 'duels_won', 'aerial_duels_won', 'duels_total',
  'ground_duel_win_pct', 'aerial_duel_win_pct', 'clearances',
  'dribbles_success', 'dribbles_attempts', 'dribble_success_pct', 'successful_dribbles',
  'goals', 'assists', 'shots', 'total_shots',
  'possession_lost', 'touches', 'opp_half_passes', 'own_half_passes',
  'tackle_blocks', 'dribbled_past', 'yellow_cards', 'red_cards',
  'fouls_committed', 'fouls_drawn', 'penalty_won', 'penalty_scored', 'penalty_missed', 'penalty_conceded',
  'rating', 'ability_rating', 'availability_score', 'api_average_rating',
];

const TARGETS = [
  { search: 'cubars', team: null, label: 'Pau Cubarsí' },
  { search: 'stones', team: null, label: 'John Stones' },
  { search: 'gvardiol', team: null, label: 'Josko Gvardiol' },
  { search: 'van dijk', team: 'liverpool', label: 'Virgil van Dijk' },
  { search: 'saliba', team: 'arsenal', label: 'William Saliba' },
  { search: 'marquinhos', team: 'paris', label: 'Marquinhos' },
  { search: 'romero', team: 'tottenham', label: 'Cristian Romero' },
];

async function main() {
  for (const t of TARGETS) {
    let q = sb.from('players').select(RAW_FIELDS.join(',')).or(`name.ilike.%${t.search}%,full_name.ilike.%${t.search}%`);
    if (t.team) q = q.or(`team.ilike.%${t.team}%,club.ilike.%${t.team}%`);
    const { data, error } = await q.order('minutes', { ascending: false, nullsFirst: false }).limit(1);

    console.log('═'.repeat(78));
    console.log(t.label);
    if (error) { console.log('  query error:', error.message); continue; }
    if (!data || !data.length) { console.log(`  NOT FOUND`); continue; }
    const row = data[0];

    const comp = productionComponents(row, 'DEF');
    const [defend, build, prog, att] = comp.vals;
    const [wD, wB, wP, wA] = comp.w;
    const blended = defend * wD + build * wB + prog * wP + att * wA;
    const arch = deriveArchetype(row);
    const scored = resolveRating(row);

    console.log(`\n  ${row.name}  (${row.team || row.club}, ${row.minutes} mins / ${row.appearances} apps)`);
    console.log(`    tackles=${row.tackles} interceptions=${row.interceptions} duels_won=${row.duels_won} duels_total=${row.duels_total} ground%=${row.ground_duel_win_pct} aerial%=${row.aerial_duel_win_pct} clearances=${row.clearances}`);
    console.log(`    passes=${row.passes} acc=${row.pass_accuracy}%`);
    console.log(`    defend=${defend?.toFixed(1)} (w${wD})  build=${build?.toFixed(1)} (w${wB})  prog=${prog?.toFixed(1)} (w${wP})  att=${att?.toFixed(1)} (w${wA})  -> blended production=${blended.toFixed(1)}`);
    console.log(`    archetype=${arch}`);
    console.log(`    rating: season=${scored?.rating}  ability=${scored?.ability}  availability=${scored?.availability}  confidence=${scored?.confidence}`);
  }
}

main();
