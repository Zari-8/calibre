/**
 * reconcileNames.mjs
 * Second-pass enrichment with looser name matching.
 * Recovers players missed by exact-match in enrichStatsAPI.mjs
 * Run: node scripts/reconcileNames.mjs
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

const API_KEY      = process.env.STATSAPI_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN      = process.env.DRY_RUN === '1';
const ONLY_COMP    = process.env.COMP || null;
const BASE         = 'https://api.thestatsapi.com/api/football';

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
const cache = new Map();

function norm(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

// ── Multi-strategy name resolution ───────────────────────────────
async function findPlayer(name) {
  const key = norm(name);
  if (cache.has(key)) return cache.get(key);

  const parts  = key.split(' ').filter(Boolean);
  const last   = parts[parts.length - 1];
  const first  = parts[0];
  const initLast = parts.length >= 2 ? `${first[0]} ${last}` : null;

  // Strategy 1: exact ilike
  let row = await sbSearch(name);
  if (row) return set(key, row);

  // Strategy 2: normalised full name
  row = await sbSearch(key);
  if (row) return set(key, row);

  // Strategy 3: first initial + surname  e.g. "B. Fernandes"
  if (initLast) {
    row = await sbSearch(`${first[0]}. ${last}`);
    if (row) return set(key, row);
    row = await sbSearch(`${first[0]} ${last}`);
    if (row) return set(key, row);
  }

  // Strategy 4: surname only (only if > 4 chars and unique)
  if (last.length > 4) {
    const { data } = await sb.from('players').select('id,name')
      .ilike('name', `%${last}%`).limit(4);
    if (data?.length === 1) return set(key, data[0]);
    // If 2-3 results, try to narrow with first name
    if (data?.length <= 3 && data?.length > 1) {
      const narrow = data.filter(p => norm(p.name).includes(first[0]));
      if (narrow.length === 1) return set(key, narrow[0]);
    }
  }

  // Strategy 5: handle hyphenated surnames "Alexander-Arnold" → "arnold"
  if (name.includes('-')) {
    const hyph = name.split('-');
    for (const part of hyph) {
      const n = norm(part);
      if (n.length > 5) {
        const { data } = await sb.from('players').select('id,name')
          .ilike('name', `%${n}%`).limit(3);
        if (data?.length === 1) return set(key, data[0]);
      }
    }
  }

  // Strategy 6: two-word substring (first + last)
  if (parts.length >= 2 && last.length > 3 && first.length > 3) {
    const { data } = await sb.from('players').select('id,name')
      .ilike('name', `%${last}%`).ilike('name', `%${first}%`).limit(2);
    if (data?.length === 1) return set(key, data[0]);
  }

  return set(key, null);
}

async function sbSearch(term) {
  const { data } = await sb.from('players').select('id,name')
    .ilike('name', term).limit(1);
  return data?.[0] || null;
}

function set(key, val) { cache.set(key, val); return val; }

// ── TheStatsAPI helpers ───────────────────────────────────────────
async function api(path, attempt = 0) {
  await sleep(800);
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  if (res.status === 429) {
    const wait = [10000, 20000, 40000][Math.min(attempt, 2)];
    console.log(`  [429] wait ${wait/1000}s`);
    await sleep(wait);
    return api(path, attempt + 1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
    catch (e) { console.error(`  fetchAll: ${e.message}`); break; }
    all.push(...(Array.isArray(json.data) ? json.data : []));
    if (!json.meta?.total_pages || page >= json.meta.total_pages) break;
    page++;
  }
  return all;
}

// Fix season selection — it's now June 2026, the 25/26 season has ended.
// Always pick the season with the highest end_year so we get the most recent
// complete data, not last season's stats.
function pickBestSeason(seasons) {
  return [...seasons].sort((a, b) => b.end_year - a.end_year)[0];
}

async function getStats(playerId, seasonId) {
  try { const j = await api(`/players/${playerId}/stats?season_id=${seasonId}`); return j.data || null; }
  catch { return null; }
}

function buildFields(player, stats, compId, seasonId) {
  if (!stats?.appearances || stats.appearances < 1) return null;
  const sc = stats.scoring||{}, sh = stats.shooting||{};
  const pa = stats.passing||{}, du = stats.duels||{}, de = stats.defending||{};
  const assists = sc.goals_assists_sum != null && sc.goals != null
    ? sc.goals_assists_sum - sc.goals : null;
  const shotAcc = sh.total_shots > 0
    ? Math.round(sh.shots_on_target/sh.total_shots*100) : null;
  return {
    statsapi_player_id:player.id, statsapi_season_id:seasonId,
    statsapi_competition_id:compId, statsapi_enriched_at:new Date().toISOString(),
    big_chances_created:sc.big_chances_created??null, big_chances_missed:sc.big_chances_missed??null,
    total_shots:sh.total_shots??null, shots_on_target:sh.shots_on_target??null, shot_accuracy:shotAcc,
    final_third_passes:pa.accurate_final_third_passes??null,
    opp_half_passes:pa.accurate_opposition_half_passes??null,
    own_half_passes:pa.accurate_own_half_passes??null,
    accurate_crosses:pa.accurate_crosses??null, cross_accuracy:pa.accurate_crosses_percentage??null,
    ground_duel_win_pct:du.ground_duels_won_percentage??null,
    aerial_duel_win_pct:du.aerial_duels_won_percentage??null,
    dribble_success_pct:du.successful_dribbles_percentage??null,
    successful_dribbles:du.successful_dribbles??null,
    goals:sc.goals??null, assists, appearances:stats.appearances??null,
    stats_minutes:stats.minutes_played??null, pass_accuracy:pa.pass_accuracy??null,
    key_passes:pa.key_passes??null, tackles:de.tackles??null, interceptions:de.interceptions??null,
  };
}

async function main() {
  console.log(DRY_RUN ? 'DRY RUN\n' : 'LIVE RUN\n');

  const comps = ONLY_COMP
    ? COMPETITIONS.filter(c => c.id === ONLY_COMP)
    : COMPETITIONS;

  let enriched = 0, skipped = 0, errors = 0;

  for (const comp of comps) {
    console.log(`\n═══ ${comp.name} ═══`);
    let season;
    try {
      const j = await api(`/competitions/${comp.id}/seasons`);
      season  = pickBestSeason(j.data || []);
      console.log(`  Season: ${season.name}`);
    } catch (e) { console.error(`  Season: ${e.message}`); continue; }

    let teams;
    try { teams = await fetchAll(`/teams?competition_id=${comp.id}&season_id=${season.id}`); }
    catch (e) { console.error(`  Teams: ${e.message}`); continue; }

    for (const team of teams) {
      const squad = await fetchAll(`/players?team_id=${team.id}`);
      let hits = 0;

      for (const player of squad) {
        // Skip already enriched players
        const { data: existing } = await sb.from('players')
          .select('id').eq('statsapi_player_id', player.id).limit(1);
        if (existing?.length) { skipped++; continue; }

        const stats  = await getStats(player.id, season.id);
        const fields = buildFields(player, stats, comp.id, season.id);
        if (!fields) { skipped++; continue; }

        const row = await findPlayer(player.name);
        if (!row) { skipped++; continue; }

        if (!DRY_RUN) {
          const { error: e } = await sb.from('players').update(fields).eq('id', row.id);
          if (e) { errors++; continue; }
        } else {
          console.log(`  MATCH: "${player.name}" → "${row.name}"`);
        }
        hits++; enriched++;
      }
      if (hits > 0) console.log(`  ${team.name}: +${hits} recovered`);
    }
  }

  console.log(`\n── Summary ──`);
  console.log(`Recovered : ${enriched}`);
  console.log(`Skipped   : ${skipped}`);
  console.log(`Errors    : ${errors}`);
}

main().catch(console.error);
