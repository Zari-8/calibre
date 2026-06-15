/**
 * enrichStatsAPI.mjs — Calibre × TheStatsAPI enrichment
 * Run: node scripts/enrichStatsAPI.mjs
 * Flags: DRY_RUN=1  COMP=comp_3039
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ── Load .env.local ───────────────────────────────────────────────
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const f of ['.env', '.env.local']) {
  const p = join(ROOT, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] ??= m[2].trim().replace(/^["']|["']$/g, '');
  }
}

const API_KEY      = process.env.STATSAPI_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY
                  || process.env.SUPABASE_SERVICE_ROLE_KEY
                  || process.env.SUPABASE_KEY;
const DRY_RUN      = process.env.DRY_RUN === '1';
const ONLY_COMP    = process.env.COMP || null;
const BASE         = 'https://api.thestatsapi.com/api/football';

if (!API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing env vars. Need: STATSAPI_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY');
  process.exit(1);
}

console.log(DRY_RUN ? 'DRY RUN\n' : 'LIVE RUN\n');
console.log('SUPABASE_URL:', SUPABASE_URL);
console.log('KEY prefix  :', SUPABASE_KEY.slice(0, 20) + '...\n');

const COMPETITIONS = [
  { name: 'Premier League', id: 'comp_3039' },
  { name: 'LaLiga',         id: 'comp_8814' },
  { name: 'Bundesliga',     id: 'comp_4643' },
  { name: 'Serie A',        id: 'comp_5840' },
  { name: 'Ligue 1',        id: 'comp_0256' },
  { name: 'Eredivisie',     id: 'comp_3809' },
  { name: 'Pro League',     id: 'comp_8531' },
  { name: 'Liga Portugal',  id: 'comp_8385' },
  { name: 'Brasileirão',    id: 'comp_4795' },
];

const sleep = ms => new Promise(r => setTimeout(r, ms));
const sb    = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Lookup cache — avoids re-querying same player name ────────────
const nameCache = new Map();

function norm(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

// Direct Supabase name lookup — no bulk load needed
async function findPlayer(name) {
  const key = norm(name);
  if (nameCache.has(key)) return nameCache.get(key);

  // Try exact ilike first
  let { data } = await sb.from('players').select('id, name')
    .ilike('name', name).limit(1);

  // Try normalised name if exact fails
  if (!data?.length) {
    ({ data } = await sb.from('players').select('id, name')
      .ilike('name', `%${key}%`).limit(1));
  }

  const result = data?.[0] || null;
  nameCache.set(key, result);
  return result;
}

// ── TheStatsAPI helpers ───────────────────────────────────────────
async function api(path, attempt = 0) {
  await sleep(800);
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  if (res.status === 429) {
    const wait = [10000, 20000, 40000, 60000][Math.min(attempt, 3)];
    console.log(`  [429] waiting ${wait / 1000}s...`);
    await sleep(wait);
    return api(path, attempt + 1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${path}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json;
}

async function fetchAll(path) {
  const sep = path.includes('?') ? '&' : '?';
  let page = 1, all = [];
  while (true) {
    let json;
    try { json = await api(`${path}${sep}per_page=50&page=${page}`); }
    catch (e) { console.error(`  fetchAll error: ${e.message}`); break; }
    all.push(...(Array.isArray(json.data) ? json.data : []));
    if (!json.meta?.total_pages || page >= json.meta.total_pages) break;
    page++;
  }
  return all;
}

function pickBestSeason(seasons) {
  const done = seasons.filter(s => !s.is_current);
  return (done.length ? done : seasons).sort((a, b) => b.end_year - a.end_year)[0];
}

async function getStats(playerId, seasonId) {
  try {
    const json = await api(`/players/${playerId}/stats?season_id=${seasonId}`);
    return json.data || null;
  } catch { return null; }
}

function buildFields(player, stats, compId, seasonId) {
  if (!stats?.appearances || stats.appearances < 1) return null;
  const sc = stats.scoring   || {};
  const sh = stats.shooting  || {};
  const pa = stats.passing   || {};
  const du = stats.duels     || {};
  const de = stats.defending || {};
  const assists = sc.goals_assists_sum != null && sc.goals != null
    ? sc.goals_assists_sum - sc.goals : null;
  const shotAcc = sh.total_shots > 0
    ? Math.round(sh.shots_on_target / sh.total_shots * 100) : null;
  return {
    statsapi_player_id: player.id, statsapi_season_id: seasonId,
    statsapi_competition_id: compId, statsapi_enriched_at: new Date().toISOString(),
    big_chances_created:  sc.big_chances_created            ?? null,
    big_chances_missed:   sc.big_chances_missed             ?? null,
    total_shots:          sh.total_shots                    ?? null,
    shots_on_target:      sh.shots_on_target                ?? null,
    shot_accuracy:        shotAcc,
    final_third_passes:   pa.accurate_final_third_passes    ?? null,
    opp_half_passes:      pa.accurate_opposition_half_passes ?? null,
    own_half_passes:      pa.accurate_own_half_passes        ?? null,
    accurate_crosses:     pa.accurate_crosses               ?? null,
    cross_accuracy:       pa.accurate_crosses_percentage    ?? null,
    ground_duel_win_pct:  du.ground_duels_won_percentage    ?? null,
    aerial_duel_win_pct:  du.aerial_duels_won_percentage    ?? null,
    dribble_success_pct:  du.successful_dribbles_percentage ?? null,
    successful_dribbles:  du.successful_dribbles            ?? null,
    goals:                sc.goals     ?? null, assists,
    appearances:          stats.appearances ?? null,
    stats_minutes:        stats.minutes_played ?? null,
    pass_accuracy:        pa.pass_accuracy ?? null,
    key_passes:           pa.key_passes   ?? null,
    tackles:              de.tackles      ?? null,
    interceptions:        de.interceptions ?? null,
  };
}

// ── Main ──────────────────────────────────────────────────────────
async function main() {
  const comps = ONLY_COMP
    ? COMPETITIONS.filter(c => c.id === ONLY_COMP)
    : COMPETITIONS;

  let enriched = 0, skipped = 0, noStats = 0, noMatch = 0, errors = 0;

  for (const comp of comps) {
    console.log(`\n═══ ${comp.name} ═══`);

    let season;
    try {
      const json = await api(`/competitions/${comp.id}/seasons`);
      season = pickBestSeason(json.data || []);
      console.log(`  Season: ${season.name} (${season.id})`);
    } catch (e) { console.error(`  Season error: ${e.message}`); continue; }

    let teams;
    try {
      teams = await fetchAll(`/teams?competition_id=${comp.id}&season_id=${season.id}`);
      console.log(`  Teams: ${teams.length}`);
    } catch (e) { console.error(`  Teams error: ${e.message}`); continue; }

    for (const team of teams) {
      const squad = await fetchAll(`/players?team_id=${team.id}`);
      let hits = 0;

      for (const player of squad) {
        // 1. Get stats
        const stats  = await getStats(player.id, season.id);
        const fields = buildFields(player, stats, comp.id, season.id);
        if (!fields) { noStats++; skipped++; continue; }

        // 2. Find in Supabase by name
        const row = await findPlayer(player.name);
        if (!row) { noMatch++; skipped++; continue; }

        // 3. Write
        if (!DRY_RUN) {
          const { error: e } = await sb.from('players').update(fields).eq('id', row.id);
          if (e) { errors++; console.error(`  update error: ${e.message}`); continue; }
        }
        hits++; enriched++;
      }

      console.log(`  ${team.name}: ${hits}/${squad.length}`);
    }
  }

  console.log(`\n── Summary ──────────────────`);
  console.log(`Enriched   : ${enriched}`);
  console.log(`No stats   : ${noStats}  (no appearances in that season)`);
  console.log(`No match   : ${noMatch}  (not found in Supabase by name)`);
  console.log(`Errors     : ${errors}`);
}

main().catch(console.error);
