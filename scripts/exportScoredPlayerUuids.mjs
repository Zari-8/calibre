// scripts/exportScoredPlayerUuids.mjs — READ-ONLY. No writes.
//
// The enrichment sweep (enrichPlayerStats.mjs's default read) targets every
// row with a real api_player_id — ~401,000 rows, because that's API-Football's
// full global directory (reserves, youth, retired, never-featured pros
// included). computeRatings.mjs and every audit script this session actually
// operate on a much smaller "real" population: rows with SOME evidence
// already on record (minutes/appearances/api_average_rating > 0) — ~13,900
// rows. Sweeping the full 401k wastes API quota re-checking ~387k players
// who were never going to be scored anyway (that's what produced the wall of
// "no league minutes" lines burning through the daily quota).
//
// This exports the UUIDs of just the real/scored population to a plain file,
// one per line, for use with enrichPlayerStats.mjs's TARGET_UUIDS_FILE
// option — which reads exactly this list instead of the unscoped default.
//
// Run: node scripts/exportScoredPlayerUuids.mjs > scored_player_uuids.txt
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
      .or('minutes.gt.0,appearances.gt.0,api_average_rating.gt.0') // same filter computeRatings.mjs uses
      .order('id', { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) { console.error('Fetch failed:', error.message); process.exit(1); }
    if (!data || data.length === 0) break;
    ids.push(...data.map(r => r.id));
    offset += data.length;
    process.stderr.write(`\r  fetched ${ids.length} ids...`);
    if (data.length < PAGE) break;
  }
  process.stderr.write(`\ndone — ${ids.length} scored-population UUIDs.\n`);
  console.log(ids.join('\n'));
}

run().catch(e => { console.error('\nFatal:', e?.message ?? e); process.exit(1); });
