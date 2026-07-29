// scripts/diagnoseOrFilterBug.mjs — READ-ONLY. No writes.
//
// C. Lester (api_player_id=154662) just got processed by enrichPlayerStats.mjs
// via TARGET_UUIDS_FILE and correctly wrote stats_season=-1 -- but its
// minutes/appearances/api_average_rating are ALL null, meaning it should NOT
// have matched exportUnenrichedPlayerUuids.mjs's own
// .or('minutes.gt.0,appearances.gt.0,api_average_rating.gt.0') filter.
// Suspected cause: the known PostgREST/supabase-js gotcha already flagged
// elsewhere in this project -- .or() doesn't reliably AND together with
// separate .not()/.gt()/.is() calls chained on the same query builder.
//
// This compares the row count WITH the scored-population .or() filter vs
// WITHOUT it, both scoped to "valid api_player_id + stats_season IS NULL"
// (the same base exportUnenrichedPlayerUuids.mjs uses). If the .or() isn't
// actually restricting anything, the two counts will match (or be very
// close) -- proving the export has been pulling in players who were never
// really part of the scored population at all.
//
// Run: node scripts/diagnoseOrFilterBug.mjs
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

async function count(builder) {
  const { count, error } = await builder;
  if (error) { console.error('Query failed:', error.message); process.exit(1); }
  return count;
}

async function run() {
  const withOrFilter = await count(sb.from('players').select('id', { count: 'exact', head: true })
    .not('api_player_id', 'is', null).gt('api_player_id', 0)
    .or('minutes.gt.0,appearances.gt.0,api_average_rating.gt.0')
    .is('stats_season', null));

  const withoutOrFilter = await count(sb.from('players').select('id', { count: 'exact', head: true })
    .not('api_player_id', 'is', null).gt('api_player_id', 0)
    .is('stats_season', null));

  console.log(`With .or(scored-filter) + stats_season IS NULL:    ${withOrFilter}`);
  console.log(`WITHOUT scored-filter, just stats_season IS NULL:  ${withoutOrFilter}`);
  console.log(`(known-good "still pending" scored count was 668)`);
  console.log(`\nIf the two numbers above are equal (or withOrFilter is way`);
  console.log(`bigger than 668), the .or() filter is not actually restricting`);
  console.log(`anything -- confirming the query-chaining bug.`);
}

run().catch(e => { console.error('\nFatal:', e?.message ?? e); process.exit(1); });
