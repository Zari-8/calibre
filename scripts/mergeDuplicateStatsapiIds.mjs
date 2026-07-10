/**
 * mergeDuplicateStatsapiIds.mjs
 * DRY_RUN-safe. Generalizes the one-off fixDuplicateIdentities.mjs fix
 * (Lewandowski/Bellingham) to every case of the same bug: the same
 * statsapi_player_id linked to more than one players row. Confirmed at
 * scale via SQL (2026-07-13): 113+ groups, many with BOTH rows still
 * visible (hidden=false) — real duplicate player cards on the live site.
 *
 * For each group sharing a statsapi_player_id:
 *   1. Pick a primary row: prefer already-visible (not hidden) over hidden,
 *      then higher minutes, then presence of api_player_id.
 *   2. Merge every OTHER row's value into the primary for any field where
 *      the primary is currently null — never overwrites real data on the
 *      primary, only fills gaps.
 *   3. Hide every non-primary row in the group.
 *
 * Read-only by default. Run:
 *   node scripts/mergeDuplicateStatsapiIds.mjs
 * Then to write:
 *   DRY_RUN=0 node scripts/mergeDuplicateStatsapiIds.mjs
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

// Only fill gaps with these — never touch identity/structural columns
// (id, slug, name, created_at, competition_splits, etc).
const MERGE_FIELDS = [
  // core stat line
  'minutes', 'stats_minutes', 'appearances', 'starts', 'goals', 'assists',
  'passes', 'key_passes', 'tackles', 'interceptions', 'duels_won', 'shots',
  'pass_accuracy', 'api_average_rating', 'rating',
  'position', 'pos', 'primary_role', 'raw_position', 'archetype',
  'api_player_id', 'api_position', 'league_id', 'api_team_id', 'team', 'club',
  'age', 'nationality', 'image', 'image_url', 'img',
  // StatsAPI season enrichment
  'statsapi_season_id', 'statsapi_competition_id', 'statsapi_enriched_at',
  'big_chances_created', 'big_chances_missed', 'total_shots', 'shots_on_target',
  'shot_accuracy', 'final_third_passes', 'opp_half_passes', 'own_half_passes',
  'accurate_crosses', 'cross_accuracy', 'ground_duel_win_pct', 'aerial_duel_win_pct',
  'dribble_success_pct', 'successful_dribbles',
  // GK
  'saves', 'goals_conceded', 'penalty_saved',
  // v8.5 zero-cost API-Football fields
  'duels_total', 'shots_on', 'tackle_blocks', 'dribbled_past',
  'yellow_cards', 'red_cards', 'fouls_committed', 'fouls_drawn',
  'penalty_won', 'penalty_scored', 'penalty_missed', 'penalty_conceded',
  // position overlay
  'statsapi_position', 'statsapi_position_counts',
  // xG
  'xg', 'xa', 'npxg',
];

const SELECT_FIELDS = ['id', 'name', 'team', 'hidden', 'minutes', 'api_player_id', 'statsapi_player_id', ...MERGE_FIELDS];
// dedupe (several appear in both the base list and MERGE_FIELDS)
const SELECT = [...new Set(SELECT_FIELDS)].join(',');

async function fetchAllWithStatsapiId() {
  const all = [];
  let from = 0;
  const PAGE = 1000;
  for (;;) {
    const { data, error } = await sb
      .from('players')
      .select(SELECT)
      .not('statsapi_player_id', 'is', null)
      .range(from, from + PAGE - 1);
    if (error) { console.error('Fetch error:', error.message); process.exit(1); }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

function pickPrimary(rows) {
  return [...rows].sort((a, b) => {
    // 1. not-hidden beats hidden
    const hiddenDiff = (a.hidden ? 1 : 0) - (b.hidden ? 1 : 0);
    if (hiddenDiff !== 0) return hiddenDiff;
    // 2. higher minutes wins
    const minDiff = (b.minutes || 0) - (a.minutes || 0);
    if (minDiff !== 0) return minDiff;
    // 3. presence of api_player_id wins
    const apiDiff = (b.api_player_id ? 1 : 0) - (a.api_player_id ? 1 : 0);
    if (apiDiff !== 0) return apiDiff;
    return 0;
  })[0];
}

async function main() {
  console.log(DRY_RUN ? 'DRY RUN — no writes.\n' : 'LIVE RUN.\n');

  const rows = await fetchAllWithStatsapiId();
  console.log(`Fetched ${rows.length} rows with a statsapi_player_id.`);

  const groups = new Map();
  for (const r of rows) {
    const k = r.statsapi_player_id;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  const dupGroups = [...groups.values()].filter(g => g.length > 1);
  console.log(`${dupGroups.length} statsapi_player_id groups with 2+ rows.\n`);

  let mergedGroups = 0, hiddenRows = 0, fieldsMergedTotal = 0, alreadyMergedGroups = 0, errors = 0;

  for (const group of dupGroups) {
    const primary = pickPrimary(group);
    const losers = group.filter(r => r.id !== primary.id);

    const patch = {};
    for (const loser of losers) {
      for (const f of MERGE_FIELDS) {
        if (primary[f] == null && patch[f] === undefined && loser[f] != null) {
          patch[f] = loser[f];
        }
      }
    }

    const needsHide = losers.filter(l => !l.hidden);
    if (Object.keys(patch).length === 0 && needsHide.length === 0) {
      alreadyMergedGroups++;
      continue;
    }

    mergedGroups++;
    fieldsMergedTotal += Object.keys(patch).length;
    console.log(`"${primary.name}" (statsapi=${primary.statsapi_player_id}):`);
    console.log(`  keep   id=${primary.id} "${primary.name}" (${primary.team || 'no team'}, ${primary.minutes || 0}min)${primary.hidden ? ' [was hidden]' : ''}`);
    for (const l of losers) {
      console.log(`  hide   id=${l.id} "${l.name}" (${l.team || 'no team'}, ${l.minutes || 0}min)${l.hidden ? ' [already hidden]' : ''}`);
    }
    console.log(`  fields merged into primary: ${Object.keys(patch).join(', ') || '(none)'}`);

    if (!DRY_RUN) {
      if (Object.keys(patch).length) {
        const { error: e1 } = await sb.from('players').update(patch).eq('id', primary.id);
        if (e1) { console.log(`  ERROR updating primary: ${e1.message}`); errors++; continue; }
      }
      for (const l of needsHide) {
        const { error: e2 } = await sb.from('players').update({ hidden: true }).eq('id', l.id);
        if (e2) { console.log(`  ERROR hiding ${l.id}: ${e2.message}`); errors++; }
        else hiddenRows++;
      }
    } else {
      hiddenRows += needsHide.length;
    }
    console.log('');
  }

  console.log('── Summary ──');
  console.log(`Duplicate groups found      : ${dupGroups.length}`);
  console.log(`Groups needing action       : ${mergedGroups}`);
  console.log(`Groups already clean        : ${alreadyMergedGroups}`);
  console.log(`Rows ${DRY_RUN ? 'that would be' : ''} hidden${DRY_RUN ? '' : '        '} : ${hiddenRows}`);
  console.log(`Fields merged (total)       : ${fieldsMergedTotal}`);
  console.log(`Errors                      : ${errors}`);
  console.log(DRY_RUN ? '\nDRY RUN complete. Re-run with DRY_RUN=0 to write.' : '\nDone.');
}

main().catch(e => { console.error(e); process.exit(1); });
