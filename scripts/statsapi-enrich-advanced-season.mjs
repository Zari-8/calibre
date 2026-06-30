#!/usr/bin/env node
import 'dotenv/config';
import fs from 'fs';
import path from 'path';

const API_KEY = process.env.STATSAPI_KEY;
const BASE = process.env.STATSAPI_BASE_URL || 'https://api.thestatsapi.com/api';
const OUT_DIR = process.env.STATSAPI_OUT_DIR || 'tmp-statsapi';
const DELAY_MS = Number(process.env.STATSAPI_DELAY_MS || 350);

const fromArg = process.argv[2] || '2025-08-01';
const toArg = process.argv[3] || '2026-05-31';
const competitionFilter = process.argv[4] || '';

if (!API_KEY) {
  console.error('Missing STATSAPI_KEY in .env or .env.local');
  process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(path.join(OUT_DIR, 'raw'), { recursive: true });

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      Accept: 'application/json',
    },
  });

  const text = await res.text();

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { rawText: text };
  }

  if (!res.ok) {
    throw new Error(`${res.status}: ${text.slice(0, 400)}`);
  }

  return json;
}

function rows(json) {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.data)) return json.data;
  if (Array.isArray(json.matches)) return json.matches;
  if (Array.isArray(json.results)) return json.results;
  return [];
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function pick(obj, keys, fallback = null) {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null) return obj[key];
  }
  return fallback;
}

function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

function writeCsv(file, data) {
  if (!data.length) {
    fs.writeFileSync(file, '');
    return;
  }

  const headers = Object.keys(data[0]);
  const lines = [
    headers.join(','),
    ...data.map(row => headers.map(h => csvEscape(row[h])).join(',')),
  ];

  fs.writeFileSync(file, lines.join('\n'));
}

function ensurePlayer(map, key, base) {
  if (!map.has(key)) {
    map.set(key, {
      provider: 'thestatsapi',
      provider_player_id: base.provider_player_id,
      player_name: base.player_name || '',
      team_id: base.team_id || '',
      team_name: base.team_name || '',
      competition_id: base.competition_id || '',
      season_id: base.season_id || '',
      appearances: 0,
      minutes: 0,
      goals: 0,
      assists: 0,
      shots: 0,
      shots_on_target: 0,
      xg: 0,
      npxg: 0,
      xa: 0,
      key_passes: 0,
      progressive_carries: 0,
      progressive_passes: 0,
      pressures: 0,
      tackles: 0,
      interceptions: 0,
      duels: 0,
      duels_won: 0,
      updated_at: new Date().toISOString(),
    });
  }
  return map.get(key);
}

function ensureTeam(map, key, base) {
  if (!map.has(key)) {
    map.set(key, {
      provider: 'thestatsapi',
      team_id: base.team_id || '',
      team_name: base.team_name || '',
      competition_id: base.competition_id || '',
      season_id: base.season_id || '',
      matches: 0,
      goals_for: 0,
      goals_against: 0,
      xg_for: 0,
      xg_against: 0,
      shots_for: 0,
      shots_against: 0,
      pressures: 0,
      updated_at: new Date().toISOString(),
    });
  }
  return map.get(key);
}

async function getMatches(from, to) {
  const all = [];
  let cursor = from;

  while (cursor <= to) {
    const windowEnd = addDays(cursor, 6) > to ? to : addDays(cursor, 6);
    const url = `${BASE}/football/matches?date_from=${cursor}&date_to=${windowEnd}`;

    console.log(`Fetching matches ${cursor} → ${windowEnd}`);
    const json = await fetchJson(url);
    const matchRows = rows(json);

    console.log(`  ${matchRows.length} matches`);

    for (const m of matchRows) {
      if (competitionFilter && m.competition_id !== competitionFilter) continue;
      all.push(m);
    }

    cursor = addDays(windowEnd, 1);
    await sleep(DELAY_MS);
  }

  const unique = new Map();
  for (const m of all) {
    const id = m.id || m.match_id;
    if (id) unique.set(id, m);
  }

  return [...unique.values()];
}

function extractShots(shotmapJson) {
  const direct = rows(shotmapJson);
  if (direct.length) return direct;

  if (Array.isArray(shotmapJson?.shots)) return shotmapJson.shots;
  if (Array.isArray(shotmapJson?.data?.shots)) return shotmapJson.data.shots;
  if (Array.isArray(shotmapJson?.shotmap)) return shotmapJson.shotmap;

  return [];
}

function extractPlayerStats(playerStatsJson) {
  const direct = rows(playerStatsJson);
  if (direct.length) return direct;

  if (Array.isArray(playerStatsJson?.players)) return playerStatsJson.players;
  if (Array.isArray(playerStatsJson?.data?.players)) return playerStatsJson.data.players;
  if (Array.isArray(playerStatsJson?.player_stats)) return playerStatsJson.player_stats;

  return [];
}

function aggregatePlayerStats(playerAgg, match, playerStatsJson) {
  const statsRows = extractPlayerStats(playerStatsJson);

  for (const row of statsRows) {
    const player = row.player || row;
    const team = row.team || {};

    const playerId = pick(row, ['player_id', 'playerId'], pick(player, ['id']));
    if (!playerId) continue;

    const teamId = pick(row, ['team_id', 'teamId'], pick(team, ['id']));
    const key = `${playerId}|${match.competition_id || ''}|${match.season_id || ''}`;

    const p = ensurePlayer(playerAgg, key, {
      provider_player_id: playerId,
      player_name: pick(row, ['player_name', 'name'], pick(player, ['name'], '')),
      team_id: teamId,
      team_name: pick(row, ['team_name'], pick(team, ['name'], '')),
      competition_id: match.competition_id || '',
      season_id: match.season_id || '',
    });

    p.appearances += 1;
    p.minutes += num(pick(row, ['minutes', 'mins', 'time_played']));
    p.goals += num(pick(row, ['goals']));
    p.assists += num(pick(row, ['assists']));
    p.shots += num(pick(row, ['shots', 'total_shots']));
    p.shots_on_target += num(pick(row, ['shots_on_target', 'sot']));
    p.xg += num(pick(row, ['xg', 'expected_goals']));
    p.npxg += num(pick(row, ['npxg', 'non_penalty_xg']));
    p.xa += num(pick(row, ['xa', 'expected_assists']));
    p.key_passes += num(pick(row, ['key_passes', 'chances_created']));
    p.progressive_carries += num(pick(row, ['progressive_carries', 'prog_carries']));
    p.progressive_passes += num(pick(row, ['progressive_passes', 'prog_passes']));
    p.pressures += num(pick(row, ['pressures', 'pressure_regains']));
    p.tackles += num(pick(row, ['tackles']));
    p.interceptions += num(pick(row, ['interceptions']));
    p.duels += num(pick(row, ['duels']));
    p.duels_won += num(pick(row, ['duels_won']));
  }
}

function aggregateShotmap(playerAgg, teamAgg, match, shotmapJson) {
  const shots = extractShots(shotmapJson);

  for (const shot of shots) {
    const player = shot.player || {};
    const team = shot.team || {};

    const playerId = pick(shot, ['player_id', 'playerId'], pick(player, ['id']));
    const teamId = pick(shot, ['team_id', 'teamId'], pick(team, ['id']));
    const xg = num(pick(shot, ['xg', 'expected_goals']));
    const outcome = String(pick(shot, ['outcome', 'result', 'type'], '')).toLowerCase();

    if (playerId) {
      const key = `${playerId}|${match.competition_id || ''}|${match.season_id || ''}`;

      const p = ensurePlayer(playerAgg, key, {
        provider_player_id: playerId,
        player_name: pick(shot, ['player_name'], pick(player, ['name'], '')),
        team_id: teamId,
        team_name: pick(shot, ['team_name'], pick(team, ['name'], '')),
        competition_id: match.competition_id || '',
        season_id: match.season_id || '',
      });

      p.shots += 1;
      p.xg += xg;
      if (outcome.includes('goal')) p.goals += 1;
      if (outcome.includes('target') || outcome.includes('goal')) p.shots_on_target += 1;
    }

    if (teamId) {
      const key = `${teamId}|${match.competition_id || ''}|${match.season_id || ''}`;
      const t = ensureTeam(teamAgg, key, {
        team_id: teamId,
        team_name: pick(shot, ['team_name'], pick(team, ['name'], '')),
        competition_id: match.competition_id || '',
        season_id: match.season_id || '',
      });

      t.shots_for += 1;
      t.xg_for += xg;
      if (outcome.includes('goal')) t.goals_for += 1;
    }
  }
}

async function main() {
  console.log(`Range: ${fromArg} → ${toArg}`);
  if (competitionFilter) console.log(`Competition filter: ${competitionFilter}`);

  const matches = await getMatches(fromArg, toArg);

  fs.writeFileSync(
    path.join(OUT_DIR, `matches-${fromArg}-to-${toArg}.json`),
    JSON.stringify(matches, null, 2)
  );

  console.log(`Unique matches: ${matches.length}`);
  console.log(`xG available: ${matches.filter(m => m.xg_available).length}`);

  const playerAgg = new Map();
  const teamAgg = new Map();
  const errors = [];

  for (const match of matches) {
    const matchId = match.id || match.match_id;
    if (!matchId) continue;

    console.log(`Fetching enrichment for ${matchId}`);

    try {
      const playerStats = await fetchJson(`${BASE}/football/matches/${matchId}/player-stats`);
      fs.writeFileSync(
        path.join(OUT_DIR, 'raw', `${matchId}-player-stats.json`),
        JSON.stringify(playerStats, null, 2)
      );
      aggregatePlayerStats(playerAgg, match, playerStats);
    } catch (e) {
      errors.push({ matchId, endpoint: 'player-stats', error: e.message });
    }

    await sleep(DELAY_MS);

    if (match.xg_available) {
      try {
        const shotmap = await fetchJson(`${BASE}/football/matches/${matchId}/shotmap`);
        fs.writeFileSync(
          path.join(OUT_DIR, 'raw', `${matchId}-shotmap.json`),
          JSON.stringify(shotmap, null, 2)
        );
        aggregateShotmap(playerAgg, teamAgg, match, shotmap);
      } catch (e) {
        errors.push({ matchId, endpoint: 'shotmap', error: e.message });
      }

      await sleep(DELAY_MS);
    }
  }

  const players = [...playerAgg.values()].map(p => ({
    ...p,
    xg: Number(p.xg.toFixed(3)),
    npxg: Number(p.npxg.toFixed(3)),
    xa: Number(p.xa.toFixed(3)),
    xg_per_90: p.minutes ? Number(((p.xg / p.minutes) * 90).toFixed(3)) : 0,
    xa_per_90: p.minutes ? Number(((p.xa / p.minutes) * 90).toFixed(3)) : 0,
    shots_per_90: p.minutes ? Number(((p.shots / p.minutes) * 90).toFixed(3)) : 0,
    shot_quality: p.shots ? Number((p.xg / p.shots).toFixed(3)) : 0,
  }));

  const teams = [...teamAgg.values()].map(t => ({
    ...t,
    xg_for: Number(t.xg_for.toFixed(3)),
    xg_against: Number(t.xg_against.toFixed(3)),
  }));

  fs.writeFileSync(
    path.join(OUT_DIR, 'player_advanced_season_stats.json'),
    JSON.stringify(players, null, 2)
  );
  writeCsv(path.join(OUT_DIR, 'player_advanced_season_stats.csv'), players);

  fs.writeFileSync(
    path.join(OUT_DIR, 'team_advanced_season_stats.json'),
    JSON.stringify(teams, null, 2)
  );
  writeCsv(path.join(OUT_DIR, 'team_advanced_season_stats.csv'), teams);

  fs.writeFileSync(
    path.join(OUT_DIR, 'statsapi_errors.json'),
    JSON.stringify(errors, null, 2)
  );

  console.log('');
  console.log('Done.');
  console.log(`Players enriched: ${players.length}`);
  console.log(`Teams enriched: ${teams.length}`);
  console.log(`Errors: ${errors.length}`);
  console.log(`Output folder: ${OUT_DIR}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
