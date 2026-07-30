// scripts/inspectEliteRatingBreakdown.mjs — READ-ONLY. No writes.
//
// ratingBandDistribution.mjs found the NEW (v8.9 league-strength-rebuild)
// engine produces ZERO players rated >=90, down from 2 under the OLD
// engine, and the whole distribution above 70 is compressed hard. This
// checks whether that's a data problem or a formula problem: pulls a
// handful of unambiguously elite players (Mbappé, Kane, plus anyone else
// passed in NAMES) directly from the DB, runs them through the real
// calibreRating() engine (same code path the app and computeRatings.mjs
// use), and prints the FULL breakdown -- Performance/Consistency/Form/
// Impact/Trajectory, leagueStrength, core/production, ability/availability
// -- so we can see exactly which component is dragging elite players down
// instead of guessing from the final number alone.
//
// auditStatsFreshness.mjs already confirmed Mbappé's and Kane's stored
// data has ZERO drift from a fresh API-Football pull, ruling out stale
// input data as the cause -- so this is specifically hunting for a
// formula/calibration issue in v8.9's league-strength rescale or the
// RATING_CALIBRATION_ANCHORS remap.
//
// Run: node scripts/inspectEliteRatingBreakdown.mjs
//      NAMES="Haaland,Vinicius" node scripts/inspectEliteRatingBreakdown.mjs   (add more)
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { calibreRating } from '../src/services/calibreRating.js';

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

const DEFAULT_NAMES = ['Mbappé', 'Kane'];
const NAMES = (process.env.NAMES ? process.env.NAMES.split(',') : DEFAULT_NAMES).map(s => s.trim()).filter(Boolean);

async function run() {
  const { data, error } = await sb.from('players').select('*')
    .or(NAMES.map(n => `name.ilike.%${n}%`).join(','));
  if (error) { console.error('Query failed:', error.message); process.exit(1); }
  if (!data?.length) { console.log('No matches.'); return; }

  for (const row of data) {
    console.log('═'.repeat(70));
    console.log(`${row.name} (${row.team ?? '—'})  league_id=${row.league_id ?? '—'}  api_player_id=${row.api_player_id}`);
    console.log(`  minutes=${row.minutes}  appearances=${row.appearances}  api_average_rating=${row.api_average_rating}`);
    console.log(`  goals=${row.goals}  assists=${row.assists}  stored rating=${row.rating}  stored ability=${row.ability_rating}  stored availability=${row.availability_score}`);

    let res;
    try { res = calibreRating(row); } catch (e) { console.log(`  calibreRating() threw: ${e.message}`); continue; }
    if (!res) { console.log('  calibreRating() returned nothing.'); continue; }

    console.log(`\n  ── Live recompute (current working-tree engine) ──`);
    console.log(`  rating=${res.rating}  ability=${res.ability}  availability=${res.availability}  confidence=${res.confidence}  bucket=${res.bucket}  provisional=${res.provisional}`);
    console.log(`  core=${res.core}  production=${res.production}  leagueStrength=${res.leagueStrength}`);
    if (res.breakdown) {
      console.log(`  breakdown:`);
      for (const [k, v] of Object.entries(res.breakdown)) console.log(`    ${k.padEnd(14)} ${v}`);
    } else {
      console.log('  breakdown: null (no evidence)');
    }
  }
  console.log('═'.repeat(70));
}

run().catch(e => { console.error('\nFatal:', e?.message ?? e); process.exit(1); });
