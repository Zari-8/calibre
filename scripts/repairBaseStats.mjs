/**
 * repairBaseStats.mjs
 * Restores API-Football base stats for all players that were touched
 * by the TheStatsAPI enrichment, which incorrectly overwrote
 * pass_accuracy, goals, assists, appearances, stats_minutes,
 * key_passes, tackles, and interceptions.
 *
 * Run AFTER fixing enrichStatsAPI.mjs and reconcileNames.mjs.
 *
 * Run: API_FOOTBALL_KEY=xxx SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/repairBaseStats.mjs
 *
 * This script forces re-enrichment from API-Football for every player
 * that has a statsapi_player_id set (i.e., was touched by TheStatsAPI).
 * It delegates to the existing enrichPlayerStats.mjs logic by setting
 * FORCE=1 and filtering to only the affected players via a REPAIR_ONLY flag.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const f of ['.env', '.env.local']) {
  const p = join(ROOT, f);
  if (!existsSync(p)) continue;
  for (const l of readFileSync(p, 'utf8').split('\n')) {
    const m = l.match(/^([^#=]+)=(.*)/);
    if (m) process.env[m[1].trim()] ??= m[2].trim().replace(/^["']|["']$/g, '');
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const API_KEY      = process.env.API_FOOTBALL_KEY;
const DRY_RUN      = process.env.DRY_RUN === '1';

if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
if (!API_KEY) { console.error('Missing API_FOOTBALL_KEY'); process.exit(1); }

const sb    = createClient(SUPABASE_URL, SUPABASE_KEY);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const BASE  = 'https://v3.football.api-sports.io';

async function apf(path) {
  await sleep(1200); // API-Football rate limit
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'x-apisports-key': API_KEY },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${path}`);
  return res.json();
}

async function repairPlayer(row) {
  const season = row.stats_season || new Date().getFullYear() - 1;
  let json;
  try {
    json = await apf(`/players?id=${row.api_player_id}&season=${season}`);
  } catch (e) {
    return { ok: false, reason: e.message };
  }

  const stats = json?.response?.[0]?.statistics;
  if (!stats?.length) {
    // Try current season as fallback
    try {
      const cs = new Date().getFullYear();
      const j2 = await apf(`/players?id=${row.api_player_id}&season=${cs}`);
      const s2 = j2?.response?.[0]?.statistics;
      if (!s2?.length) return { ok: false, reason: 'no stats' };
      return repairFromStats(row, s2);
    } catch { return { ok: false, reason: 'no stats' }; }
  }

  return repairFromStats(row, stats);
}

// Matches the accumulation logic in enrichPlayerStats.mjs exactly
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

function repairFromStats(row, statistics) {
  let minutes=0, apps=0, starts=0, goals=0, assists=0;
  let passes=0, key=0, dribS=0, dribA=0, tackles=0, inter=0, duelsWon=0, shots=0;
  let accSum=0, accW=0, ratingSum=0, ratingW=0;

  for (const s of statistics) {
    const m = num(s?.games?.minutes);
    minutes  += m;
    apps     += num(s?.games?.appearences); // API typo preserved
    starts   += num(s?.games?.lineups);
    passes   += num(s?.passes?.total);
    key      += num(s?.passes?.key);
    dribS    += num(s?.dribbles?.success);
    dribA    += num(s?.dribbles?.attempts);
    tackles  += num(s?.tackles?.total);
    inter    += num(s?.tackles?.interceptions);
    duelsWon += num(s?.duels?.won);
    shots    += num(s?.shots?.total);
    goals    += num(s?.goals?.total);
    assists  += num(s?.goals?.assists);

    // Pass accuracy — matches enrichPlayerStats.mjs:
    // accuracy field is a percentage when <= 100, else it's raw count
    const accRaw = s?.passes?.accuracy;
    if (accRaw != null && m > 0) {
      const total = num(s?.passes?.total);
      const pct = Number(accRaw) <= 100
        ? Number(accRaw)
        : (total > 0 ? (Number(accRaw) / total) * 100 : null);
      if (pct != null) { accSum += pct * m; accW += m; }
    }

    const r = parseFloat(s?.games?.rating);
    if (Number.isFinite(r) && m > 0) { ratingSum += r * m; ratingW += m; }
  }

  const passAcc = accW > 0 ? Math.round((accSum / accW) * 10) / 10 : null;

  const update = {
    goals, assists, appearances: apps, starts, minutes,
    stats_minutes: minutes, pass_accuracy: passAcc,
    key_passes: key, tackles, interceptions: inter,
    duels_won: duelsWon, shots, dribbles_success: dribS,
    dribbles_attempts: dribA,
    stats_updated_at: new Date().toISOString(),
  };

  return { ok: true, update, pass_accuracy: passAcc, goals };
}

async function main() {
  console.log(DRY_RUN ? 'DRY RUN\n' : 'LIVE REPAIR\n');

  // Load ALL players touched by TheStatsAPI enrichment — paginated
  console.log('Loading affected players...');
  const affected = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await sb
      .from('players')
      .select('id, name, api_player_id, league_id, stats_season')
      .not('statsapi_player_id', 'is', null)
      .not('api_player_id', 'is', null)
      .range(from, from + PAGE - 1);
    if (error) { console.error('Load failed:', error.message); process.exit(1); }
    if (!data?.length) break;
    affected.push(...data);
    process.stdout.write(`  Loaded ${affected.length}...\r`);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  console.log(`Found ${affected.length} players to repair\n`);

  let repaired = 0, failed = 0;

  for (let i = 0; i < affected.length; i++) {
    const row = affected[i];
    process.stdout.write(`[${i+1}/${affected.length}] ${row.name}... `);

    const result = await repairPlayer(row);
    if (result.ok) {
      if (!DRY_RUN) {
        const { error } = await sb.from('players').update(result.update).eq('id', row.id);
        if (error) { console.log(`✗ ${error.message}`); failed++; continue; }
      }
      console.log(`✓ pa:${result.pass_accuracy}% g:${result.goals}`);
      repaired++;
    } else {
      console.log(`✗ ${result.reason}`);
      failed++;
    }
  }

  console.log(`\n── Repair complete ──`);
  console.log(`Repaired : ${repaired}`);
  console.log(`Failed   : ${failed}`);
}

main().catch(console.error);
