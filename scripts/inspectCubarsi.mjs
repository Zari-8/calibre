// ============================================================
// inspectCubarsi.mjs — diagnostic pull for Pau Cubarsí (apiPlayerId 396623).
// Zari flagged two things: (1) his Calibre archetype reads "Stopper" when
// he's one of the best ball-playing CBs in Europe, and (2) a Calibre rating
// of 79 looks too low against a 7.12 season average (api_average_rating).
//
// Rather than guess at either, this pulls his REAL row(s) from Supabase and
// runs them through the actual engine functions (playerTraits/deriveArchetype
// from src/services/playerTraits.js, calibreRating/resolveRating from
// src/services/calibreRating.js) so we can see the genuine computed traits,
// archetype scoring, and rating breakdown side by side with his raw stats —
// same "verify against real data, don't hand-simulate" approach as the
// earlier System Fit backtests.
//
// Run this LOCALLY (sandbox has no live network egress to Supabase).
// USAGE:
//   cd ~/Desktop/calibre-github
//   node scripts/inspectCubarsi.mjs
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

const { playerTraits, deriveArchetype } = await import('../src/services/playerTraits.js');
const { calibreRating, resolveRating } = await import('../src/services/calibreRating.js');

const RAW_FIELDS = [
  'id', 'api_player_id', 'name', 'full_name', 'team', 'club', 'league_id', 'season',
  'age', 'pos', 'position', 'raw_position',
  'minutes', 'stats_minutes', 'appearances', 'starts',
  'rating', 'ability_rating', 'availability_score', 'api_average_rating',
  'goals', 'assists', 'passes', 'pass_accuracy', 'key_passes',
  'dribbles_success', 'dribbles_attempts', 'tackles', 'interceptions', 'duels_won',
  'progressive_carries', 'touches', 'pressures',
];

async function main() {
  const { data, error } = await sb
    .from('players')
    .select(RAW_FIELDS.join(','))
    .or('name.ilike.%cubars%,full_name.ilike.%cubars%,api_player_id.eq.396623');

  if (error) { console.error('Query error:', error.message); process.exit(1); }
  if (!data || !data.length) { console.log('No rows found for Cubarsí / apiPlayerId 396623.'); return; }

  console.log(`Found ${data.length} row(s) for Cubarsí:\n`);

  for (const row of data) {
    console.log('─'.repeat(70));
    console.log('RAW ROW:', JSON.stringify(row, null, 2));

    const { traits, bucket, basis } = playerTraits(row);
    const archetype = deriveArchetype(row);
    console.log(`\nbucket=${bucket}  trait-basis=${basis}`);
    console.log('computed traits:', traits);
    console.log('derived archetype:', archetype);

    const scored = resolveRating(row);
    console.log('resolveRating():', scored);
    const rating = calibreRating(row);
    console.log('calibreRating() [uncalibrated + calibrated]:', rating);
    console.log();
  }
}

main();
