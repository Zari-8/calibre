/**
 * fixNameTeamDuplicates.mjs
 * Targeted, DRY_RUN-safe fix for the 3 confirmed "same name + same team"
 * duplicates surfaced by the query-5 scan (2026-07-13) that the earlier
 * statsapi_player_id merge (mergeDuplicateStatsapiIds.mjs) didn't catch —
 * these pairs don't share a statsapi_player_id, so they were invisible to
 * that pass. Two different real people sharing both a nickname AND a club
 * is vanishingly rare, so same-name-same-team is treated as a duplicate
 * identity here, same as the statsapi-linked cases.
 *
 * (The scan also turned up Igor/Isaac/Luiz Otávio — those are already
 * resolved from the earlier statsapi merge, one row of each pair is
 * already hidden, so they're left alone.)
 *
 * For each pair: keep the higher-minutes row as primary, fill any field
 * where the primary is null from the other row (never overwrites real
 * data), then hide the other row.
 *
 * Run (preview first):
 *   node scripts/fixNameTeamDuplicates.mjs
 * Then to write:
 *   DRY_RUN=0 node scripts/fixNameTeamDuplicates.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const f of ['.env', '.env.local']) {
  const p = join(ROOT, f);
  if (!existsSync(p)) continue;
  for (const l of readFileSync(p, 'utf8').split('\n')) {
    const m = l.match(/^([^#=]+)=(.*)/);
    if (m) process.env[m[1].trim()] ??= m[2].trim().replace(/^["']|["']$/g, '');
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.env.DRY_RUN !== '0';

if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const MERGE_FIELDS = [
  'minutes', 'stats_minutes', 'appearances', 'starts', 'goals', 'assists',
  'passes', 'key_passes', 'tackles', 'interceptions', 'duels_won', 'shots',
  'pass_accuracy', 'api_average_rating', 'rating',
  'position', 'pos', 'primary_role', 'raw_position', 'archetype',
  'api_player_id', 'api_position', 'league_id', 'api_team_id', 'club',
  'age', 'nationality', 'image', 'image_url', 'img',
  'statsapi_player_id', 'statsapi_season_id', 'statsapi_competition_id', 'statsapi_enriched_at',
  'big_chances_created', 'big_chances_missed', 'total_shots', 'shots_on_target',
  'shot_accuracy', 'final_third_passes', 'opp_half_passes', 'own_half_passes',
  'accurate_crosses', 'cross_accuracy', 'ground_duel_win_pct', 'aerial_duel_win_pct',
  'dribble_success_pct', 'successful_dribbles',
  'saves', 'goals_conceded', 'penalty_saved',
  'duels_total', 'shots_on', 'tackle_blocks', 'dribbled_past',
  'yellow_cards', 'red_cards', 'fouls_committed', 'fouls_drawn',
  'penalty_won', 'penalty_scored', 'penalty_missed', 'penalty_conceded',
  'statsapi_position', 'statsapi_position_counts',
  'xg', 'xa', 'npxg',
];

// keepId = higher-minutes row, mergeFromId = the one to fold in + hide
const PAIRS = [
  { label: 'G. Kekana (Mamelodi Sundowns)', keepId: '87acca03-0418-4301-a045-a6d9156220f4', mergeFromId: '0ee6e140-a040-4625-89ef-f1860f7c0ad4' },
  { label: 'Zé Carlos (GIL Vicente)',        keepId: 'da8b6448-96ea-4ee7-83a8-d400898af2ea', mergeFromId: '8dc1ea57-d2a7-4888-a1cf-4900f54f8f6f' },
  { label: 'M. Johansson (Rosengård W)',     keepId: '846368d9-3779-45d0-ab38-5a1ab39e69ef', mergeFromId: '5d1eca70-7030-4694-abf6-5c90260911cc' },
];

const SELECT = ['id', 'name', 'team', 'hidden', 'minutes', ...MERGE_FIELDS].filter((v, i, a) => a.indexOf(v) === i).join(',');

async function main() {
  console.log(DRY_RUN ? 'DRY RUN — no writes.\n' : 'LIVE RUN.\n');

  for (const pair of PAIRS) {
    const { data: keepRows } = await sb.from('players').select(SELECT).eq('id', pair.keepId).limit(1);
    const { data: fromRows } = await sb.from('players').select(SELECT).eq('id', pair.mergeFromId).limit(1);
    const keep = keepRows?.[0], from = fromRows?.[0];
    console.log(`${pair.label}:`);
    if (!keep || !from) { console.log(`  could not find both rows (keep=${!!keep} from=${!!from}) — skipping\n`); continue; }

    const patch = {};
    for (const f of MERGE_FIELDS) {
      if (keep[f] == null && from[f] != null) patch[f] = from[f];
    }
    console.log(`  keep  id=${keep.id} "${keep.name}" (${keep.team || 'no team'}, ${keep.minutes || 0}min)`);
    console.log(`  hide  id=${from.id} "${from.name}" (${from.team || 'no team'}, ${from.minutes || 0}min)${from.hidden ? ' [already hidden]' : ''}`);
    console.log(`  fields to merge: ${Object.keys(patch).join(', ') || '(none)'}`);

    if (!DRY_RUN) {
      if (Object.keys(patch).length) {
        const { error: e1 } = await sb.from('players').update(patch).eq('id', keep.id);
        if (e1) { console.log(`  ERROR updating keep row: ${e1.message}\n`); continue; }
      }
      if (!from.hidden) {
        const { error: e2 } = await sb.from('players').update({ hidden: true }).eq('id', from.id);
        if (e2) console.log(`  ERROR hiding decoy row: ${e2.message}`);
        else console.log('  merged + hid decoy row');
      }
    }
    console.log('');
  }

  console.log(DRY_RUN ? 'DRY RUN complete. Re-run with DRY_RUN=0 to write.' : 'Done.');
}

main().catch(e => { console.error(e); process.exit(1); });
