// scripts/checkOnePlayer.mjs — READ-ONLY. No writes.
//
// Diagnostic: enrichPlayerStats.mjs is logging real "✓" successes with real
// season/minutes/stats data, but checkFullEnrichmentCount.mjs's aggregate
// counts aren't moving at all. This looks up ONE player by name directly so
// we can see their actual current row -- specifically whether stats_season
// is genuinely null->non-null (real new progress the aggregate should have
// caught) or was ALREADY non-null before this run (meaning the "✓" success
// we're seeing is a harmless but redundant re-confirmation of an
// already-fully-enriched row, which correctly would NOT move the aggregate).
//
// Run: NAME="Calafiori" node scripts/checkOnePlayer.mjs
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

const NAME = process.env.NAME;
if (!NAME) { console.error('Set NAME=... e.g. NAME="Calafiori" node scripts/checkOnePlayer.mjs'); process.exit(1); }

async function run() {
  const { data, error } = await sb
    .from('players')
    .select('id, name, team, league_id, api_player_id, minutes, appearances, api_average_rating, stats_season, stats_updated_at')
    .ilike('name', `%${NAME}%`)
    .limit(10);
  if (error) { console.error('Query failed:', error.message); process.exit(1); }
  if (!data || data.length === 0) { console.log('No match.'); return; }
  for (const r of data) {
    console.log(`${r.name} (${r.team ?? '—'}, league_id=${r.league_id ?? '—'}, api_player_id=${r.api_player_id ?? 'NULL'})`);
    console.log(`  minutes=${r.minutes} appearances=${r.appearances} api_average_rating=${r.api_average_rating}`);
    console.log(`  stats_season=${r.stats_season === null ? 'NULL' : r.stats_season}  stats_updated_at=${r.stats_updated_at ?? 'NULL'}`);
    console.log('');
  }
}

run().catch(e => { console.error('\nFatal:', e?.message ?? e); process.exit(1); });
