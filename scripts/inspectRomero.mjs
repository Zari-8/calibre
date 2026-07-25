// ============================================================
// inspectRomero.mjs — backtestDefFinal.mjs showed Cristian Romero landing
// at season=90/ability=89, HIGHER than Van Dijk (83/80), despite a LOWER
// blended production score (69.7 vs 76.2). Production feeds Performance
// directly, so something else (api_average_rating/q, age/Trajectory,
// Consistency/Impact from his availability) must be doing the lifting.
// This prints the full resolveRating() breakdown plus the raw inputs that
// feed it, so we can see exactly which component is driving the gap.
//
// Run this LOCALLY (sandbox has no live network egress to Supabase).
// USAGE:
//   cd ~/Desktop/calibre-github
//   node scripts/inspectRomero.mjs
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

const { resolveRating, productionComponents, leagueStrengthById } = await import('../src/services/calibreRating.js');

const RAW_FIELDS = [
  'name', 'full_name', 'team', 'club', 'league_id', 'age', 'season',
  'minutes', 'stats_minutes', 'appearances', 'starts',
  'rating', 'ability_rating', 'availability_score', 'api_average_rating',
  'passes', 'total_passes', 'pass_accuracy', 'key_passes',
  'tackles', 'interceptions', 'duels_won', 'aerial_duels_won', 'duels_total',
  'ground_duel_win_pct', 'aerial_duel_win_pct', 'clearances',
  'dribbles_success', 'dribbles_attempts',
  'goals', 'assists', 'yellow_cards', 'red_cards',
];

async function main() {
  const q = sb.from('players')
    .select(RAW_FIELDS.join(','))
    .or('name.ilike.%romero%,full_name.ilike.%romero%')
    .or('team.ilike.%tottenham%,club.ilike.%tottenham%')
    .order('minutes', { ascending: false, nullsFirst: false })
    .limit(1);
  const { data, error } = await q;
  if (error) { console.error('query error:', error.message); return; }
  if (!data || !data.length) { console.log('NOT FOUND'); return; }
  const row = data[0];

  console.log('RAW ROW:', JSON.stringify(row, null, 2));
  console.log('\nleague strength for league_id', row.league_id, ':', leagueStrengthById(row.league_id));

  const comp = productionComponents(row, 'DEF');
  console.log('\nproductionComponents:', { vals: comp.vals, w: comp.w, ev: comp.ev });

  const scored = resolveRating(row);
  console.log('\nresolveRating() FULL:', JSON.stringify(scored, null, 2));
}

main();
