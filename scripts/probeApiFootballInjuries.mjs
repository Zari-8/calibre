// scripts/probeApiFootballInjuries.mjs — READ-ONLY probe against API-Football's
// documented /injuries endpoint. TheStatsAPI has no injuries feature at all
// (probeStatsApiInjuries.mjs: every path 404'd except a profile fetch that
// silently ignored ?include=injuries). API-Football — the OTHER source
// already wired into this repo, same key/host as enrichPlayerStats.mjs — has
// a real documented /injuries endpoint, so this checks that instead of
// continuing to guess at a feature that isn't there.
//
// Same host/auth as enrichPlayerStats.mjs: https://v3.football.api-sports.io
// with an x-apisports-key header, so the existing API_FOOTBALL_KEY should
// just work here too.
//
// NOTE on what this endpoint actually is: API-Football's /injuries is
// FIXTURE-scoped — each row is "this player missed/was doubtful for this
// specific match, for this reason," not a clean "N days out this season"
// aggregate. Getting to injury_days_last_365 means pulling every row for a
// player/season and reconstructing spans from fixture dates ourselves. This
// probe prints the raw shape so we can see exactly what's there before
// deciding how (or whether) to aggregate it.
//
// Run:
//   node scripts/probeApiFootballInjuries.mjs
// Override the test subject if useful:
//   PLAYER_ID=521 TEAM_ID=529 SEASON=2025 node scripts/probeApiFootballInjuries.mjs

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

const API_KEY = process.env.API_FOOTBALL_KEY;
if (!API_KEY) { console.error('Missing API_FOOTBALL_KEY in .env.local'); process.exit(1); }
const API_HOST = 'https://v3.football.api-sports.io';

// Lewandowski's confirmed real api_player_id (used elsewhere in this repo,
// e.g. fixDuplicateIdentities.mjs) and Barcelona's team id (529, used in
// enrich-api-football-player-profiles.mjs / import-api-football-players.mjs).
const PLAYER_ID = process.env.PLAYER_ID || '521';
const TEAM_ID   = process.env.TEAM_ID || '529';
const SEASON    = process.env.SEASON || '2025';

async function api(path) {
  const res = await fetch(`${API_HOST}${path}`, { headers: { 'x-apisports-key': API_KEY } });
  const json = await res.json();
  return { status: res.status, ok: res.ok, json };
}

const candidates = [
  `/injuries?player=${PLAYER_ID}&season=${SEASON}`,
  `/injuries?team=${TEAM_ID}&season=${SEASON}`,
];

async function main() {
  console.log(`Probing API-Football /injuries for player=${PLAYER_ID} team=${TEAM_ID} season=${SEASON}...\n`);
  for (const path of candidates) {
    console.log(`── ${path} ──`);
    try {
      const { status, ok, json } = await api(path);
      const results = Array.isArray(json?.response) ? json.response : [];
      console.log(`  status: ${status} (${ok ? 'OK' : 'FAIL'})`);
      console.log(`  results: ${json?.results ?? 'n/a'}  errors: ${JSON.stringify(json?.errors ?? {})}`);
      if (results.length) {
        console.log(`  ── first row ──`);
        console.log('  ' + JSON.stringify(results[0], null, 2).split('\n').join('\n  '));
        if (results.length > 1) {
          console.log(`  ── second row (to confirm shape repeats) ──`);
          console.log('  ' + JSON.stringify(results[1], null, 2).split('\n').join('\n  '));
        }
        console.log(`  total rows returned: ${results.length}`);
      } else {
        console.log('  (no rows returned)');
      }
    } catch (e) {
      console.log(`  error: ${e.message}`);
    }
    console.log('');
    await new Promise((r) => setTimeout(r, 400));
  }
  console.log('Done. Paste back the output — the row shape (fixture-linked vs a clean date range, "type"/"reason" fields, whether it goes back a full season) determines how injury_days_last_365 gets built.');
}

main().catch((e) => { console.error(e); process.exit(1); });
