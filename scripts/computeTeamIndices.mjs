/**
 * computeTeamIndices.mjs — Calibre × TheStatsAPI team-index layer
 * ─────────────────────────────────────────────────────────────────────────
 * Computes DataGaffer-style team indices PER TEAM-SEASON from raw match data
 * (our OWN computation from event facts — nothing is copied from anyone):
 *
 *   PPDA  — opponent passes ÷ our defensive actions   (LOW  = intense press)
 *   Pace  — combined shots of both teams per match     (HIGH = open game)
 *   TCIX  — our pass/possession share                  (HIGH = control)
 *   NEC   — volatility of goals+xG across matches       (HIGH = unpredictable)
 *   AGIX  — first-half attacking share                 (needs match-stats halves)
 *
 * These are stored RAW. Global 0-100 normalisation happens once, downstream,
 * in aggregateTeamStats.mjs (which already loads every team), so the pressing
 * axis is ranked across ALL teams together — never per-league in isolation.
 *
 * Data sources (same endpoints enrichStatsAPI already uses):
 *   /matches?date_from=..&date_to=..&competition_id=..
 *   /matches/{id}/player-stats   → both teams' passes / defensive actions / shots
 *   /matches/{id}/stats          → possession %, first-half splits (for AGIX)
 *
 * Run (env auto-loads from .env / .env.local):
 *   DRY=1 COMP=comp_3039 DATE_FROM=2025-08-15 DATE_TO=2026-05-31 node scripts/computeTeamIndices.mjs
 *   DELAY_MS=2100 COMP=comp_3039 DATE_FROM=2025-08-15 DATE_TO=2026-05-31 node scripts/computeTeamIndices.mjs
 *
 * NOTE: PPDA/Pace/TCIX/NEC come from /player-stats, whose shape is confirmed.
 * Possession% and AGIX come from /matches/{id}/stats, whose field names are
 * inferred — if those log as null, paste one raw /stats JSON and they're a
 * one-line fix. The four core indices work regardless.
 * ─────────────────────────────────────────────────────────────────────────
 */

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

const API_KEY = process.env.STATSAPI_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY;

const DRY = process.env.DRY === '1' || process.env.DRY_RUN === '1';
const ONLY_COMP = process.env.COMP || null;
const DATE_FROM = process.env.DATE_FROM || '2025-08-15';
const DATE_TO = process.env.DATE_TO || '2026-05-31';
const DELAY_MS = Number(process.env.DELAY_MS || 2100);   // Starter plan = 30/min
const FETCH_MATCH_STATS = process.env.NO_MATCH_STATS !== '1'; // set NO_MATCH_STATS=1 to skip possession/AGIX
const MIN_MATCHES = Number(process.env.MIN_MATCHES || 5);
const DEBUG = process.env.DEBUG === '1';
const BASE = 'https://api.thestatsapi.com/api/football';

if (!API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing env vars. Need STATSAPI_KEY, SUPABASE_URL/VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
const sleep = ms => new Promise(r => setTimeout(r, ms));

function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function round(v, dp = 3) { return Number(num(v).toFixed(dp)); }

function rows(json) {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.matches)) return json.matches;
  if (Array.isArray(json?.results)) return json.results;
  return [];
}
function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function norm(s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

async function api(path, attempt = 0) {
  await sleep(DELAY_MS);
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${API_KEY}`, Accept: 'application/json' },
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { rawText: text }; }
  if (res.status === 429) {
    const wait = [10000, 20000, 40000, 60000][Math.min(attempt, 3)];
    console.log(`  [429] waiting ${wait / 1000}s...`);
    await sleep(wait);
    return api(path, attempt + 1);
  }
  if (!res.ok) {
    const msg = json?.error?.message || text.slice(0, 200);
    throw new Error(`HTTP ${res.status} — ${path} — ${msg}`);
  }
  if (json.error) throw new Error(json.error.message || JSON.stringify(json.error));
  return json;
}

async function fetchMatches(from, to) {
  const all = [];
  let cursor = from;
  while (cursor <= to) {
    const end = addDays(cursor, 6);
    const windowEnd = end > to ? to : end;
    console.log(`Fetching matches ${cursor} → ${windowEnd}`);
    let page = 1;
    while (true) {
      const compParam = ONLY_COMP ? `&competition_id=${ONLY_COMP}` : '';
      const json = await api(`/matches?date_from=${cursor}&date_to=${windowEnd}${compParam}&page=${page}`);
      const batch = rows(json).filter(m => !ONLY_COMP || m.competition_id === ONLY_COMP);
      all.push(...batch);
      const totalPages = json.meta?.total_pages || 1;
      if (page >= totalPages) break;
      page++;
    }
    cursor = addDays(windowEnd, 1);
  }
  const unique = new Map();
  for (const m of all) {
    const id = m.id || m.match_id;
    if (id) unique.set(id, m);
  }
  return [...unique.values()];
}

// ── Per-match: collapse both teams' player rows into team totals ────────────
// Returns { [team_id]: { passes, def_actions, shots, xg, goals, touches, name } }
// ── Pull team_id → team_name from the MATCH object (fixtures carry names) ────
// Defensive across common shapes; returns {} if nothing recognisable.
function matchTeamNames(match) {
  const out = {};
  const put = (id, name) => { if (id != null && name) out[id] = String(name); };
  // parallel fields
  put(match.home_team_id, match.home_team_name);
  put(match.away_team_id, match.away_team_name);
  // nested objects
  for (const side of ['home_team', 'away_team', 'home', 'away']) {
    const o = match[side];
    if (o && typeof o === 'object') put(o.id ?? o.team_id, o.name ?? o.team_name);
  }
  // teams: {home,away} or [ ... ]
  const teams = match.teams;
  if (Array.isArray(teams)) for (const o of teams) put(o.id ?? o.team_id, o.name ?? o.team_name);
  else if (teams && typeof teams === 'object')
    for (const side of ['home', 'away']) { const o = teams[side]; if (o) put(o.id ?? o.team_id, o.name ?? o.team_name); }
  // participants: [ ... ]
  if (Array.isArray(match.participants))
    for (const o of match.participants) put(o.id ?? o.team_id, o.name ?? o.team_name);
  return out;
}

function teamTotalsFromPlayerStats(json) {
  const teams = {};
  for (const row of rows(json)) {
    const tid = row.team_id;
    if (!tid) continue;
    const t = (teams[tid] ||= {
      team_id: tid, team_name: row.team_name || '',
      passes: 0, def_actions: 0, shots: 0, xg: 0, goals: 0, touches: 0,
    });
    const passing = row.passing || {};
    const shooting = row.shooting || {};
    const duels = row.duels || {};
    const defending = row.defending || {};
    const general = row.general || {};

    t.passes      += num(passing.total_passes);
    // Defensive actions for PPDA: tackles + interceptions + challenges + fouls
    t.def_actions += num(defending.tackles) + num(defending.interceptions)
                   + num(duels.won_contest) + num(duels.challenge_lost)
                   + num(general.fouls);
    t.shots       += num(shooting.total_shots);
    t.xg          += num(shooting.expected_goals);
    t.goals       += num(shooting.goals);
    t.touches     += num(general.touches);
  }
  return teams;
}

// ── Team stats from /matches/{id}/stats ─────────────────────────────────────
// Real shape: data.overview.{metric}.{all|first_half|second_half}.{home|away}.
// Maps home/away → team ids passed from the match object.
function teamStatsFromMatchStats(json, homeId, awayId) {
  const ov = json?.data?.overview || json?.overview || {};
  const pick = (metric, split, side) => {
    const m = ov[metric]; if (!m) return null;
    const s = m[split]; if (!s) return null;
    return s[side] != null ? num(s[side]) : null;
  };
  const out = {};
  for (const [side, id] of [['home', homeId], ['away', awayId]]) {
    if (!id) continue;
    out[id] = {
      possession: pick('ball_possession', 'all', side),
      all_xg:     pick('expected_goals', 'all', side),
      fh_xg:      pick('expected_goals', 'first_half', side),
      all_shots:  pick('total_shots', 'all', side),
      fh_shots:   pick('total_shots', 'first_half', side),
      passes:     pick('passes', 'all', side),
    };
  }
  return out;
}

function stdev(arr) {
  if (arr.length < 2) return 0;
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  const v = arr.reduce((a, b) => a + (b - m) * (b - m), 0) / arr.length;
  return Math.sqrt(v);
}

async function main() {
  console.log(DRY ? 'DRY RUN — nothing will be written\n' : 'LIVE RUN\n');
  console.log('Date range:', DATE_FROM, '→', DATE_TO, ONLY_COMP ? `· ${ONLY_COMP}` : '');
  console.log('Match-stats (possession/AGIX):', FETCH_MATCH_STATS ? 'ON' : 'OFF', '\n');

  const matches = await fetchMatches(DATE_FROM, DATE_TO);
  console.log(`\nUnique matches: ${matches.length}\n`);

  // team-season accumulators
  const agg = new Map(); // key: team_id|season → bucket
  const keyFor = (tid, season) => `${tid}|${season || ''}`;
  let poolMatches = 0, statErr = 0, msOk = 0, msErrShown = false, processed = 0;

  for (const match of matches) {
    const matchId = match.id || match.match_id;
    if (!matchId) continue;
    const season = match.season_id || '';
    const comp = match.competition_id || '';

    // ── one-time structure dump so we can pin exact field names ──
    if (DEBUG) {
      console.log('\n===== DEBUG: match object keys =====');
      console.log(Object.keys(match).join(', '));
      console.log('\n===== DEBUG: match object (truncated) =====');
      console.log(JSON.stringify(match).slice(0, 1600));
      try {
        const ps = await api(`/matches/${matchId}/player-stats`);
        const r0 = rows(ps)[0] || {};
        console.log('\n===== DEBUG: first player-stats row keys =====');
        console.log(Object.keys(r0).join(', '));
        console.log('\n===== DEBUG: first player-stats row (truncated) =====');
        console.log(JSON.stringify(r0).slice(0, 1200));
      } catch (e) { console.log('player-stats err:', e.message); }
      try {
        const raw = await api(`/matches/${matchId}/stats`);
        console.log('\n===== DEBUG: /matches/{id}/stats (truncated) =====');
        console.log(JSON.stringify(raw).slice(0, 1800));
      } catch (e) { console.log('\n===== DEBUG: /stats ERROR =====\n' + e.message); }
      console.log('\n(DEBUG done — exiting. Paste the above.)');
      return;
    }

    if (++processed % 25 === 0) console.log(`  …processed ${processed}/${matches.length} matches`);

    let teams;
    try {
      const ps = await api(`/matches/${matchId}/player-stats`);
      teams = teamTotalsFromPlayerStats(ps);
    } catch (e) {
      statErr++; console.error(`  ${matchId} player-stats: ${e.message}`);
      continue;
    }

    // attach real team names from the match object (player rows lack them)
    const nameMap = matchTeamNames(match);
    for (const id of Object.keys(teams)) {
      if (nameMap[id]) teams[id].team_name = nameMap[id];
    }

    const ids = Object.keys(teams);
    if (ids.length !== 2) continue; // need exactly both sides for opponent linkage
    poolMatches++;

    // optional: possession % + first-half (AGIX)
    let ms = {};
    if (FETCH_MATCH_STATS) {
      try {
        const raw = await api(`/matches/${matchId}/stats`);
        const homeId = match.home_team?.id || match.home_team?.team_id;
        const awayId = match.away_team?.id || match.away_team?.team_id;
        ms = teamStatsFromMatchStats(raw, homeId, awayId);
        if (Object.keys(ms).length) msOk++;
      } catch (e) {
        if (!msErrShown) { console.error(`  (match-stats unavailable, e.g. ${matchId}: ${e.message}) — continuing; possession/AGIX will be null`); msErrShown = true; }
      }
    }

    const [a, b] = ids;
    const pair = [[a, b], [b, a]];
    for (const [self, opp] of pair) {
      const s = teams[self], o = teams[opp];
      const k = keyFor(self, season);
      const bucket = agg.get(k) || {
        team_id: self, season, competition_id: comp, team_name: s.team_name,
        matches: 0,
        passes_for: 0, def_actions_for: 0, opp_passes: 0,
        shots_for: 0, shots_against: 0, xg_for: 0, xg_against: 0,
        goals_for: 0, goals_against: 0, touches_for: 0, touches_against: 0,
        poss_sum: 0, poss_n: 0,
        fh_att_sum: 0, total_att_sum: 0, fh_n: 0,
        game_totals: [], // per-match (goals_for+goals_against) for NEC
        xg_totals: [],
      };
      bucket.matches += 1;
      bucket.passes_for += s.passes;
      bucket.def_actions_for += s.def_actions;
      bucket.opp_passes += o.passes;
      bucket.shots_for += s.shots;      bucket.shots_against += o.shots;
      bucket.xg_for += s.xg;            bucket.xg_against += o.xg;
      bucket.goals_for += s.goals;      bucket.goals_against += o.goals;
      bucket.touches_for += s.touches;  bucket.touches_against += o.touches;
      bucket.game_totals.push(s.goals + o.goals);
      bucket.xg_totals.push(s.xg + o.xg);

      const msSelf = ms[self];
      if (msSelf) {
        if (msSelf.possession != null) { bucket.poss_sum += msSelf.possession; bucket.poss_n += 1; }
        // AGIX: first-half attacking as a share of full-match attacking (match-stats)
        const fhAtt = msSelf.fh_xg != null ? msSelf.fh_xg : msSelf.fh_shots;
        const allAtt = msSelf.all_xg != null ? msSelf.all_xg : msSelf.all_shots;
        if (fhAtt != null && allAtt != null && allAtt > 0) {
          bucket.fh_att_sum += fhAtt; bucket.total_att_sum += allAtt; bucket.fh_n += 1;
        }
      }
      agg.set(k, bucket);
    }
  }

  // ── compute indices ──
  const out = [];
  for (const t of agg.values()) {
    if (t.matches < MIN_MATCHES) continue;
    const ppda_raw = t.def_actions_for > 0 ? round(t.opp_passes / t.def_actions_for) : null;
    const pace_raw = round((t.shots_for + t.shots_against) / t.matches);          // combined shots/match
    const pace_xg  = round((t.xg_for + t.xg_against) / t.matches);
    const poss_share = (t.passes_for + t.opp_passes) > 0 ? t.passes_for / (t.passes_for + t.opp_passes) : null;
    const tcix_raw = t.poss_n > 0 ? round(t.poss_sum / t.poss_n)                   // real possession % if we have it
                                  : (poss_share != null ? round(poss_share * 100) : null);
    const nec_raw  = round(stdev(t.xg_totals.length >= 2 ? t.xg_totals : t.game_totals));
    const agix_raw = t.fh_n > 0 && t.total_att_sum > 0 ? round(t.fh_att_sum / t.total_att_sum) : null;

    out.push({
      team_id: t.team_id, team_name: t.team_name, team_name_norm: norm(t.team_name),
      season: t.season, competition_id: t.competition_id, matches: t.matches,
      ppda_raw, pace_raw, pace_xg, tcix_raw, nec_raw, agix_raw,
      passes_for: t.passes_for, def_actions_for: t.def_actions_for, opp_passes: t.opp_passes,
      updated_at: new Date().toISOString(),
    });
  }

  console.log(`\nPooled matches (both sides present): ${poolMatches} · match-stats OK: ${msOk} · errors: ${statErr}`);
  console.log(`Teams with ≥${MIN_MATCHES} matches: ${out.length}\n`);

  // ── validation: press ranking (low PPDA = intense press) ──
  const withPpda = out.filter(t => t.ppda_raw != null).sort((x, y) => x.ppda_raw - y.ppda_raw);
  const pad = (s, n) => String(s).padEnd(n);
  console.log('MOST INTENSE PRESS (lowest PPDA) — expect PSG / Barça / City near the top:');
  for (const t of withPpda.slice(0, 12)) {
    console.log('  ' + pad(t.team_name, 24) + `PPDA ${pad(t.ppda_raw, 7)} pace ${pad(t.pace_raw, 6)} tcix ${pad(t.tcix_raw ?? '—', 6)} [${t.matches}m]`);
  }
  console.log('\nLEAST INTENSE PRESS (highest PPDA) — expect Real Madrid / deep blocks here:');
  for (const t of withPpda.slice(-12)) {
    console.log('  ' + pad(t.team_name, 24) + `PPDA ${pad(t.ppda_raw, 7)} pace ${pad(t.pace_raw, 6)} tcix ${pad(t.tcix_raw ?? '—', 6)} [${t.matches}m]`);
  }
  console.log('');

  if (DRY) { console.log('DRY RUN — nothing written.'); return; }

  // ── upsert into team_indices ──
  let wrote = 0;
  for (let i = 0; i < out.length; i += 100) {
    const chunk = out.slice(i, i + 100);
    const { error } = await sb.from('team_indices').upsert(chunk, { onConflict: 'team_id,season' });
    if (error) { console.error('Upsert error:', error.message); break; }
    wrote += chunk.length;
  }
  console.log(`Wrote ${wrote} rows to team_indices.`);
}

main().catch(e => { console.error(e); process.exit(1); });
