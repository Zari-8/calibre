/**
 * fixDuplicateIdentities.mjs
 * Targeted, DRY_RUN-safe fix for two specific duplicate-identity cases
 * surfaced by inspectNameCollisions.mjs on 2026-07-09:
 *
 *  - Lewandowski: reconcileNames.mjs's old name-matching logic (blind exact
 *    ilike + .limit(1)) wrote a real TheStatsAPI season enrichment onto a
 *    hollow decoy row (api_player_id 147229 — "Robert Lewandowski", no team,
 *    default age 51) instead of the real Barcelona row (api_player_id 521 —
 *    stored abbreviated as "R. Lewandowski", which the exact-string match
 *    never hit). This merges the decoy's statsapi_* fields onto the real
 *    row (only filling currently-null fields, never overwriting), then
 *    hides the decoy so it stops appearing as a second player.
 *
 *  - Bellingham: a pre-existing hollow duplicate of the real Jude Bellingham
 *    row (Real Madrid, api_player_id 129718, which already has the correct
 *    statsapi_player_id pl_29113080 and full stats) — no merge needed, just
 *    hide the teamless duplicate carrying the same statsapi_player_id.
 *
 * The underlying matching bug in reconcileNames.mjs that caused the
 * Lewandowski misattachment has been fixed separately in this same pass —
 * this script only cleans up the one write that already happened before
 * the fix landed.
 *
 * Run (preview first):
 *   node scripts/fixDuplicateIdentities.mjs
 * Then to actually write:
 *   DRY_RUN=0 node scripts/fixDuplicateIdentities.mjs
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

const STATSAPI_FIELDS = [
  'statsapi_player_id', 'statsapi_season_id', 'statsapi_competition_id', 'statsapi_enriched_at',
  'big_chances_created', 'big_chances_missed', 'total_shots', 'shots_on_target', 'shot_accuracy',
  'final_third_passes', 'opp_half_passes', 'own_half_passes', 'accurate_crosses', 'cross_accuracy',
  'ground_duel_win_pct', 'aerial_duel_win_pct', 'dribble_success_pct', 'successful_dribbles',
];

const ACTIONS = [
  { type: 'merge', keepApiId: 521, mergeFromApiId: 147229, label: 'Lewandowski' },
  { type: 'hide', statsapiId: 'pl_29113080', requireNoTeam: true, label: 'Bellingham hollow twin' },
];

async function main() {
  console.log(DRY_RUN ? 'DRY RUN — no writes.\n' : 'LIVE RUN.\n');

  for (const action of ACTIONS) {
    if (action.type === 'merge') {
      const sel = `id,name,team,${STATSAPI_FIELDS.join(',')}`;
      const { data: keepRows } = await sb.from('players').select(sel).eq('api_player_id', action.keepApiId).limit(1);
      const { data: fromRows } = await sb.from('players').select(sel).eq('api_player_id', action.mergeFromApiId).limit(1);
      const keep = keepRows?.[0], from = fromRows?.[0];
      console.log(`${action.label}:`);
      if (!keep || !from) { console.log(`  could not find both rows (keep=${!!keep} from=${!!from}) — skipping\n`); continue; }

      const patch = {};
      for (const f of STATSAPI_FIELDS) {
        if (keep[f] == null && from[f] != null) patch[f] = from[f];
      }
      console.log(`  keep  id=${keep.id} "${keep.name}" (${keep.team || 'no team'})`);
      console.log(`  from  id=${from.id} "${from.name}" (${from.team || 'no team'})`);
      console.log(`  fields to merge: ${Object.keys(patch).join(', ') || '(none — already populated)'}`);

      if (!DRY_RUN) {
        if (Object.keys(patch).length) {
          const { error: e1 } = await sb.from('players').update(patch).eq('id', keep.id);
          if (e1) { console.log(`  ERROR updating keep row: ${e1.message}\n`); continue; }
        }
        const { error: e2 } = await sb.from('players').update({ hidden: true }).eq('id', from.id);
        if (e2) console.log(`  ERROR hiding decoy row: ${e2.message}`);
        else console.log(`  merged + hid decoy id=${from.id}`);
      }
      console.log('');
    } else if (action.type === 'hide') {
      const { data } = await sb.from('players').select('id,name,team,statsapi_player_id').eq('statsapi_player_id', action.statsapiId);
      const rows = action.requireNoTeam ? (data || []).filter(r => !r.team) : (data || []);
      console.log(`${action.label}:`);
      if (!rows.length) { console.log('  no matching hollow row found — skipping\n'); continue; }
      for (const row of rows) {
        console.log(`  id=${row.id} "${row.name}" (${row.team || 'no team'})`);
        if (!DRY_RUN) {
          const { error } = await sb.from('players').update({ hidden: true }).eq('id', row.id);
          if (error) console.log(`  ERROR: ${error.message}`);
          else console.log('  hidden');
        }
      }
      console.log('');
    }
  }

  console.log(DRY_RUN ? 'DRY RUN complete. Re-run with DRY_RUN=0 to write.' : 'Done.');
}

main().catch(e => { console.error(e); process.exit(1); });
