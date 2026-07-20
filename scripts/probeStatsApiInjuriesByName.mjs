// scripts/probeStatsApiInjuriesByName.mjs — READ-ONLY. Looks up a player's
// statsapi_player_id from the DB by name, then hits TheStatsAPI's confirmed
// real endpoint (GET /players/{id}/injuries-suspensions — see Sam's reply,
// scripts/probeStatsApiInjuriesV2.mjs). Lewandowski came back with empty
// injuries/suspensions arrays, which is ambiguous (genuinely clean vs. not
// backfilled yet) — Ansu Fati has well-documented real injury history, so a
// populated result here is a much stronger signal that the endpoint has real
// historical data behind it, not just the right shape.
//
//   NAME="ansu fati" node scripts/probeStatsApiInjuriesByName.mjs

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

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const API_KEY = process.env.STATSAPI_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
if (!API_KEY) { console.error('Missing STATSAPI_KEY in .env.local'); process.exit(1); }

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
const BASE = 'https://api.thestatsapi.com/api/football';
const NAME = process.env.NAME || 'ansu fati';

async function api(path) {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${API_KEY}`, Accept: 'application/json' } });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { rawText: text.slice(0, 800) }; }
  return { status: res.status, ok: res.ok, json };
}

async function main() {
  const { data, error } = await sb.from('players').select('name, team, statsapi_player_id').ilike('name', `%${NAME}%`);
  if (error) { console.error(error.message); process.exit(1); }
  if (!data?.length) { console.error(`No player matched "${NAME}"`); process.exit(1); }

  for (const p of data) {
    console.log(`\n══════════ ${p.name} (${p.team || 'no team'}) ══════════`);
    if (!p.statsapi_player_id) {
      console.log('No statsapi_player_id stored for this row — was never matched during enrichStatsAPI.mjs (likely because that script only covers domestic LEAGUES, not every player). Can\'t probe by id for this one.');
      continue;
    }
    console.log(`statsapi_player_id: ${p.statsapi_player_id}`);
    try {
      const { status, ok, json } = await api(`/players/${p.statsapi_player_id}/injuries-suspensions`);
      console.log(`status: ${status} (${ok ? 'OK' : 'FAIL'})`);
      console.log(JSON.stringify(json, null, 2));
    } catch (e) { console.log(`error: ${e.message}`); }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
