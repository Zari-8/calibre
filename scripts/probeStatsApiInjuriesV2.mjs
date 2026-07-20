// scripts/probeStatsApiInjuriesV2.mjs — READ-ONLY. TheStatsAPI support (Sam)
// confirmed the real, live paths directly (they're untagged in the OpenAPI
// spec, which is why probeStatsApiInjuries.mjs's guesses all 404'd):
//   GET /players/{player_id}/injuries-suspensions
//   GET /teams/{team_id}/injuries-suspensions
// This checks both for real, printing the full raw shape — specifically
// whether rows carry actual start/end dates or a duration field (which would
// make this meaningfully better than backfillPlayerInjuries.mjs's
// fixture-miss reconstruction from API-Football), and whether suspensions
// are separated from injuries or merged into one list.
//
//   node scripts/probeStatsApiInjuriesV2.mjs
// Override the test subject if useful:
//   PLAYER_ID=pl_703474 TEAM_ID=<statsapi team id> node scripts/probeStatsApiInjuriesV2.mjs

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
const TEAM_ID = process.env.TEAM_ID || null;

async function api(path) {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${API_KEY}`, Accept: 'application/json' } });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { rawText: text.slice(0, 800) }; }
  return { status: res.status, ok: res.ok, json };
}

async function main() {
  console.log(`── /players/${PLAYER_ID}/injuries-suspensions ──`);
  try {
    const { status, ok, json } = await api(`/players/${PLAYER_ID}/injuries-suspensions`);
    console.log(`status: ${status} (${ok ? 'OK' : 'FAIL'})`);
    console.log(JSON.stringify(json, null, 2));
  } catch (e) { console.log(`error: ${e.message}`); }

  if (TEAM_ID) {
    console.log(`\n── /teams/${TEAM_ID}/injuries-suspensions ──`);
    try {
      const { status, ok, json } = await api(`/teams/${TEAM_ID}/injuries-suspensions`);
      console.log(`status: ${status} (${ok ? 'OK' : 'FAIL'})`);
      const preview = JSON.stringify(json, null, 2);
      console.log(preview.length > 3000 ? preview.slice(0, 3000) + '\n...(truncated)' : preview);
    } catch (e) { console.log(`error: ${e.message}`); }
  } else {
    console.log('\n(no TEAM_ID set — skipping team-level check; player-level result above is enough to see the row shape)');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
