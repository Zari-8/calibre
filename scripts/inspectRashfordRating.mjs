// scripts/inspectRashfordRating.mjs — READ-ONLY. Answers a specific question:
// is Rashford's stored api_average_rating (8.9, seen alongside minutes=2763 in
// assessApiRatingDistribution.mjs's top-20) a genuine minutes-weighted season
// average, or is it being skewed by a single high-rated match/competition
// with disproportionate weight? Prints the full stored competition_splits
// breakdown (base/friendly/overlay), each with its own minutes + rating, so
// the source of the number is visible directly instead of guessed at.
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const f of ['.env', '.env.local']) {
  const p = join(ROOT, f);
  if (!existsSync(p)) continue;
  for (const l of readFileSync(p, 'utf8').split('\n')) {
    const m = l.match(/^([^#=]+)=(.*)/);
    if (m) process.env[m[1].trim()] ??= m[2].trim().replace(/^["']|["']$/g, '');
  }
}

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!URL || !KEY) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const { data, error } = await sb
  .from('players')
  .select('id,name,team,position,league_id,api_player_id,minutes,stats_minutes,appearances,starts,goals,assists,api_average_rating,rating,stats_season,stats_updated_at,competition_splits,hidden')
  .ilike('name', '%rashford%');

if (error) { console.error(error.message); process.exit(1); }
if (!data?.length) { console.log('No row found matching "rashford".'); process.exit(0); }

for (const r of data) {
  console.log('═'.repeat(70));
  console.log(r.name, '|', r.id, r.hidden ? '(HIDDEN)' : '');
  console.log('  team:', r.team, ' position:', r.position, ' league_id:', r.league_id);
  console.log('  api_player_id:', r.api_player_id, ' stats_season:', r.stats_season, ' stats_updated_at:', r.stats_updated_at);
  console.log('  TOTAL minutes:', r.minutes, ' stats_minutes:', r.stats_minutes, ' appearances:', r.appearances, ' starts:', r.starts);
  console.log('  goals:', r.goals, ' assists:', r.assists);
  console.log('  STORED api_average_rating (season, minutes-weighted across all splits):', r.api_average_rating);
  console.log('  STORED derived rating (0-100 engine output):', r.rating);

  const cs = r.competition_splits;
  if (!cs) { console.log('  competition_splits: none stored.'); continue; }

  for (const bucket of ['base', 'friendly', 'overlay']) {
    const b = cs[bucket];
    if (!b) continue;
    console.log(`  ── ${bucket} ${b.league_name ? `(${b.league_name})` : ''} ──`);
    console.log(`     minutes: ${b.minutes ?? b.stats_minutes ?? '—'}   appearances: ${b.appearances ?? '—'}   starts: ${b.starts ?? '—'}`);
    console.log(`     api_average_rating: ${b.api_average_rating ?? '—'}   goals: ${b.goals ?? '—'}   assists: ${b.assists ?? '—'}`);
    if (bucket === 'overlay' && b.strength != null) console.log(`     overlay strength: ${b.strength}`);
  }
}
console.log('═'.repeat(70));
