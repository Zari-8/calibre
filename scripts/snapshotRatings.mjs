import { createClient } from '@supabase/supabase-js';
import { calibreRating } from '../src/services/calibreRating.js';

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY = process.env.DRY_RUN === '1';
const BATCH = 1000;
const COLS = 'api_player_id,league_id,age,position,archetype,pos,primary_role,minutes,appearances,starts,goals,assists,api_average_rating,stats_minutes,passes,pass_accuracy,key_passes,dribbles_success,dribbles_attempts,tackles,interceptions,duels_won,shots,competition_splits';

async function main() {
  if (!URL || !KEY) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
  const db = createClient(URL, KEY, { auth: { persistSession: false } });
  const day = new Date().toISOString().slice(0, 10);
  console.error('snapshot ' + day + (DRY ? ' (DRY)' : '') + ' starting...');
  let from = 0, scanned = 0, wrote = 0, skipped = 0;
  for (;;) {
    const { data, error } = await db.from('players').select(COLS)
      .gt('api_player_id', 0).or('minutes.gt.0,appearances.gt.0')
      .order('api_player_id', { ascending: true }).range(from, from + BATCH - 1);
    if (error) { console.error('read failed: ' + error.message); process.exit(1); }
    if (!data || !data.length) break;
    scanned += data.length;
    const rows = [];
    for (const p of data) {
      const r = calibreRating(p);
      if (r && r.rating != null) rows.push({ api_player_id: Number(p.api_player_id), rating: r.rating, snapshot_date: day });
      else skipped++;
    }
    if (rows.length && !DRY) {
      const { error: werr } = await db.from('player_rating_history').upsert(rows, { onConflict: 'api_player_id,snapshot_date' });
      if (werr) { console.error('write failed: ' + werr.message); process.exit(1); }
    }
    wrote += rows.length;
    console.error('  scanned ' + scanned + ' / rated ' + wrote);
    if (data.length < BATCH) break;
    from += BATCH;
  }
  console.error((DRY ? '[DRY] ' : '') + 'snapshot ' + day + ': scanned=' + scanned + ' wrote=' + wrote + ' skipped=' + skipped);
}

main().catch((e) => { console.error(e); process.exit(1); });
