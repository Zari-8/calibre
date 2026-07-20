// scripts/fixPaderbornLeagueId.mjs — targeted multi-row correction.
// All 25 SC Paderborn 07 rows are stored with league_id=78 (top-flight
// Bundesliga, sRaw=0.98 in calibreRating.js) — confirmed via
// checkLeagueIdMapping.mjs. Paderborn plays in 2. Bundesliga this season
// (Zari), and lookupGermanLeagueIds.mjs confirmed the real API-Football id
// for that league is 79 (now added to LEAGUE_ID_STRENGTH at 0.78,
// Championship-tier). This corrects every Paderborn row's league_id from
// 78->79. players.rating itself is untouched here — same division of labor
// as fixFerranTorresPosition.mjs: this fixes the DATA, computeRatings.mjs
// (or a live recompute check) reflects it afterward.
//
// DRY_RUN=1 by default-safe: prints before/after and does NOT write unless
// you pass DRY_RUN=0 explicitly.
//
// Run (one line, no quotes):
//   node scripts/fixPaderbornLeagueId.mjs
//   DRY_RUN=0 node scripts/fixPaderbornLeagueId.mjs

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

const DRY_RUN = process.env.DRY_RUN !== '0'; // safe-by-default
const OLD_LEAGUE_ID = 78;
const NEW_LEAGUE_ID = 79;

async function main() {
  const { data: rows, error } = await sb
    .from('players')
    .select('id, name, team, league_id, minutes, rating')
    .ilike('team', '%paderborn%')
    .eq('league_id', OLD_LEAGUE_ID);
  if (error) { console.error('Fetch failed:', error.message); process.exit(1); }
  if (!rows?.length) { console.log('No Paderborn rows found at league_id=78 — nothing to fix (already corrected, or none matched).'); return; }

  console.log(`Found ${rows.length} Paderborn rows at league_id=${OLD_LEAGUE_ID} (Bundesliga) — correcting to ${NEW_LEAGUE_ID} (2. Bundesliga):\n`);
  for (const r of rows) console.log(`  ${r.name.padEnd(24)} minutes=${String(r.minutes ?? '—').padEnd(6)} stored_rating=${r.rating ?? '—'}`);

  if (DRY_RUN) {
    console.log('\nDRY RUN — nothing written. Re-run with DRY_RUN=0 to apply.');
    return;
  }

  const ids = rows.map(r => r.id);
  const { error: upErr } = await sb.from('players').update({ league_id: NEW_LEAGUE_ID }).in('id', ids);
  if (upErr) { console.error('Update failed:', upErr.message); process.exit(1); }
  console.log(`\n✓ Updated ${ids.length} rows. league_id corrected — players.rating itself is untouched by this`);
  console.log('  script (only computeRatings.mjs writes ratings). Check the corrected LIVE recompute, e.g.:');
  console.log(`    ID=${rows[0].id} node scripts/inspectPlayerBreakdown.mjs`);
  console.log('  before deciding to run the canonical backfill.');
}

main().catch((e) => { console.error(e); process.exit(1); });
