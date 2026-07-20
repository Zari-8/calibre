// scripts/checkFatiIds.mjs — READ-ONLY diagnostic. Ansu Fati's row still
// shows ability_rating/injury fields as null despite computeRatings.mjs and
// backfillPlayerInjuries.mjs both having been discussed/run this session.
// This checks two separate possible causes:
//   1. Is ability_rating null repo-wide (computeRatings.mjs never actually
//      run for real, only demonstrated via inspect scripts) or just for Fati?
//   2. Does Fati's stored api_team_id actually match Monaco's real
//      API-Football team id? backfillPlayerInjuries.mjs loops by
//      api_team_id, not the free-text `team` column — if his transfer
//      updated `team` to "Monaco" but api_team_id is stale (still
//      Barcelona's 529, or null), the injury backfill would silently never
//      have queried the right team for him.
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
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const { data, error } = await sb
  .from('players')
  .select('id, name, team, api_player_id, api_team_id, rating, ability_rating, availability_score, injury_days_last_365, major_injuries_count, injuries_synced_at')
  .ilike('name', '%ansu fati%');
if (error) { console.error(error.message); process.exit(1); }
console.log('── Ansu Fati row(s) ──');
console.log(JSON.stringify(data, null, 2));

const { count: totalAbility } = await sb.from('players').select('id', { count: 'exact', head: true }).not('ability_rating', 'is', null);
const { count: totalPlayers } = await sb.from('players').select('id', { count: 'exact', head: true });
const { count: totalInjurySynced } = await sb.from('players').select('id', { count: 'exact', head: true }).not('injuries_synced_at', 'is', null);

console.log(`\nRepo-wide: ${totalAbility}/${totalPlayers} players have non-null ability_rating`);
console.log(`Repo-wide: ${totalInjurySynced}/${totalPlayers} players have non-null injuries_synced_at`);
