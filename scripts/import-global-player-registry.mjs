#!/usr/bin/env node

/**
 * Calibre global API-Football player registry importer
 *
 * Uses API-Football's /players/profiles endpoint to pull the complete
 * available player-profile directory page by page and upsert it into Supabase.
 *
 * This is the broad identity/profile layer. It intentionally does NOT overwrite:
 * - Calibre rating
 * - archetype
 * - club/team
 * - league_id
 * - detailed position
 * - market value
 *
 * Those remain separate enrichment layers.
 *
 * Safe features:
 * - resumable checkpoint file
 * - page-range controls
 * - dry-run mode
 * - batched Supabase upserts
 * - delay between API requests
 *
 * Examples:
 *   node scripts/import-global-player-registry.mjs --dry-run --max-pages=2
 *   node scripts/import-global-player-registry.mjs --max-pages=50
 *   node scripts/import-global-player-registry.mjs --resume
 *   node scripts/import-global-player-registry.mjs --start-page=1 --end-page=250
 */

import fs from 'node:fs/promises';
import process from 'node:process';

const API_BASE_URL = 'https://v3.football.api-sports.io';
const CHECKPOINT_FILE = '.calibre-global-import-checkpoint.json';
const DEFAULT_DELAY_MS = 300;
const DEFAULT_BATCH_SIZE = 100;

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
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanText(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
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

async function readCheckpoint() {
  try {
    return JSON.parse(await fs.readFile(CHECKPOINT_FILE, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

async function writeCheckpoint(page, totalPages) {
  await fs.writeFile(
    CHECKPOINT_FILE,
    JSON.stringify(
      {
        last_completed_page: page,
        total_pages_seen: totalPages,
        updated_at: new Date().toISOString(),
      },
      null,
      2
    ) + '\n',
    'utf8'
  );
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

  return payload;
}

function buildPlayerRow(entry) {
  const player = entry?.player || entry || {};
  const apiPlayerId = player.id;

  if (!apiPlayerId || !player.name) return null;

  return {
    api_player_id: apiPlayerId,
    slug: `${slugify(player.name)}-${apiPlayerId}`,
    name: cleanText(player.name),
    firstname: cleanText(player.firstname),
    lastname: cleanText(player.lastname),
    age: player.age || null,
    date_of_birth: player.birth?.date || null,
    birth_place: cleanText(player.birth?.place),
    birth_country: cleanText(player.birth?.country),
    nationality: cleanText(player.nationality),
    height: cleanText(player.height),
    weight: cleanText(player.weight),
    injured: player.injured ?? null,
    img: cleanText(player.photo),
    image: cleanText(player.photo),
    source: 'api-football-global-profiles',
    last_synced_at: new Date().toISOString(),
    profile_enriched_at: new Date().toISOString(),
  };
}

function chunk(rows, size) {
  const batches = [];
  for (let index = 0; index < rows.length; index += size) {
    batches.push(rows.slice(index, index + size));
  }
  return batches;
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

async function main() {
  await loadLocalEnv();

  const apiKey = process.env.API_FOOTBALL_KEY || process.env.VITE_API_FOOTBALL_KEY;
  if (!apiKey) throw new Error('Missing API_FOOTBALL_KEY.');

  const supabaseUrl = requireEnv('SUPABASE_URL');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  const dryRun = hasFlag('dry-run');
  const resume = hasFlag('resume');
  const delayMs = Number(getArg('delay', process.env.IMPORT_DELAY_MS || DEFAULT_DELAY_MS));
  const batchSize = Number(getArg('batch-size', DEFAULT_BATCH_SIZE));
  const maxPagesArg = getArg('max-pages');
  const explicitStartPage = Number(getArg('start-page', 1));
  const explicitEndPageArg = getArg('end-page');

  let startPage = explicitStartPage;

  if (resume) {
    const checkpoint = await readCheckpoint();
    if (checkpoint?.last_completed_page) {
      startPage = Number(checkpoint.last_completed_page) + 1;
    }
  }

  const firstPayload = await apiFootballGet('/players/profiles', { page: startPage }, apiKey);
  const totalPages = Number(firstPayload.paging?.total || 1);

  let endPage = explicitEndPageArg ? Number(explicitEndPageArg) : totalPages;

  if (maxPagesArg) {
    endPage = Math.min(endPage, startPage + Number(maxPagesArg) - 1);
  }

  console.log('');
  console.log('Calibre global registry import starting');
  console.log(`Start page: ${startPage}`);
  console.log(`End page for this run: ${endPage}`);
  console.log(`Total pages reported by API: ${totalPages}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN - no Supabase writes' : 'LIVE IMPORT'}`);
  console.log('');

  let totalPlayers = 0;

  for (let page = startPage; page <= endPage; page += 1) {
    const payload =
      page === startPage
        ? firstPayload
        : await apiFootballGet('/players/profiles', { page }, apiKey);

    const rows = (payload.response || [])
      .map(buildPlayerRow)
      .filter(Boolean);

    if (!dryRun) {
      for (const batch of chunk(rows, batchSize)) {
        await upsertPlayers({ rows: batch, supabaseUrl, serviceRoleKey });
      }

      await writeCheckpoint(page, totalPages);
    }

    totalPlayers += rows.length;
    console.log(`✓ Page ${page}/${totalPages}: ${rows.length} player profiles ${dryRun ? 'prepared' : 'imported'}`);

    if (page < endPage) await sleep(delayMs);
  }

  console.log('');
  console.log('Global registry run complete');
  console.log(`Profiles processed in this run: ${totalPlayers}`);

  if (!dryRun && endPage < totalPages) {
    console.log('');
    console.log('More pages remain. Continue later with:');
    console.log('node scripts/import-global-player-registry.mjs --resume');
  }
}

main().catch((error) => {
  console.error('');
  console.error(`Global registry import stopped: ${error.message}`);
  process.exitCode = 1;
});
