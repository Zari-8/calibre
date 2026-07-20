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

// API-Football returns HTTP 200 even when the daily/minute quota is
// exhausted — it just comes back with an `errors` object and an empty
// `response` array. Previously that looked IDENTICAL to "this player
// genuinely has no stats," which is how a quota exhaustion silently
// mislabeled ~6,400 players (including Bernardo Silva, Mbappé, Vinícius,
// Yamal — players who obviously have data) as "no stats" in one run.
// Flag it as a distinct, loud error instead of swallowing it.
class QuotaError extends Error {}

async function apf(path) {
  await sleep(1200); // API-Football rate limit
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'x-apisports-key': API_KEY },
  });
  if (res.status === 429) throw new QuotaError(`rate limited (429) ${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${path}`);
  const json = await res.json();
  if (json?.errors && Object.keys(json.errors).length) {
    throw new QuotaError(JSON.stringify(json.errors));
  }
  return json;
}

async function repairPlayer(row) {
  const season = row.stats_season || new Date().getFullYear() - 1;
  let json;
  try {
    json = await apf(`/players?id=${row.api_player_id}&season=${season}`);
  } catch (e) {
    if (e instanceof QuotaError) throw e; // let main() see this and abort the run
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
    } catch (e) {
      if (e instanceof QuotaError) throw e;
      return { ok: false, reason: 'no stats' };
    }
  }

  return repairFromStats(row, stats);
}

// Matches the accumulation logic in enrichPlayerStats.mjs exactly
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

// This did NOT actually match enrichPlayerStats.mjs — that script excludes
// friendlies/exhibitions/testimonials before summing (isCompetitive()), but
// this one summed every entry API-Football returned, unfiltered. That let
// friendly-fixture goals/assists/appearances/minutes silently stack onto the
// competitive totals, so this row's flat fields drifted out of sync with its
// own competition_splits (which WAS computed with the filter). Confirmed via
// Jude Bellingham (api_player_id 129718): competition_splits shows
// base 6 + overlay 3 = 9 goals for the season, but this script had
// overwritten the flat `goals` column to 22.
const FRIENDLY_LEAGUE_IDS = new Set([10, 667, 666]);
function isCompetitive(s) {
  const id = num(s?.league?.id);
  const name = String(s?.league?.name || '').toLowerCase();
  if (FRIENDLY_LEAGUE_IDS.has(id)) return false;
  return !(name.includes('friendl') || name.includes('exhibition') || name.includes('testimonial'));
}

function repairFromStats(row, statistics) {
  let minutes=0, apps=0, starts=0, goals=0, assists=0;
  let passes=0, key=0, dribS=0, dribA=0, tackles=0, inter=0, duelsWon=0, shots=0;
  let accSum=0, accW=0, ratingSum=0, ratingW=0;

  for (const s of statistics.filter(isCompetitive)) {
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

    let result;
    try {
      result = await repairPlayer(row);
    } catch (e) {
      if (e instanceof QuotaError) {
        console.log(`\n\n── STOPPED: API-Football quota/rate limit hit ──`);
        console.log(e.message);
        console.log(`Processed ${i} of ${affected.length} before stopping.`);
        console.log(`Repaired so far : ${repaired}`);
        console.log(`Failed so far    : ${failed}`);
        console.log(`\nThis is NOT the same as those players having no data — the API stopped`);
        console.log(`answering. Wait for your quota to reset (check your API-Football dashboard`);
        console.log(`for the reset window), then re-run this script — it will pick up where`);
        console.log(`the earlier pass left off since already-repaired rows will just get`);
        console.log(`re-verified, not corrupted.`);
        process.exit(1);
      }
      console.log(`✗ ${e.message}`);
      failed++;
      continue;
    }

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
