// scripts/probeStatsApiResolvedInjuries.mjs — READ-ONLY. Finds the shape of a
// RESOLVED (non-active) injury record from TheStatsAPI's confirmed real
// endpoint, since probeStatsApiInjuriesByName.mjs only turned up one ACTIVE
// injury (Raphinha) so far — we don't yet know whether a closed injury
// carries an actual end date or just flips active:false with the same
// expected_return.
//
// Rather than guess more player names, this pulls players who already have
// BOTH a statsapi_player_id (so we can query them) AND confirmed real
// injury history from the API-Football-based backfill
// (injury_days_last_365 > 0 from backfillPlayerInjuries.mjs), then checks
// each against TheStatsAPI's real endpoint — much better odds of finding a
// resolved case than guessing names blind.
//
//   node scripts/probeStatsApiResolvedInjuries.mjs
//   LIMIT=30 node scripts/probeStatsApiResolvedInjuries.mjs

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
const LIMIT = Number(process.env.LIMIT || 25);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(path) {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${API_KEY}`, Accept: 'application/json' } });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { rawText: text.slice(0, 400) }; }
  return { status: res.status, ok: res.ok, json };
}

async function main() {
  const { data, error } = await sb
    .from('players')
    .select('name, team, statsapi_player_id, injury_days_last_365, major_injuries_count')
    .not('statsapi_player_id', 'is', null)
    .gt('injury_days_last_365', 0)
    .order('injury_days_last_365', { ascending: false })
    .limit(LIMIT);
  if (error) { console.error(error.message); process.exit(1); }
  if (!data?.length) { console.error('No players found with both statsapi_player_id and injury_days_last_365 > 0'); process.exit(1); }

  console.log(`Checking ${data.length} players (statsapi_player_id set, confirmed real injury history)...\n`);
  let foundAny = 0, foundResolved = 0;

  for (const p of data) {
    const { status, ok, json } = await api(`/players/${p.statsapi_player_id}/injuries-suspensions`);
    const injuries = json?.data?.injuries || [];
    const suspensions = json?.data?.suspensions || [];
    if (injuries.length || suspensions.length) {
      foundAny++;
      console.log(`── ${p.name} (${p.team || 'no team'}) — API-Football est: ${p.injury_days_last_365}d/${p.major_injuries_count} major ──`);
      console.log(`  status ${status} (${ok ? 'OK' : 'FAIL'})`);
      console.log('  ' + JSON.stringify({ injuries, suspensions }, null, 2).split('\n').join('\n  '));
      const resolved = injuries.find((i) => i.active === false) || suspensions.find((s) => s.active === false);
      if (resolved) foundResolved++;
      console.log('');
    }
    await sleep(250);
  }

  console.log(`Done. Players with any real injuries/suspensions returned: ${foundAny}/${data.length}`);
  console.log(`Players with at least one RESOLVED (active:false) record seen: ${foundResolved}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
