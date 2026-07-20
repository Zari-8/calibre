// scripts/probeStatsApiInjuries.mjs — READ-ONLY probe against TheStatsAPI.
// We don't know if/how an injuries endpoint exists on this API yet — same
// situation listStatsAPICompetitions.mjs was in before it discovered the real
// competition catalog. Tries the most likely URL shapes (player-level,
// team-level, global-with-filter) against a known player + team, and prints
// whatever comes back (including the raw error) for each, so we can see the
// real shape in one run instead of guessing blind.
//
// Run:
//   node scripts/probeStatsApiInjuries.mjs
// Override the test subjects if useful:
//   PLAYER_ID=pl_703474 TEAM_ID=<id> node scripts/probeStatsApiInjuries.mjs

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

const API_KEY = process.env.STATSAPI_KEY;
if (!API_KEY) { console.error('Missing STATSAPI_KEY in .env.local'); process.exit(1); }
const BASE = 'https://api.thestatsapi.com/api/football';

// Lewandowski's confirmed real statsapi_player_id from earlier this session.
const PLAYER_ID = process.env.PLAYER_ID || 'pl_703474';
// Barcelona — league_id 140 (LaLiga) is known; team_id isn't confirmed yet,
// so this probe also tries a name-based/query-param shape as a fallback.
const TEAM_ID = process.env.TEAM_ID || null;
const TEAM_NAME = process.env.TEAM_NAME || 'Barcelona';

async function api(path) {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${API_KEY}`, Accept: 'application/json' } });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { rawText: text.slice(0, 500) }; }
  return { status: res.status, ok: res.ok, json };
}

const candidates = [
  `/players/${PLAYER_ID}/injuries`,
  `/injuries?player_id=${PLAYER_ID}`,
  `/injuries/player/${PLAYER_ID}`,
  `/players/${PLAYER_ID}?include=injuries`,
  TEAM_ID ? `/teams/${TEAM_ID}/injuries` : `/injuries?team_name=${encodeURIComponent(TEAM_NAME)}`,
  `/injuries?date_from=2024-07-01&date_to=2026-07-13`,
  `/players/profiles?search=fati`, // known-good endpoint, sanity check the key/connection still works
];

async function main() {
  console.log(`Probing candidate injury endpoints for player ${PLAYER_ID} / team "${TEAM_NAME}"...\n`);
  for (const path of candidates) {
    console.log(`── ${path} ──`);
    try {
      const { status, ok, json } = await api(path);
      console.log(`  status: ${status} (${ok ? 'OK' : 'FAIL'})`);
      const preview = JSON.stringify(json, null, 2);
      console.log(`  body: ${preview.length > 1200 ? preview.slice(0, 1200) + '\n  ...(truncated)' : preview}`);
    } catch (e) {
      console.log(`  error: ${e.message}`);
    }
    console.log('');
    await new Promise((r) => setTimeout(r, 400));
  }
  console.log('Done. Whichever candidate(s) returned real data (not 404/error) tell us the real shape — paste the output back.');
}

main().catch((e) => { console.error(e); process.exit(1); });
