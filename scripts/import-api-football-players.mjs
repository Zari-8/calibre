#!/usr/bin/env node

/**
 * Calibre API-Football -> Supabase player importer
 *
 * What it does:
 * 1. Loads every team in a league from API-Football.
 * 2. Loads each team's current squad.
 * 3. Upserts player profiles into Supabase using api_player_id.
 *
 * This is a LOCAL/BACKEND script only.
 * Never expose SUPABASE_SERVICE_ROLE_KEY in frontend code or commit it to GitHub.
 *
 * Examples:
 *   node scripts/import-api-football-players.mjs --league=140 --season=2025
 *   node scripts/import-api-football-players.mjs --team=529 --league=140 --season=2025
 *   node scripts/import-api-football-players.mjs --league=140 --season=2025 --dry-run
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const API_BASE_URL = 'https://v3.football.api-sports.io';
const DEFAULT_DELAY_MS = 275;

function getArg(name, fallback = null) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanText(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function compactPosition(rawPosition) {
  const value = cleanText(rawPosition);
  if (!value) return 'Player';

  const lookup = {
    goalkeeper: 'GK',
    defender: 'DEF',
    midfielder: 'MID',
    attacker: 'FWD',
    forward: 'FWD',
  };

  return lookup[value.toLowerCase()] || value;
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseEnvFile(contents) {
  const output = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separator = line.indexOf('=');
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    output[key] = value;
  }

  return output;
}

async function loadLocalEnv() {
  const candidates = ['.env.import.local', '.env.local'];

  for (const filename of candidates) {
    try {
      const contents = await fs.readFile(filename, 'utf8');
      const parsed = parseEnvFile(contents);

      for (const [key, value] of Object.entries(parsed)) {
        if (!process.env[key]) process.env[key] = value;
      }

      console.log(`Loaded environment variables from ${filename}`);
      return;
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
}

async function loadPositionOverrides() {
  const overridePath = path.resolve('scripts/player-position-overrides.json');

  try {
    const contents = await fs.readFile(overridePath, 'utf8');
    return JSON.parse(contents);
  } catch (error) {
    if (error?.code === 'ENOENT') return {};
    throw new Error(`Could not read ${overridePath}: ${error.message}`);
  }
}

async function apiFootballGet(endpoint, params, apiKey) {
  const url = new URL(`${API_BASE_URL}${endpoint}`);

  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    headers: {
      'x-apisports-key': apiKey,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `API-Football request failed: ${response.status} ${response.statusText}\n${body}`
    );
  }

  const payload = await response.json();

  if (payload.errors && Object.keys(payload.errors).length > 0) {
    throw new Error(`API-Football error: ${JSON.stringify(payload.errors)}`);
  }

  return payload.response || [];
}

async function loadTeams({ leagueId, season, teamId, apiKey }) {
  if (teamId) {
    const response = await apiFootballGet('/teams', { id: teamId }, apiKey);

    if (!response.length) {
      throw new Error(`No team was found for API-Football team ID ${teamId}.`);
    }

    return response;
  }

  if (!leagueId) {
    throw new Error('Provide --league=<API_FOOTBALL_LEAGUE_ID> or --team=<API_FOOTBALL_TEAM_ID>.');
  }

  const response = await apiFootballGet('/teams', { league: leagueId, season }, apiKey);

  if (!response.length) {
    throw new Error(`No teams were found for league ${leagueId}, season ${season}.`);
  }

  return response;
}

async function loadTeamSquad(teamId, apiKey) {
  const response = await apiFootballGet('/players/squads', { team: teamId }, apiKey);
  const squad = response[0];

  return {
    team: squad?.team || null,
    players: squad?.players || [],
  };
}

function buildPlayerRow({ player, team, leagueId, season, overrides }) {
  const override = overrides[String(player.id)] || overrides[player.name] || {};
  const rawPosition = cleanText(player.position);
  const detailedPosition = cleanText(override.position) || compactPosition(rawPosition);

  return {
    api_player_id: player.id,
    api_team_id: team.id,
    league_id: leagueId || null,
    season: Number(season),
    slug: `${slugify(player.name)}-${player.id}`,
    name: player.name,
    age: player.age || null,
    club: team.name,
    team: team.name,
    pos: detailedPosition,
    position: detailedPosition,
    raw_position: rawPosition,
    shirt_number: player.number || null,
    img: player.photo || null,
    image: player.photo || null,
    source: 'api-football',
    last_synced_at: new Date().toISOString(),
  };
}

async function upsertPlayers({ rows, supabaseUrl, serviceRoleKey }) {
  if (!rows.length) return;

  const url = new URL(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/players`);
  url.searchParams.set('on_conflict', 'api_player_id');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Supabase upsert failed: ${response.status} ${response.statusText}\n${body}`
    );
  }
}


async function upsertPlayerCompetitions({ rows, supabaseUrl, serviceRoleKey }) {
  if (!rows.length) return;

  const url = new URL(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/player_competitions`);
  url.searchParams.set('on_conflict', 'api_player_id,league_id,season');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Supabase player_competitions upsert failed: ${response.status} ${response.statusText}\n${body}`
    );
  }
}

async function main() {
  await loadLocalEnv();

  const apiKey = process.env.API_FOOTBALL_KEY || process.env.VITE_API_FOOTBALL_KEY;
  if (!apiKey) {
    throw new Error('Missing API_FOOTBALL_KEY. Put it in .env.import.local.');
  }

  const supabaseUrl = requireEnv('SUPABASE_URL');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  const leagueId = Number(getArg('league', process.env.IMPORT_LEAGUE_ID || 140));
  const season = Number(getArg('season', process.env.IMPORT_SEASON || 2025));
  const teamArg = getArg('team');
  const teamId = teamArg ? Number(teamArg) : null;
  const delayMs = Number(getArg('delay', process.env.IMPORT_DELAY_MS || DEFAULT_DELAY_MS));
  const dryRun = hasFlag('dry-run');
  const membershipOnly = process.env.IMPORT_MEMBERSHIP_ONLY === '1';

  const overrides = await loadPositionOverrides();
  const teams = await loadTeams({ leagueId, season, teamId, apiKey });

  console.log('');
  console.log(`Calibre importer starting`);
  console.log(`Season: ${season}`);
  console.log(`League: ${leagueId || 'not supplied'}`);
  console.log(`Teams queued: ${teams.length}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN - no Supabase writes' : 'LIVE IMPORT'}`);
  console.log('');

  let imported = 0;
  let failedTeams = 0;

  for (const entry of teams) {
    const team = entry.team;

    try {
      const squad = await loadTeamSquad(team.id, apiKey);
      const effectiveTeam = squad.team || team;

      const uniquePlayers = [
      ...new Map(squad.players.map((player) => [player.id, player])).values(),
    ];

    const rows = uniquePlayers.map((player) =>
      buildPlayerRow({
        player,
        team: effectiveTeam,
        leagueId,
        season,
        overrides,
      })
    );

    const competitionRows = rows.map((row) => ({
      api_player_id: row.api_player_id,
      league_id: leagueId,
      season,
      api_team_id: row.api_team_id,
      team: row.team,
      source: 'api-football',
      updated_at: new Date().toISOString(),
    }));

      if (!dryRun) {
      if (!membershipOnly) {
        await upsertPlayers({ rows, supabaseUrl, serviceRoleKey });
      }

      await upsertPlayerCompetitions({
        rows: competitionRows,
        supabaseUrl,
        serviceRoleKey,
      });
    }

      imported += rows.length;
      console.log(`✓ ${effectiveTeam.name}: ${rows.length} players ${dryRun ? 'prepared' : 'imported'}`);
    } catch (error) {
      failedTeams += 1;
      console.error(`✗ ${team.name}: ${error.message}`);
    }

    await sleep(delayMs);
  }

  console.log('');
  console.log('Import complete');
  console.log(`Players processed: ${imported}`);
  console.log(`Teams failed: ${failedTeams}`);

  if (failedTeams > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('');
  console.error(`Importer stopped: ${error.message}`);
  process.exitCode = 1;
});
