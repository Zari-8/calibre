// scripts/exportUnenrichedPlayerUuids.mjs — READ-ONLY. No writes.
//
// exportScoredPlayerUuids.mjs exports the FULL scored population (~15,177
// rows) once. run_enrichment_loop.sh has been targeting that same static
// list on every single attempt with FORCE=1, which means every attempt
// reprocesses EVERY row -- including the ones already fully enriched days
// ago. Confirmed 2026-07-26: R. Calafiori succeeded with the IDENTICAL
// result on 2026-07-21, 23, 24, and 26 -- four real API calls spent
// re-confirming data we already had, while the ~6,982 rows that actually
// still need work waited their turn.
//
// This exports ONLY the players within the scored population who do NOT yet
// have a real stats_season -- i.e. the ones that still genuinely need an
// API call. Re-run this fresh before each attempt (not just once) so the
// target list keeps shrinking as real progress lands, instead of dragging
// the full 15,177 along for the entire multi-day sweep.
//
// Run: node scripts/exportUnenrichedPlayerUuids.mjs > unenriched_player_uuids.txt
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

const PAGE = 1000;

async function run() {
  const ids = [];
  let offset = 0;
  while (true) {
    const { data, error } = await sb
      .from('players')
      .select('id')
      .not('api_player_id', 'is', null).gt('api_player_id', 0)
      .or('minutes.gt.0,appearances.gt.0,api_average_rating.gt.0') // same scored-population filter as exportScoredPlayerUuids.mjs
      .is('stats_season', null)                                     // NEW: only rows still missing real data
      .order('id', { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) { console.error('Fetch failed:', error.message); process.exit(1); }
    if (!data || data.length === 0) break;
    ids.push(...data.map(r => r.id));
    offset += data.length;
    process.stderr.write(`\r  fetched ${ids.length} ids...`);
    if (data.length < PAGE) break;
  }
  process.stderr.write(`\ndone — ${ids.length} still-unenriched UUIDs.\n`);
  console.log(ids.join('\n'));
}

run().catch(e => { console.error('\nFatal:', e?.message ?? e); process.exit(1); });
