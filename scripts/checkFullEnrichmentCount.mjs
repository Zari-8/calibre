// scripts/checkFullEnrichmentCount.mjs — READ-ONLY. No writes.
//
// Answers "how many players actually have a full enriched profile right
// now" against the real scored population (same ~15,177-row definition
// exportScoredPlayerUuids.mjs / computeRatings.mjs use).
//
// v2 — 2026-07-29: enrichPlayerStats.mjs now writes stats_season:-1 (a
// sentinel that can never collide with a real season year) for a GENUINELY
// confirmed-empty result, instead of null. Before this, "confirmed empty"
// and "never actually checked" were both stats_season IS NULL and
// indistinguishable from the DB alone -- which meant the export/cooldown
// logic could only ever DELAY re-targeting an already-settled empty row, not
// stop it permanently, and the sweep re-checked the same already-known-empty
// players forever in a rotating cycle once the cooldown window passed.
// Three buckets now: real season (>0) = fully enriched, -1 = permanently
// confirmed empty (never re-targeted again), NULL = still genuinely pending
// (includes old quota-bug leftovers from before 2026-07-22 that still need
// their one clean re-check -- those will resolve to either a real season or
// the -1 sentinel the next time the loop touches them).
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

  // "Real, usable profile" = resolved to a real API-Football season (>0).
  // Excludes both the -1 confirmed-empty sentinel and NULL never-checked.
  const fullyEnriched = await count(sb.from('players').select('id', { count: 'exact', head: true })
    .not('api_player_id', 'is', null).gt('api_player_id', 0)
    .or(SCORED_FILTER)
    .gt('stats_season', 0));

  // Permanently settled -- genuinely 0 minutes across the season ladder.
  // Never re-targeted by exportUnenrichedPlayerUuids.mjs again.
  const confirmedEmpty = await count(sb.from('players').select('id', { count: 'exact', head: true })
    .not('api_player_id', 'is', null).gt('api_player_id', 0)
    .or(SCORED_FILTER)
    .eq('stats_season', -1));

  // Still genuinely pending -- either never touched at all, or every attempt
  // so far failed (quota exhaustion) without a confirmed result. Includes
  // old pre-2026-07-22 quota-bug leftovers that were never properly
  // reclassified under the old null-only scheme.
  const stillPending = await count(sb.from('players').select('id', { count: 'exact', head: true })
    .not('api_player_id', 'is', null).gt('api_player_id', 0)
    .or(SCORED_FILTER)
    .is('stats_season', null));

  const neverTouched = await count(sb.from('players').select('id', { count: 'exact', head: true })
    .not('api_player_id', 'is', null).gt('api_player_id', 0)
    .or(SCORED_FILTER)
    .is('stats_updated_at', null));

  console.log(`Scored population (target):                ${scoped}`);
  console.log(`Fully enriched (real stats_season):        ${fullyEnriched}  (${((fullyEnriched/scoped)*100).toFixed(1)}%)`);
  console.log(`Confirmed empty (stats_season = -1, permanent): ${confirmedEmpty}  (${((confirmedEmpty/scoped)*100).toFixed(1)}%)`);
  console.log(`Still pending (stats_season NULL):         ${stillPending}  (${((stillPending/scoped)*100).toFixed(1)}%)`);
  console.log(`  of which never touched at all:           ${neverTouched}  (${((neverTouched/scoped)*100).toFixed(1)}%)`);
}

run().catch(e => { console.error('\nFatal:', e?.message ?? e); process.exit(1); });
