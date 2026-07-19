// scripts/inspectPlayerBreakdown.mjs — READ-ONLY. General-purpose version of
// the Rashford/Lewandowski one-off diagnostics: fetches a player by name (or
// exact id) and runs the real calibreRating() engine against their row,
// printing the full internal breakdown so a "this rating looks wrong" claim
// can be checked against the actual formula instead of guessed at.
//
// Usage:
//   NAME="ansu fati" node scripts/inspectPlayerBreakdown.mjs
//   ID=<uuid> node scripts/inspectPlayerBreakdown.mjs      (skip name search)
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

const NAME = process.env.NAME;
const ID = process.env.ID;
if (!NAME && !ID) { console.error('Set NAME="player name" or ID=<uuid>'); process.exit(1); }

let rows;
if (ID) {
  const { data, error } = await sb.from('players').select('*').eq('id', ID);
  if (error) { console.error(error.message); process.exit(1); }
  rows = data;
} else {
  const { data, error } = await sb.from('players').select('*').ilike('name', `%${NAME}%`).order('name');
  if (error) { console.error(error.message); process.exit(1); }
  rows = data;
}

if (!rows?.length) { console.log('No matching row.'); process.exit(0); }

if (rows.length > 1 && !ID) {
  console.log(`${rows.length} matches — narrow with ID=<uuid> from the list below:\n`);
  for (const r of rows) {
    console.log(`  ${r.id}  ${r.name.padEnd(24)} team=${r.team ?? '—'}  hidden=${!!r.hidden}  rating=${r.rating ?? '—'}`);
  }
  process.exit(0);
}

const data = rows[0];
console.log('── raw row (rating-relevant fields) ──');
console.log({
  name: data.name, team: data.team, age: data.age, league_id: data.league_id,
  minutes: data.minutes, stats_minutes: data.stats_minutes, appearances: data.appearances, starts: data.starts,
  goals: data.goals, assists: data.assists, api_average_rating: data.api_average_rating,
  pass_accuracy: data.pass_accuracy, xg: data.xg, xa: data.xa, shot_accuracy: data.shot_accuracy,
  stored_rating: data.rating,
});

console.log('\n── competition_splits ──');
console.log(JSON.stringify(data.competition_splits, null, 2));

const result = calibreRating(data);
console.log('\n── calibreRating() live recompute ──');
console.log(JSON.stringify(result, null, 2));

console.log(`\nStored players.rating: ${data.rating}   Live recompute: ${result?.computed ?? result?.rating}`);
if (Number(data.rating) !== Number(result?.computed ?? result?.rating)) {
  console.log('⚠ stored value and live recompute DIFFER — players.rating is stale, computeRatings.mjs needs a re-run for this row.');
}
