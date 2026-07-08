// scripts/inspectSuperstars.mjs — read-only. Full-row dump for players whose
// rating looks impossibly low for their profile, to see whether it's a
// hollow/duplicate row, a wrong-season pull, or something else.
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!URL || !KEY) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const NAMES = ['salah', 'lewandowski', 'suarez', 'suárez', 'chris wood', 'mbeumo', 'luis d', 'guirassy'];

const { data, error } = await sb
  .from('players')
  .select('id,name,position,league_id,api_player_id,statsapi_player_id,minutes,stats_minutes,appearances,starts,goals,assists,api_average_rating,rating,stats_season,stats_updated_at,competition_splits')
  .or(NAMES.map((n) => `name.ilike.%${n}%`).join(','))
  .order('name');

if (error) { console.error(error.message); process.exit(1); }

for (const r of data || []) {
  console.log('─'.repeat(70));
  console.log(r.name, '|', r.id);
  console.log('  position:', r.position, ' league_id:', r.league_id);
  console.log('  api_player_id:', r.api_player_id, ' statsapi_player_id:', r.statsapi_player_id);
  console.log('  minutes:', r.minutes, ' stats_minutes:', r.stats_minutes, ' appearances:', r.appearances, ' starts:', r.starts);
  console.log('  goals:', r.goals, ' assists:', r.assists, ' api_average_rating:', r.api_average_rating);
  console.log('  stored rating:', r.rating, ' stats_season:', r.stats_season, ' stats_updated_at:', r.stats_updated_at);
  console.log('  has competition_splits:', !!r.competition_splits);
}
console.log('─'.repeat(70));
console.log(`\n${(data || []).length} row(s) found.`);
