#!/usr/bin/env node

/**
 * Calibre API-Football player-profile enricher
 *
 * Run this AFTER the squad importer.
 *
 * It fills richer API-Football profile and season-stat fields for players
 * already stored in Supabase. It deliberately does NOT touch:
 * - Calibre rating
 * - Calibre archetype
 * - detailed Calibre position
 * - market value
 *
 * Those remain separate enrichment layers.
 *
 * Example:
 *   node scripts/enrich-api-football-player-profiles.mjs --team=529 --season=2025
 */

import fs from 'node:fs/promises';
import process from 'node:process';

const API_BASE_URL = 'https://v3.football.api-sports.io';
const DEFAULT_DELAY_MS = 250;

function getArg(name, fallback = null) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  for (const filename of ['.env.import.local', '.env.local']) {
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

async function apiFootballGet(endpoint, params, apiKey) {
  const url = new URL(`${API_BASE_URL}${endpoint}`);

  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    headers: { 'x-apisports-key': apiKey },
  });

  if (!response.ok) {
    throw new Error(`API-Football request failed: ${response.status} ${response.statusText}\n${await response.text()}`);
  }

  const payload = await response.json();

  if (payload.errors && Object.keys(payload.errors).length > 0) {
    throw new Error(`API-Football error: ${JSON.stringify(payload.errors)}`);
  }

  return payload;
}

async function loadAllTeamPlayerPages({ teamId, season, apiKey, delayMs }) {
  const rows = [];
  let page = 1;
  let totalPages = 1;

  do {
    const payload = await apiFootballGet('/players', { team: teamId, season, page }, apiKey);
    rows.push(...(payload.response || []));
    totalPages = Number(payload.paging?.total || 1);

    console.log(`  Loaded API-Football players page ${page}/${totalPages}`);
    page += 1;

    if (page <= totalPages) await sleep(delayMs);
  } while (page <= totalPages);

  return rows;
}

function numericOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function integerOrNull(value) {
  const number = numericOrNull(value);
  return number === null ? null : Math.round(number);
}

function mergeStatistics(statistics = []) {
  if (!statistics.length) {
    return {
      appearances: null,
      starts: null,
      minutes: null,
      goals: null,
      assists: null,
      api_average_rating: null,
    };
  }

  let appearances = 0;
  let starts = 0;
  let minutes = 0;
  let goals = 0;
  let assists = 0;
  const ratings = [];

  for (const stat of statistics) {
    appearances += integerOrNull(stat?.games?.appearences ?? stat?.games?.appearances) || 0;
    starts += integerOrNull(stat?.games?.lineups) || 0;
    minutes += integerOrNull(stat?.games?.minutes) || 0;
    goals += integerOrNull(stat?.goals?.total) || 0;
    assists += integerOrNull(stat?.goals?.assists) || 0;

    const rating = numericOrNull(stat?.games?.rating);
    if (rating !== null) ratings.push(rating);
  }

  return {
    appearances,
    starts,
    minutes,
    goals,
    assists,
    api_average_rating: ratings.length
      ? Number((ratings.reduce((sum, value) => sum + value, 0) / ratings.length).toFixed(2))
      : null,
  };
}

function buildPatch(entry) {
  const player = entry?.player || {};
  const seasonStats = mergeStatistics(entry?.statistics || []);

  return {
    firstname: player.firstname || null,
    lastname: player.lastname || null,
    age: player.age || null,
    date_of_birth: player.birth?.date || null,
    birth_place: player.birth?.place || null,
    birth_country: player.birth?.country || null,
    nationality: player.nationality || null,
    height: player.height || null,
    weight: player.weight || null,
    injured: player.injured ?? null,
    img: player.photo || null,
    image: player.photo || null,
    ...seasonStats,
    profile_enriched_at: new Date().toISOString(),
  };
}

async function patchSupabasePlayer({ apiPlayerId, patch, supabaseUrl, serviceRoleKey }) {
  const url = new URL(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/players`);
  url.searchParams.set('api_player_id', `eq.${apiPlayerId}`);

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(patch),
  });

  if (!response.ok) {
    throw new Error(`Supabase patch failed for API player ${apiPlayerId}: ${response.status} ${response.statusText}\n${await response.text()}`);
  }
}

async function main() {
  await loadLocalEnv();

  const apiKey = process.env.API_FOOTBALL_KEY || process.env.VITE_API_FOOTBALL_KEY;
  if (!apiKey) throw new Error('Missing API_FOOTBALL_KEY.');

  const supabaseUrl = requireEnv('SUPABASE_URL');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  const teamId = Number(getArg('team'));
  const season = Number(getArg('season', process.env.IMPORT_SEASON || 2025));
  const delayMs = Number(getArg('delay', process.env.IMPORT_DELAY_MS || DEFAULT_DELAY_MS));

  if (!teamId) {
    throw new Error('Provide a team ID, for example: --team=529');
  }

  console.log('');
  console.log('Calibre profile enrichment starting');
  console.log(`Team: ${teamId}`);
  console.log(`Season: ${season}`);
  console.log('');

  const players = await loadAllTeamPlayerPages({ teamId, season, apiKey, delayMs });

  let updated = 0;
  let failed = 0;

  for (const entry of players) {
    const player = entry?.player;

    if (!player?.id) continue;

    try {
      await patchSupabasePlayer({
        apiPlayerId: player.id,
        patch: buildPatch(entry),
        supabaseUrl,
        serviceRoleKey,
      });

      updated += 1;
      console.log(`✓ ${player.name}`);
    } catch (error) {
      failed += 1;
      console.error(`✗ ${player.name}: ${error.message}`);
    }

    await sleep(delayMs);
  }

  console.log('');
  console.log('Profile enrichment complete');
  console.log(`Players updated: ${updated}`);
  console.log(`Players failed: ${failed}`);

  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error('');
  console.error(`Enrichment stopped: ${error.message}`);
  process.exitCode = 1;
});
