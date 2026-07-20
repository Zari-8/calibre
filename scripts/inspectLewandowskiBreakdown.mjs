// scripts/inspectLewandowskiBreakdown.mjs — READ-ONLY. Runs the actual
// calibreRating() engine (the same pure function computeRatings.mjs uses to
// write players.rating) against the real Barcelona Lewandowski row, and
// prints its full internal breakdown — Performance/Consistency/Form/Impact/
// Trajectory, production, core, league strength, base/overlay blend — so we
// can see exactly which component is holding the final rating down to 64
// instead of guessing from the formulas alone.
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

const ID = process.env.PLAYER_ID || 'bc833b7d-38f3-4d11-a4fb-bee21fb3f7c3'; // real Barcelona R. Lewandowski row

const { data, error } = await sb.from('players').select('*').eq('id', ID).single();
if (error) { console.error(error.message); process.exit(1); }

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
