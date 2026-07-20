// scripts/checkScoredPopulationLeagues.mjs — READ-ONLY. No writes.
//
// Zari asked: is the ~13,900-row "scored population" (the filter
// computeRatings.mjs / exportScoredPlayerUuids.mjs use —
// minutes.gt.0,appearances.gt.0,api_average_rating.gt.0) restricted to a
// curated top-20-leagues list? It isn't — there's no league allowlist
// anywhere in that filter, it's purely "does this row have any recorded
// evidence." This prints exactly which league_id values are actually
// present in that population and how many players each contributes, so we
// have a real answer instead of a guess.
//
// NOTE: players.league_id reflects a player's CURRENT club/league only — a
// player who transferred cross-league mid-season (e.g. Tangvik: Eliteserien
// -> Bundesliga) is counted under their current league here even though part
// of their scored season was earned elsewhere. That's a separate, known
// wrinkle (see the league-decay fix in calibreRating.js) — this script is
// just counting the population, not re-litigating that.
//
// Run: node scripts/checkScoredPopulationLeagues.mjs
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
  const rows = [];
  let offset = 0;
  while (true) {
    const { data, error } = await sb
      .from('players')
      .select('league_id')
      .not('api_player_id', 'is', null).gt('api_player_id', 0)
      .or('minutes.gt.0,appearances.gt.0,api_average_rating.gt.0')
      .order('id', { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) { console.error('Fetch failed:', error.message); process.exit(1); }
    if (!data || data.length === 0) break;
    rows.push(...data);
    offset += data.length;
    process.stdout.write(`\r  fetched ${rows.length} rows...`);
    if (data.length < PAGE) break;
  }
  process.stdout.write('\n\n');

  const counts = new Map();
  let noLeagueId = 0;
  for (const r of rows) {
    const id = r.league_id;
    if (id == null) { noLeagueId++; continue; }
    counts.set(id, (counts.get(id) || 0) + 1);
  }

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  console.log(`Total scored-population rows: ${rows.length}`);
  console.log(`Distinct league_id values represented: ${sorted.length}`);
  console.log(`Rows with no league_id at all: ${noLeagueId}\n`);
  console.log('── league_id breakdown, most players first ──');
  for (const [id, n] of sorted) {
    console.log(`  league_id=${String(id).padEnd(6)} ${n} players  (${((n / rows.length) * 100).toFixed(1)}%)`);
  }
}

run().catch(e => { console.error('\nFatal:', e?.message ?? e); process.exit(1); });
