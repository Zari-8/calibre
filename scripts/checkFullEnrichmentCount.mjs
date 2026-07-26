// scripts/checkFullEnrichmentCount.mjs — READ-ONLY. No writes.
//
// Answers "how many players actually have a full enriched profile right
// now" against the real scored population (same ~15,177-row definition
// exportScoredPlayerUuids.mjs / computeRatings.mjs use), broken out by what
// their current row actually contains rather than trusting stats_updated_at
// alone -- because of the enrichPlayerStats.mjs quota-failure bug (fixed
// 2026-07-22), a row with stats_season:null right now could mean EITHER a
// confirmed real "no minutes" result OR a quota failure that got silently
// written as empty before the fix. Those two cases are NOT distinguishable
// from the DB alone (both look identical: stats_season null, stats_updated_at
// recent) -- only cross-referencing the day's log file could split them
// further, which this script does not attempt. Treat "recorded empty" below
// as "needs the next clean re-run to confirm," not as settled fact.
//
// Run: node scripts/checkFullEnrichmentCount.mjs
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

const SCORED_FILTER = 'minutes.gt.0,appearances.gt.0,api_average_rating.gt.0';

async function run() {
  console.log('Full-enrichment count — read-only.\n');

  const scoped = await count(sb.from('players').select('id', { count: 'exact', head: true })
    .not('api_player_id', 'is', null).gt('api_player_id', 0)
    .or(SCORED_FILTER));

  // "Real, usable profile" = has a stats_season on record (i.e. the row
  // actually resolved to a real API-Football season, not a null placeholder).
  const fullyEnriched = await count(sb.from('players').select('id', { count: 'exact', head: true })
    .not('api_player_id', 'is', null).gt('api_player_id', 0)
    .or(SCORED_FILTER)
    .not('stats_season', 'is', null));

  const recordedEmpty = await count(sb.from('players').select('id', { count: 'exact', head: true })
    .not('api_player_id', 'is', null).gt('api_player_id', 0)
    .or(SCORED_FILTER)
    .is('stats_season', null)
    .not('stats_updated_at', 'is', null));

  const neverTouched = await count(sb.from('players').select('id', { count: 'exact', head: true })
    .not('api_player_id', 'is', null).gt('api_player_id', 0)
    .or(SCORED_FILTER)
    .is('stats_updated_at', null));

  console.log(`Scored population (target):              ${scoped}`);
  console.log(`Fully enriched (real stats_season):        ${fullyEnriched}  (${((fullyEnriched/scoped)*100).toFixed(1)}%)`);
  console.log(`Recorded empty (stats_season NULL, touched): ${recordedEmpty}  (${((recordedEmpty/scoped)*100).toFixed(1)}%)`);
  console.log(`  ⚠ some fraction of "recorded empty" may still be quota-bug`);
  console.log(`    leftovers from before the 2026-07-22 fix, not genuine`);
  console.log(`    empty results -- the next clean FORCE=1 rerun will fix`);
  console.log(`    any real ones and leave true empties as they are.`);
  console.log(`Never touched (stats_updated_at NULL):     ${neverTouched}  (${((neverTouched/scoped)*100).toFixed(1)}%)`);
}

run().catch(e => { console.error('\nFatal:', e?.message ?? e); process.exit(1); });
