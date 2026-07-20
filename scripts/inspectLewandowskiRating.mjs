// scripts/inspectLewandowskiRating.mjs — READ-ONLY. Earlier this project
// (fixDuplicateIdentities.mjs, 2026-07-09 notes) found that a hollow decoy
// row (api_player_id 147229, "Robert Lewandowski", no team, default age 51)
// had absorbed a real TheStatsAPI enrichment write meant for the real
// Barcelona row (api_player_id 521, stored abbreviated as "R. Lewandowski"),
// because reconcileNames.mjs's old exact-ilike match never hit the
// abbreviated name. fixDuplicateIdentities.mjs was written to merge the
// decoy's fields onto the real row and hide the decoy, DRY_RUN-safe — but
// there's no log in this repo confirming it was ever run with DRY_RUN=0.
// This pulls every row matching "lewandowski" to see current state directly:
// is the real row still missing data, is the decoy still visible, or is this
// a different problem (e.g. wrong league_id, wrong position penalty).
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const f of ['.env', '.env.local']) {
  const p = join(ROOT, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [key, ...rest] = trimmed.split('=');
    process.env[key.trim()] ??= rest.join('=').trim().replace(/^["']|["']$/g, '');
  }
}

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!URL || !KEY) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const { data, error } = await sb
  .from('players')
  .select('id,name,team,age,position,pos,primary_role,league_id,api_player_id,statsapi_player_id,minutes,stats_minutes,appearances,starts,goals,assists,api_average_rating,rating,stats_season,stats_updated_at,competition_splits,hidden')
  .ilike('name', '%lewandowski%')
  .order('name');

if (error) { console.error(error.message); process.exit(1); }
if (!data?.length) { console.log('No row found matching "lewandowski".'); process.exit(0); }

console.log(`${data.length} row(s) found.\n`);
for (const r of data) {
  console.log('═'.repeat(70));
  console.log(r.name, '|', r.id, r.hidden ? '(HIDDEN)' : '(visible)');
  console.log('  team:', r.team, ' age:', r.age, ' position:', r.position, ' pos:', r.pos, ' primary_role:', r.primary_role);
  console.log('  league_id:', r.league_id, ' api_player_id:', r.api_player_id, ' statsapi_player_id:', r.statsapi_player_id);
  console.log('  minutes:', r.minutes, ' stats_minutes:', r.stats_minutes, ' appearances:', r.appearances, ' starts:', r.starts);
  console.log('  goals:', r.goals, ' assists:', r.assists);
  console.log('  api_average_rating:', r.api_average_rating, ' stored rating (0-100):', r.rating);
  console.log('  stats_season:', r.stats_season, ' stats_updated_at:', r.stats_updated_at);
  console.log('  has competition_splits:', !!r.competition_splits);
}
console.log('═'.repeat(70));
