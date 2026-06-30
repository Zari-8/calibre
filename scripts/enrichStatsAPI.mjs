/**
 * enrichStatsAPI.mjs — Calibre × TheStatsAPI match-based enrichment
 *
 * Uses:
 *   /matches?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
 *   /matches/{match_id}/player-stats
 *   /matches/{match_id}/shotmap
 *
 * Run:
 *   DRY_RUN=1 DATE_FROM=2025-08-01 DATE_TO=2025-08-10 node scripts/enrichStatsAPI.mjs
 *   DRY_RUN=1 COMP=comp_3039 DATE_FROM=2025-08-01 DATE_TO=2025-08-10 node scripts/enrichStatsAPI.mjs
 *   COMP=comp_3039 DATE_FROM=2025-08-01 DATE_TO=2025-08-10 node scripts/enrichStatsAPI.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
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

const API_KEY = process.env.STATSAPI_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY;

const DRY_RUN = process.env.DRY_RUN === '1';
const ONLY_COMP = process.env.COMP || null;
const DATE_FROM = process.env.DATE_FROM || process.argv[2] || '2025-08-01';
const DATE_TO = process.env.DATE_TO || process.argv[3] || '2025-08-10';
const DELAY_MS = Number(process.env.DELAY_MS || 500);
const WRITE_RAW = process.env.WRITE_RAW === '1';
const OUT_DIR = join(ROOT, 'tmp-statsapi');
const BASE = 'https://api.thestatsapi.com/api/football';

if (!API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing env vars. Need STATSAPI_KEY, SUPABASE_URL/VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const COMPETITIONS = [
  { name: 'Premier League', id: 'comp_3039' },
  { name: 'LaLiga', id: 'comp_8814' },
  { name: 'Bundesliga', id: 'comp_4643' },
  { name: 'Serie A', id: 'comp_5840' },
  { name: 'Ligue 1', id: 'comp_0256' },
  { name: 'Eredivisie', id: 'comp_3809' },
  { name: 'Pro League', id: 'comp_8531' },
  { name: 'Liga Portugal', id: 'comp_8385' },
  { name: 'Brasileirão', id: 'comp_4795' },
];

const TARGET_COMP_IDS = new Set(
  ONLY_COMP ? [ONLY_COMP] : COMPETITIONS.map(c => c.id)
);

if (WRITE_RAW) mkdirSync(join(OUT_DIR, 'raw'), { recursive: true });

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
const sleep = ms => new Promise(r => setTimeout(r, ms));

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function round(v, dp = 3) {
  return Number(num(v).toFixed(dp));
}

function rows(json) {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.matches)) return json.matches;
  if (Array.isArray(json?.results)) return json.results;
  return [];
}

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function norm(s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function api(path, attempt = 0) {
  await sleep(DELAY_MS);

  const res = await fetch(`${BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      Accept: 'application/json',
    },
  });

  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { rawText: text }; }

  if (res.status === 429) {
    const wait = [10000, 20000, 40000, 60000][Math.min(attempt, 3)];
    console.log(`  [429] waiting ${wait / 1000}s...`);
    await sleep(wait);
    return api(path, attempt + 1);
  }

  if (!res.ok) {
    const msg = json?.error?.message || text.slice(0, 300);
    throw new Error(`HTTP ${res.status} — ${path} — ${msg}`);
  }

  if (json.error) throw new Error(json.error.message || JSON.stringify(json.error));
  return json;
}

async function fetchMatches(from, to) {
  const all = [];
  let cursor = from;

  while (cursor <= to) {
    const end = addDays(cursor, 6);
    const windowEnd = end > to ? to : end;

    console.log(`Fetching matches ${cursor} → ${windowEnd}`);

    let page = 1;
    let windowTotal = 0;

    while (true) {
      const compParam = ONLY_COMP ? `&competition_id=${ONLY_COMP}` : '';
      const json = await api(`/matches?date_from=${cursor}&date_to=${windowEnd}${compParam}&page=${page}`);

      const batch = rows(json)
        .filter(m => TARGET_COMP_IDS.has(m.competition_id));

      windowTotal += batch.length;
      all.push(...batch);

      const totalPages = json.meta?.total_pages || 1;
      if (page >= totalPages) break;
      page++;
    }

    console.log(`  ${windowTotal} target matches`);
    cursor = addDays(windowEnd, 1);
  }

  const unique = new Map();
  for (const m of all) {
    const id = m.id || m.match_id;
    if (id) unique.set(id, m);
  }

  return [...unique.values()];
}

function ensurePlayer(map, playerId, base) {
  const key = `${playerId}|${base.competition_id || ''}|${base.season_id || ''}`;

  if (!map.has(key)) {
    map.set(key, {
      statsapi_player_id: playerId,
      player_name: base.player_name || '',
      statsapi_team_id: base.team_id || '',
      team_name: base.team_name || '',
      statsapi_competition_id: base.competition_id || '',
      statsapi_season_id: base.season_id || '',

      appearances: 0,
      starts: 0,
      stats_minutes: 0,

      goals: 0,
      assists: 0,

      total_shots: 0,
      shots_on_target: 0,
      shots_off_target: 0,
      blocked_shots: 0,

      expected_goals: 0,
      np_expected_goals: 0,
      expected_assists: 0,
      shotmap_xg: 0,
      open_play_xg: 0,
      set_piece_xg: 0,
      penalty_xg: 0,
      headed_xg: 0,
      outside_box_xg: 0,
      big_chances_created: 0,

      total_passes: 0,
      accurate_passes: 0,
      key_passes: 0,
      total_crosses: 0,
      accurate_crosses: 0,
      total_long_balls: 0,
      accurate_long_balls: 0,

      duel_won: 0,
      duel_lost: 0,
      aerial_won: 0,
      challenge_lost: 0,
      won_contest: 0,
      dispossessed: 0,

      tackles: 0,
      interceptions: 0,
      clearances: 0,

      touches: 0,
      fouls: 0,
      was_fouled: 0,
      offsides: 0,
      yellow_cards: 0,
      red_cards: 0,
      possession_lost: 0,
    });
  }

  return map.get(key);
}

function ensureTeam(map, teamId, base) {
  const key = `${teamId}|${base.competition_id || ''}|${base.season_id || ''}`;

  if (!map.has(key)) {
    map.set(key, {
      statsapi_team_id: teamId,
      team_name: base.team_name || '',
      statsapi_competition_id: base.competition_id || '',
      statsapi_season_id: base.season_id || '',
      shots_for: 0,
      shots_on_target_for: 0,
      xg_for: 0,
      goals_for: 0,
      open_play_xg_for: 0,
      set_piece_xg_for: 0,
      penalty_xg_for: 0,
    });
  }

  return map.get(key);
}

function aggregatePlayerStats(playerAgg, match, json) {
  for (const row of rows(json)) {
    const playerId = row.player_id;
    if (!playerId) continue;

    const player = ensurePlayer(playerAgg, playerId, {
      player_name: row.player_name,
      team_id: row.team_id,
      team_name: row.team_name,
      competition_id: match.competition_id,
      season_id: match.season_id,
    });

    const passing = row.passing || {};
    const shooting = row.shooting || {};
    const duels = row.duels || {};
    const defending = row.defending || {};
    const general = row.general || {};

    player.appearances += row.played ? 1 : 0;
    player.starts += row.started ? 1 : 0;
    player.stats_minutes += num(row.minutes_played);

    player.goals += num(shooting.goals);
    player.assists += num(passing.assists);

    player.total_shots += num(shooting.total_shots);
    player.shots_on_target += num(shooting.shots_on_target);
    player.shots_off_target += num(shooting.shots_off_target);
    player.blocked_shots += num(shooting.blocked_shots);

    player.expected_goals += num(shooting.expected_goals);
    player.np_expected_goals += num(shooting.np_expected_goals);
    player.expected_assists += num(shooting.expected_assists);
    player.big_chances_created += num(shooting.big_chances_created);

    player.total_passes += num(passing.total_passes);
    player.accurate_passes += num(passing.accurate_passes);
    player.key_passes += num(passing.key_passes);
    player.total_crosses += num(passing.total_crosses);
    player.accurate_crosses += num(passing.accurate_crosses);
    player.total_long_balls += num(passing.total_long_balls);
    player.accurate_long_balls += num(passing.accurate_long_balls);

    player.duel_won += num(duels.duel_won);
    player.duel_lost += num(duels.duel_lost);
    player.aerial_won += num(duels.aerial_won);
    player.challenge_lost += num(duels.challenge_lost);
    player.won_contest += num(duels.won_contest);
    player.dispossessed += num(duels.dispossessed);

    player.tackles += num(defending.tackles);
    player.interceptions += num(defending.interceptions);
    player.clearances += num(defending.clearances);

    player.touches += num(general.touches);
    player.fouls += num(general.fouls);
    player.was_fouled += num(general.was_fouled);
    player.offsides += num(general.offsides);
    player.yellow_cards += num(general.yellow_cards);
    player.red_cards += num(general.red_cards);
    player.possession_lost += num(general.possession_lost);
  }
}

function shotRows(json) {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.shots)) return json.shots;
  if (Array.isArray(json?.shotmap)) return json.shotmap;
  return [];
}

function aggregateShotmap(playerAgg, teamAgg, match, json) {
  for (const shot of shotRows(json)) {
    const playerId = shot.player_id;
    const teamId = shot.team_id;
    const xg = num(shot.expected_goals);
    const situation = String(shot.situation || '').toLowerCase();

    if (playerId) {
      const player = ensurePlayer(playerAgg, playerId, {
        player_name: shot.player_name,
        team_id: shot.team_id,
        team_name: shot.team_name,
        competition_id: match.competition_id,
        season_id: match.season_id,
      });

      player.shotmap_xg += xg;

      if (shot.is_goal) player.goals += 1;
      if (shot.is_on_target || shot.is_goal) player.shots_on_target += 1;

      if (shot.is_penalty) player.penalty_xg += xg;
      else if (situation.includes('corner') || situation.includes('free') || situation.includes('set')) player.set_piece_xg += xg;
      else player.open_play_xg += xg;

      if (shot.is_headed) player.headed_xg += xg;
      if (shot.is_outside_box) player.outside_box_xg += xg;
    }

    if (teamId) {
      const team = ensureTeam(teamAgg, teamId, {
        team_name: shot.team_name,
        competition_id: match.competition_id,
        season_id: match.season_id,
      });

      team.shots_for += 1;
      team.xg_for += xg;
      if (shot.is_goal) team.goals_for += 1;
      if (shot.is_on_target || shot.is_goal) team.shots_on_target_for += 1;

      if (shot.is_penalty) team.penalty_xg_for += xg;
      else if (situation.includes('corner') || situation.includes('free') || situation.includes('set')) team.set_piece_xg_for += xg;
      else team.open_play_xg_for += xg;
    }
  }
}

function buildPlayerUpdate(player) {
  const minutes = player.stats_minutes || 0;
  const shots = player.total_shots || 0;
  const passes = player.total_passes || 0;
  const crosses = player.total_crosses || 0;
  const longBalls = player.total_long_balls || 0;
  const duels = player.duel_won + player.duel_lost;

  const xg = player.expected_goals > 0 ? player.expected_goals : player.shotmap_xg;
  const npxg = player.np_expected_goals > 0 ? player.np_expected_goals : Math.max(0, xg - player.penalty_xg);

  return {
    statsapi_player_id: player.statsapi_player_id,
    statsapi_season_id: player.statsapi_season_id,
    statsapi_competition_id: player.statsapi_competition_id,
    statsapi_enriched_at: new Date().toISOString(),

    xg: round(xg),
    npxg: round(npxg),
    xa: round(player.expected_assists),
    expected_goals: round(xg),
    np_expected_goals: round(npxg),
    expected_assists: round(player.expected_assists),
    open_play_xg: round(player.open_play_xg),
    set_piece_xg: round(player.set_piece_xg),
    penalty_xg: round(player.penalty_xg),
    headed_xg: round(player.headed_xg),
    outside_box_xg: round(player.outside_box_xg),
    xg_per_90: minutes ? round((xg / minutes) * 90) : null,
    xa_per_90: minutes ? round((player.expected_assists / minutes) * 90) : null,
    shot_quality: shots ? round(xg / shots) : null,

    big_chances_created: player.big_chances_created || null,
    total_shots: player.total_shots || null,
    shots_on_target: player.shots_on_target || null,
    shots_off_target: player.shots_off_target || null,
    blocked_shots: player.blocked_shots || null,
    shot_accuracy: shots ? Math.round((player.shots_on_target / shots) * 100) : null,

    total_passes: player.total_passes || null,
    accurate_passes: player.accurate_passes || null,
    pass_accuracy: passes ? Math.round((player.accurate_passes / passes) * 100) : null,
    key_passes: player.key_passes || null,
    total_crosses: player.total_crosses || null,
    accurate_crosses: player.accurate_crosses || null,
    cross_accuracy: crosses ? Math.round((player.accurate_crosses / crosses) * 100) : null,
    total_long_balls: player.total_long_balls || null,
    accurate_long_balls: player.accurate_long_balls || null,
    long_ball_accuracy: longBalls ? Math.round((player.accurate_long_balls / longBalls) * 100) : null,

    ground_duel_win_pct: duels ? Math.round((player.duel_won / duels) * 100) : null,
    aerial_duels_won: player.aerial_won || null,
    successful_dribbles: player.won_contest || null,
    dispossessed: player.dispossessed || null,
    possession_lost: player.possession_lost || null,
    touches: player.touches || null,
    was_fouled: player.was_fouled || null,

    tackles: player.tackles || null,
    interceptions: player.interceptions || null,
    clearances: player.clearances || null,

    progressive_carries: null,
    pressures: null,
  };
}

function dropMissingColumn(fields, message) {
  const match = String(message || '').match(/'([^']+)'|"([^"]+)"/);
  const col = match?.[1] || match?.[2];
  if (!col || !(col in fields)) return null;
  const copy = { ...fields };
  delete copy[col];
  return { fields: copy, column: col };
}

async function updatePlayer(rowId, fields) {
  if (DRY_RUN) return { ok: true, dropped: [] };

  let current = { ...fields };
  const dropped = [];

  for (let i = 0; i < 40; i++) {
    const { error } = await sb.from('players').update(current).eq('id', rowId);
    if (!error) return { ok: true, dropped };

    const msg = String(error.message || '');
    const isColumnIssue =
      msg.includes('column') ||
      msg.includes('schema cache') ||
      msg.includes('Could not find');

    if (!isColumnIssue) return { ok: false, error, dropped };

    const next = dropMissingColumn(current, msg);
    if (!next) return { ok: false, error, dropped };

    dropped.push(next.column);
    current = next.fields;
  }

  return { ok: false, error: new Error('Too many missing-column retries'), dropped };
}

const nameCache = new Map();
const statsapiIdCache = new Map();

async function findPlayer({ statsapiPlayerId, playerName }) {
  if (statsapiPlayerId) {
    const key = String(statsapiPlayerId);
    if (statsapiIdCache.has(key)) return statsapiIdCache.get(key);

    const { data } = await sb.from('players')
      .select('id, name, statsapi_player_id')
      .eq('statsapi_player_id', key)
      .limit(1);

    if (data?.length) {
      statsapiIdCache.set(key, data[0]);
      return data[0];
    }
  }

  const key = norm(playerName);
  if (!key) return null;
  if (nameCache.has(key)) return nameCache.get(key);

  let { data } = await sb.from('players')
    .select('id, name, statsapi_player_id')
    .ilike('name', playerName)
    .limit(1);

  if (!data?.length) {
    ({ data } = await sb.from('players')
      .select('id, name, statsapi_player_id')
      .ilike('name', `%${key}%`)
      .limit(1));
  }

  const row = data?.[0] || null;
  nameCache.set(key, row);
  return row;
}

async function main() {
  console.log(DRY_RUN ? 'DRY RUN\n' : 'LIVE RUN\n');
  console.log('Date range:', DATE_FROM, '→', DATE_TO);
  if (ONLY_COMP) console.log('Competition:', ONLY_COMP);
  console.log('');

  const matches = await fetchMatches(DATE_FROM, DATE_TO);

  console.log(`\nUnique target matches: ${matches.length}`);
  console.log(`xG available matches : ${matches.filter(m => m.xg_available).length}\n`);

  const playerAgg = new Map();
  const teamAgg = new Map();

  let playerStatsOk = 0;
  let shotmapOk = 0;
  let matchErrors = 0;

  for (const match of matches) {
    const matchId = match.id || match.match_id;
    if (!matchId) continue;

    console.log(`Fetching enrichment for ${matchId}`);

    try {
      const ps = await api(`/matches/${matchId}/player-stats`);
      if (WRITE_RAW) writeFileSync(join(OUT_DIR, 'raw', `${matchId}-player-stats.json`), JSON.stringify(ps, null, 2));
      aggregatePlayerStats(playerAgg, match, ps);
      playerStatsOk++;
    } catch (e) {
      matchErrors++;
      console.error(`  player-stats: ${e.message}`);
    }

    if (match.xg_available) {
      try {
        const sm = await api(`/matches/${matchId}/shotmap`);
        if (WRITE_RAW) writeFileSync(join(OUT_DIR, 'raw', `${matchId}-shotmap.json`), JSON.stringify(sm, null, 2));
        aggregateShotmap(playerAgg, teamAgg, match, sm);
        shotmapOk++;
      } catch (e) {
        matchErrors++;
        console.error(`  shotmap: ${e.message}`);
      }
    }
  }

  const players = [...playerAgg.values()];
  const teams = [...teamAgg.values()];

  console.log(`\nAggregated players: ${players.length}`);
  console.log(`Aggregated teams  : ${teams.length}`);
  console.log(`player-stats OK   : ${playerStatsOk}`);
  console.log(`shotmap OK        : ${shotmapOk}`);
  console.log(`Match errors      : ${matchErrors}`);

  let enriched = 0;
  let noMatch = 0;
  let errors = 0;
  const droppedColumns = new Map();

  for (const player of players) {
    const row = await findPlayer({
      statsapiPlayerId: player.statsapi_player_id,
      playerName: player.player_name,
    });

    if (!row) {
      noMatch++;
      continue;
    }

    const fields = buildPlayerUpdate(player);
    const result = await updatePlayer(row.id, fields);

    if (!result.ok) {
      errors++;
      console.error(`  update error ${player.player_name}: ${result.error?.message || result.error}`);
      continue;
    }

    for (const col of result.dropped || []) {
      droppedColumns.set(col, (droppedColumns.get(col) || 0) + 1);
    }

    enriched++;
  }

  console.log(`\n── Summary ──────────────────`);
  console.log(`Enriched players : ${enriched}`);
  console.log(`No Supabase match: ${noMatch}`);
  console.log(`Update errors    : ${errors}`);
  console.log(`Team aggregates  : ${teams.length} not written yet`);
  console.log(`Dry run          : ${DRY_RUN ? 'yes' : 'no'}`);

  if (droppedColumns.size) {
    console.log('\nMissing columns dropped during update:');
    for (const [col, count] of droppedColumns.entries()) {
      console.log(`  ${col}: ${count}`);
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
