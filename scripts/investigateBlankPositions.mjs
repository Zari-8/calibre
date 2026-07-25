// ============================================================
// investigateBlankPositions.mjs — follow-up to checkRomeroPosition.mjs's
// finding that ~33.6% of rated players have no position text at all in
// position/pos/primary_role/raw_position, silently defaulting to the MID
// production formula in positionBucket() regardless of their real position.
//
// Before proposing any fix, this looks at WHO these blank-position rows
// actually are: which league(s) they cluster in, whether `archetype` (a
// separate column) is populated even when position text isn't — which
// would mean an existing, unused fallback signal — and what their raw stat
// shape looks like (goals/assists vs tackles/interceptions), to see if a
// stats-based fallback classifier is even plausible.
//
// Run this LOCALLY (sandbox has no live network egress to Supabase).
// USAGE:
//   cd ~/Desktop/calibre-github
//   node scripts/investigateBlankPositions.mjs
// Paste the FULL console output back into the chat.
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const f of ['.env', '.env.local']) {
  const p = join(ROOT, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const [k, ...r] = t.split('=');
    process.env[k.trim()] ??= r.join('=').trim().replace(/^["']|["']$/g, '');
  }
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const sb = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const { data, error } = await sb
    .from('players')
    .select('name, team, club, league_id, season, archetype, position, pos, primary_role, raw_position, goals, assists, tackles, interceptions, duels_won, minutes, statsapi_enriched_at')
    .not('rating', 'is', null)
    .limit(2000);
  if (error) { console.error('query error:', error.message); return; }

  const blank = data.filter(r => !(r.position || r.pos || r.primary_role || r.raw_position));
  console.log(`Sampled ${data.length} rated players, ${blank.length} (${(blank.length / data.length * 100).toFixed(1)}%) blank on all position fields.\n`);

  // 1. League clustering — is this concentrated in specific leagues/sources?
  const byLeague = {};
  for (const r of blank) { const k = r.league_id ?? 'null'; byLeague[k] = (byLeague[k] || 0) + 1; }
  const topLeagues = Object.entries(byLeague).sort((a, b) => b[1] - a[1]).slice(0, 15);
  console.log('Top league_ids among blank-position rows:');
  for (const [lid, n] of topLeagues) console.log(`  league_id=${lid}: ${n} rows (${(n / blank.length * 100).toFixed(1)}%)`);

  // 2. Does `archetype` survive even when position text doesn't? (existing
  // unused fallback signal, if so)
  const withArchetype = blank.filter(r => r.archetype);
  console.log(`\nOf ${blank.length} blank-position rows, ${withArchetype.length} (${(withArchetype.length / blank.length * 100).toFixed(1)}%) still have a non-null \`archetype\` value.`);
  if (withArchetype.length) {
    const archCounts = {};
    for (const r of withArchetype) archCounts[r.archetype] = (archCounts[r.archetype] || 0) + 1;
    console.log('  archetype breakdown:', archCounts);
  }

  // 3. statsapi_enriched_at — are these rows from a specific ingestion pass
  // (never touched by the newer enrichment) vs. a general spread?
  const neverStatsApi = blank.filter(r => !r.statsapi_enriched_at).length;
  console.log(`\nOf ${blank.length} blank-position rows, ${neverStatsApi} (${(neverStatsApi / blank.length * 100).toFixed(1)}%) have never been touched by TheStatsAPI enrichment (statsapi_enriched_at is null).`);

  // 4. Sample raw stat shape for 10 blank rows — plausible to infer position
  // from goals/assists vs tackles/interceptions/duels?
  console.log('\nSample of 10 blank-position rows (raw stat shape):');
  for (const r of blank.slice(0, 10)) {
    console.log(`  ${r.name} (${r.team || r.club || '—'}, league_id=${r.league_id}, mins=${r.minutes}) goals=${r.goals} assists=${r.assists} tackles=${r.tackles} interceptions=${r.interceptions} duels_won=${r.duels_won} archetype=${r.archetype || '—'}`);
  }
}

main();
