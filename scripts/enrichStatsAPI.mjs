/**
 * enrichStatsAPI.mjs
 * Pulls TheStatsAPI player stats for all 9 highlighted leagues
 * and upserts into Supabase.
 *
 * Run:
 *   STATSAPI_KEY=xxx \
 *   SUPABASE_URL=xxx \
 *   SUPABASE_SERVICE_KEY=xxx \   ← service role key, not anon key
 *   node scripts/enrichStatsAPI.mjs
 *
 * Optional flags:
 *   DRY_RUN=1       log only, no writes
 *   COMP=comp_3039  single competition
 */

import { createClient } from '@supabase/supabase-js';

const API_KEY      = process.env.STATSAPI_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
// Service role key bypasses RLS — required to read all rows
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
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

async function api(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Authorization': `Bearer ${API_KEY}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${path}`);
  const json = await res.json();
  if (json.error) throw new Error(`API error: ${json.error.message}`);
  return json;
}

async function fetchAll(path, delay = 600) {
  const sep = path.includes('?') ? '&' : '?';
  let page = 1;
  const all = [];
  while (true) {
    await sleep(delay);
    let json;
    try {
      json = await api(`${path}${sep}per_page=50&page=${page}`);
    } catch (e) {
      console.error(`    fetchAll error (page ${page}): ${e.message}`);
      break;
    }
    const rows = Array.isArray(json.data) ? json.data : [];
    all.push(...rows);
    const meta = json.meta || {};
    if (!meta.total_pages || page >= meta.total_pages) break;
    page++;
  }
  return all;
}

function norm(name) {
  return String(name || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

// Always prefer the most recently COMPLETED season — richest stats.
// Current (in-progress) season has partial data; skip it for enrichment.
function pickBestSeason(seasons) {
  const completed = seasons.filter(s => !s.is_current);
  if (completed.length) {
    return completed.sort((a, b) => b.end_year - a.end_year)[0];
  }
  // Fallback to current if no completed seasons exist
  return seasons.sort((a, b) => b.end_year - a.end_year)[0];
}

async function getBestSeason(compId) {
  const json = await api(`/competitions/${compId}/seasons`);
  return pickBestSeason(json.data || []);
}

async function getStats(playerId, seasonId) {
  await sleep(400);
  try {
    const json = await api(`/players/${playerId}/stats?season_id=${seasonId}`);
    return json.data || null;
  } catch (e) {
    return null;
  }
}

function buildFields(player, stats, compId, seasonId) {
  if (!stats) return null;
  // Require at least 1 appearance — skip pre-season/unplayed rows
  if (!stats.appearances || stats.appearances < 1) return null;

  const sc = stats.scoring   || {};
  const sh = stats.shooting  || {};
  const pa = stats.passing   || {};
  const du = stats.duels     || {};
  const de = stats.defending || {};

  const shotAcc = sh.total_shots > 0
    ? Math.round((sh.shots_on_target / sh.total_shots) * 100) : null;

  const assists = (sc.goals_assists_sum != null && sc.goals != null)
    ? sc.goals_assists_sum - sc.goals : null;

  return {
    statsapi_player_id:      player.id,
    statsapi_season_id:      seasonId,
    statsapi_competition_id: compId,
    statsapi_enriched_at:    new Date().toISOString(),
    big_chances_created:     sc.big_chances_created            ?? null,
    big_chances_missed:      sc.big_chances_missed             ?? null,
    total_shots:             sh.total_shots                    ?? null,
    shots_on_target:         sh.shots_on_target                ?? null,
    shot_accuracy:           shotAcc,
    final_third_passes:      pa.accurate_final_third_passes    ?? null,
    opp_half_passes:         pa.accurate_opposition_half_passes ?? null,
    own_half_passes:         pa.accurate_own_half_passes        ?? null,
    accurate_crosses:        pa.accurate_crosses               ?? null,
    cross_accuracy:          pa.accurate_crosses_percentage    ?? null,
    ground_duel_win_pct:     du.ground_duels_won_percentage    ?? null,
    aerial_duel_win_pct:     du.aerial_duels_won_percentage    ?? null,
    dribble_success_pct:     du.successful_dribbles_percentage ?? null,
    successful_dribbles:     du.successful_dribbles            ?? null,
    goals:                   sc.goals                         ?? null,
    assists,
    appearances:             stats.appearances                 ?? null,
    stats_minutes:           stats.minutes_played             ?? null,
    pass_accuracy:           pa.pass_accuracy                 ?? null,
    key_passes:              pa.key_passes                    ?? null,
    tackles:                 de.tackles                       ?? null,
    interceptions:           de.interceptions                 ?? null,
  };
}

async function main() {
  if (!API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing: STATSAPI_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY');
    process.exit(1);
  }

  if (DRY_RUN) console.log('DRY RUN — no writes\n');

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Load ALL players — requires service role key to bypass RLS row limits
  console.log('Loading Supabase player index...');
  let allPlayers = [];
  let from = 0;
  const PAGE = 5000;
  while (true) {
    const { data, error } = await sb
      .from('players').select('id, name').range(from, from + PAGE - 1);
    if (error) { console.error('Load failed:', error.message); process.exit(1); }
    if (!data || data.length === 0) break;
    allPlayers.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  const byName = new Map();
  for (const p of allPlayers) {
    const key = norm(p.name);
    if (!byName.has(key)) byName.set(key, p);
  }
  console.log(`Loaded ${allPlayers.length} Supabase players\n`);

  const comps = ONLY_COMP
    ? COMPETITIONS.filter(c => c.id === ONLY_COMP)
    : COMPETITIONS;

  let totalEnriched = 0, totalSkipped = 0, totalErrors = 0;

  for (const comp of comps) {
    console.log(`\n═══ ${comp.name} ═══`);

    let season;
    try {
      season = await getBestSeason(comp.id);
      console.log(`  Season: ${season.name} (${season.id}) — completed: ${!season.is_current}`);
      await sleep(500);
    } catch (e) { console.error(`  Season error: ${e.message}`); continue; }

    let teams;
    try {
      teams = await fetchAll(`/teams?competition_id=${comp.id}&season_id=${season.id}`, 600);
      console.log(`  Teams: ${teams.length}`);
    } catch (e) { console.error(`  Teams error: ${e.message}`); continue; }

    for (const team of teams) {
      const squad = await fetchAll(`/players?team_id=${team.id}`, 600);
      let teamHits = 0, teamSkipped = 0;

      for (const player of squad) {
        const stats  = await getStats(player.id, season.id);
        const fields = buildFields(player, stats, comp.id, season.id);

        if (!fields) { totalSkipped++; teamSkipped++; continue; }

        const dbRow = byName.get(norm(player.name));
        if (!dbRow) { totalSkipped++; teamSkipped++; continue; }

        if (!DRY_RUN) {
          const { error: upErr } = await sb
            .from('players').update(fields).eq('id', dbRow.id);
          if (upErr) { console.error(`    Update error ${player.name}: ${upErr.message}`); totalErrors++; continue; }
        }

        teamHits++;
        totalEnriched++;
      }

      console.log(`  ${team.name}: ${teamHits}/${squad.length} enriched (${teamSkipped} skipped)`);
      await sleep(500);
    }
  }

  console.log(`\n──────────────────────────`);
  console.log(`Enriched : ${totalEnriched}`);
  console.log(`Skipped  : ${totalSkipped}`);
  console.log(`Errors   : ${totalErrors}`);
}

main().catch(console.error);
