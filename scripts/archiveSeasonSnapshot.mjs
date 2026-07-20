// scripts/archiveSeasonSnapshot.mjs — READ-ONLY against `players`, WRITE-ONLY
// (upsert) into player_season_history (see migration
// 20260713d_player_season_history.sql for why this table exists).
//
// Run this once the current season is finished/finalized, and BEFORE
// pointing enrichPlayerStats.mjs / enrichStatsAPI.mjs / computeRatings.mjs /
// backfillPlayerInjuries.mjs at next season — those scripts overwrite
// `players` in place, so this is the only chance to freeze this season's
// numbers before they're gone.
//
// Only archives players with real season evidence (ability_rating populated
// or minutes > 0) — the players table has ~401k rows total but only a
// fraction are actively-tracked/scored players; archiving every row
// (reserve-team ghosts, zero-minute imports, etc.) would just bloat the
// history table with noise. Safe to re-run: upserts on (api_player_id,
// season), so running it twice before the season truly closes just
// refreshes the snapshot rather than duplicating rows.
//
//   SEASON=2025 node scripts/archiveSeasonSnapshot.mjs
//   SEASON=2025 DRY_RUN=1 node scripts/archiveSeasonSnapshot.mjs

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
if (!URL || !KEY) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const SEASON = String(process.env.SEASON || '2025');
const DRY_RUN = process.env.DRY_RUN === '1';
const PAGE_SIZE = 500;

const SELECT = [
  'id', 'api_player_id', 'name', 'team', 'api_team_id', 'league_id', 'position', 'pos', 'age',
  'appearances', 'starts', 'minutes', 'goals', 'assists',
  'api_average_rating', 'pass_accuracy', 'xg', 'xa', 'shot_accuracy', 'key_passes',
  'rating', 'ability_rating', 'availability_score',
  'injury_days_last_365', 'major_injuries_count',
  'competition_splits',
].join(',');

function toRow(p) {
  return {
    api_player_id: p.api_player_id,
    season: SEASON,
    name: p.name,
    team: p.team,
    api_team_id: p.api_team_id,
    league_id: p.league_id != null ? String(p.league_id) : null,
    position: p.position || p.pos || null,
    age: p.age,
    appearances: p.appearances,
    starts: p.starts,
    minutes: p.minutes,
    goals: p.goals,
    assists: p.assists,
    api_average_rating: p.api_average_rating,
    pass_accuracy: p.pass_accuracy,
    xg: p.xg,
    xa: p.xa,
    shot_accuracy: p.shot_accuracy,
    key_passes: p.key_passes,
    rating: p.rating,
    ability_rating: p.ability_rating,
    availability_score: p.availability_score,
    injury_days_last_365: p.injury_days_last_365,
    major_injuries_count: p.major_injuries_count,
    competition_splits: p.competition_splits,
    archived_at: new Date().toISOString(),
    source: 'season_rollover',
  };
}

async function main() {
  console.log(`Archiving season ${SEASON} snapshot${DRY_RUN ? ' [DRY RUN]' : ''}...\n`);
  let from = 0, total = 0, written = 0, failed = 0;

  while (true) {
    const { data, error } = await sb
      .from('players')
      .select(SELECT)
      .not('api_player_id', 'is', null)
      .or('ability_rating.not.is.null,minutes.gt.0')
      .range(from, from + PAGE_SIZE - 1);
    if (error) { console.error('Read failed:', error.message); process.exit(1); }
    if (!data || !data.length) break;

    total += data.length;
    if (!DRY_RUN) {
      const rows = data.map(toRow);
      const { error: upsertErr } = await sb
        .from('player_season_history')
        .upsert(rows, { onConflict: 'api_player_id,season' });
      if (upsertErr) { console.error(`  batch @${from} failed: ${upsertErr.message}`); failed += data.length; }
      else written += data.length;
    } else {
      written += data.length;
    }

    console.log(`  processed ${total}...`);
    from += PAGE_SIZE;
  }

  console.log(`\nDone. Candidates: ${total}  Written: ${written}  Failed: ${failed}`);
  if (DRY_RUN) console.log('DRY RUN — no writes were made.');
}

main().catch((e) => { console.error(e); process.exit(1); });
