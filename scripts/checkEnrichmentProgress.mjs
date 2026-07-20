// scripts/checkEnrichmentProgress.mjs — READ-ONLY. No writes.
//
// Quick progress check for the full enrichPlayerStats.mjs sweep (kicked off
// 2026-07-20, interrupted partway through by API-Football's daily request
// quota). Counts how many of the target rows (api_player_id set) have a
// stats_updated_at timestamp from TODAY (i.e. touched by this sweep) vs how
// many are still untouched/stale, so you can tell how much is left without
// re-reading the whole log.
//
// Run: node scripts/checkEnrichmentProgress.mjs
//      SINCE="2026-07-20T00:00:00Z" node scripts/checkEnrichmentProgress.mjs   (custom cutoff)
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

// Default cutoff: start of today (local sweep was kicked off today). Override
// with SINCE if you started the sweep on a different day / at a known time.
const SINCE = process.env.SINCE || new Date().toISOString().slice(0, 10) + 'T00:00:00Z';

async function count(builder) {
  const { count, error } = await builder;
  if (error) { console.error('Query failed:', error.message); process.exit(1); }
  return count;
}

async function run() {
  console.log(`Enrichment progress check — read-only. Cutoff: touched since ${SINCE}\n`);

  const total = await count(sb.from('players').select('id', { count: 'exact', head: true })
    .not('api_player_id', 'is', null).gt('api_player_id', 0));

  const touchedToday = await count(sb.from('players').select('id', { count: 'exact', head: true })
    .not('api_player_id', 'is', null).gt('api_player_id', 0)
    .gte('stats_updated_at', SINCE));

  const neverTouched = await count(sb.from('players').select('id', { count: 'exact', head: true })
    .not('api_player_id', 'is', null).gt('api_player_id', 0)
    .is('stats_updated_at', null));

  const staleOlder = total - touchedToday - neverTouched;

  console.log(`Target rows (real api_player_id):     ${total}`);
  console.log(`Touched since cutoff (this sweep):     ${touchedToday}  (${((touchedToday/total)*100).toFixed(1)}%)`);
  console.log(`Never enriched (stats_updated_at NULL): ${neverTouched}`);
  console.log(`Touched before cutoff (older sweep):    ${staleOlder}`);
  console.log(`\nRemaining for this sweep to reach:      ${total - touchedToday}`);
}

run().catch(e => { console.error('\nFatal:', e?.message ?? e); process.exit(1); });
