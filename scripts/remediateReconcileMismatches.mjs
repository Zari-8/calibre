/**
 * remediateReconcileMismatches.mjs
 *
 * Fixes the fallout from reconcileNames.mjs's pre-fix name-matching bugs
 * (Strategy 0 first-name narrowing, Strategy 4/5 "unique surname = blind
 * accept"). auditReconcileMatches.mjs found 141 mismatches across all 19
 * competitions, but they are NOT all the same kind of problem:
 *
 *   - ~124 have stored_team === null: hollow decoy rows with no team that
 *     absorbed a real player's statsapi_* + derived stat columns. This is
 *     the confirmed, unambiguous corruption pattern (matches every earlier
 *     sample checked by hand) — these are what this script clears.
 *
 *   - ~14 have a stored team that MATCHES the real player's team (e.g.
 *     "Jon Moncayola" -> "Moncayola" at Osasuna, same team both sides).
 *     These are almost certainly correct matches stored under a surname-only
 *     name, nickname, or transliteration variant — NOT bugs. This script
 *     deliberately excludes anything with a non-null stored_team so it never
 *     touches these.
 *
 *   - ~3 have a stored team that CONFLICTS with the real team (different
 *     club entirely). Ambiguous — could be a stale transfer or a genuine
 *     mismatch. This script excludes these too; they need a human look.
 *
 * So: only rows where stored_team is null get remediated. For each, clears
 * (sets to null) the statsapi_* linkage fields and every derived stat column
 * buildFields() in reconcileNames.mjs writes, so the corrected
 * reconcileNames.mjs can re-match the row cleanly on its next live run. Does
 * NOT touch team/position/name/hidden — those are outside this bug's blast
 * radius and changing them needs separate justification.
 *
 * Re-checks each row's current statsapi_player_id still matches what the
 * audit flagged before clearing, in case anything changed since the audit
 * ran.
 *
 * DRY_RUN by default. Run:
 *   node scripts/remediateReconcileMismatches.mjs
 * Then to write:
 *   DRY_RUN=0 node scripts/remediateReconcileMismatches.mjs
 *
 * Input: scripts/output/reconcile_mismatches.json (written by
 * auditReconcileMatches.mjs)
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
const DRY_RUN = process.env.DRY_RUN !== '0'; // safe-by-default

if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const CLEAR_FIELDS = {
  statsapi_player_id: null,
  statsapi_season_id: null,
  statsapi_competition_id: null,
  statsapi_enriched_at: null,
  big_chances_created: null,
  big_chances_missed: null,
  total_shots: null,
  shots_on_target: null,
  shot_accuracy: null,
  final_third_passes: null,
  opp_half_passes: null,
  own_half_passes: null,
  accurate_crosses: null,
  cross_accuracy: null,
  ground_duel_win_pct: null,
  aerial_duel_win_pct: null,
  dribble_success_pct: null,
  successful_dribbles: null,
};

async function main() {
  console.log(DRY_RUN ? 'DRY RUN — no writes.\n' : 'LIVE RUN — clearing flagged rows.\n');

  const inPath = join(ROOT, 'scripts', 'output', 'reconcile_mismatches.json');
  if (!existsSync(inPath)) { console.error(`Missing input file: ${inPath}\nRun auditReconcileMatches.mjs first.`); process.exit(1); }
  const all = JSON.parse(readFileSync(inPath, 'utf8'));

  const nullTeam = all.filter((r) => r.stored_team == null);
  const sameTeam = all.filter((r) => r.stored_team != null); // will report but not touch

  console.log(`Total flagged: ${all.length}`);
  console.log(`  stored_team === null (will remediate): ${nullTeam.length}`);
  console.log(`  stored_team !== null (skipped — likely correct match or needs manual review): ${sameTeam.length}\n`);

  if (sameTeam.length) {
    console.log('Skipped (not touched, review manually if needed):');
    for (const r of sameTeam) {
      console.log(`  "${r.statsapi_real_name}" (${r.statsapi_team}) vs stored "${r.stored_name}" (${r.stored_team}) — row ${r.stored_row_id}`);
    }
    console.log('');
  }

  let cleared = 0, skippedChanged = 0, errors = 0;
  for (const r of nullTeam) {
    const { data: current, error: fetchErr } = await sb.from('players')
      .select('id,statsapi_player_id,team')
      .eq('id', r.stored_row_id).limit(1);
    if (fetchErr || !current?.[0]) { console.warn(`  ✗ couldn't re-fetch row ${r.stored_row_id}: ${fetchErr?.message || 'not found'}`); errors++; continue; }
    const row = current[0];

    if (row.statsapi_player_id !== r.statsapi_player_id) {
      console.log(`  ↷ row ${r.stored_row_id} ("${r.stored_name}") statsapi_player_id changed since audit (${row.statsapi_player_id} != ${r.statsapi_player_id}) — skipping, already handled or changed`);
      skippedChanged++;
      continue;
    }
    if (row.team != null) {
      console.log(`  ↷ row ${r.stored_row_id} ("${r.stored_name}") now has a team set — skipping, no longer matches the null-team pattern`);
      skippedChanged++;
      continue;
    }

    console.log(`  clearing row ${r.stored_row_id} ("${r.stored_name}") — was wrongly linked to "${r.statsapi_real_name}" (${r.statsapi_team})`);
    if (!DRY_RUN) {
      const { error } = await sb.from('players').update(CLEAR_FIELDS).eq('id', r.stored_row_id);
      if (error) { console.warn(`    ✗ update failed: ${error.message}`); errors++; continue; }
    }
    cleared++;
  }

  console.log('\n── Summary ──');
  console.log(`Cleared: ${cleared}`);
  console.log(`Skipped (changed since audit): ${skippedChanged}`);
  console.log(`Errors: ${errors}`);
  console.log(`Left untouched (non-null team, likely correct or ambiguous): ${sameTeam.length}`);
  console.log(DRY_RUN
    ? '\nDRY RUN complete. If this looks right: DRY_RUN=0 node scripts/remediateReconcileMismatches.mjs'
    : '\nDone. Re-run reconcileNames.mjs live to let it re-match these rows correctly.');
}

main().catch((e) => { console.error(e); process.exit(1); });
