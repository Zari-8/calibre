// scripts/probeLewandowskiXgCoverage.mjs — READ-ONLY against TheStatsAPI, no
// Supabase writes. Answers a specific question: is Lewandowski's stored
// xg=3.5 (vs 19 real goals) a genuine shot-quality read, or is it built from
// only a fraction of his season because TheStatsAPI doesn't have shot/xG
// data for every match?
//
// enrichStatsAPI.mjs already reveals the mechanism: every match response
// carries an `xg_available` flag, and the shotmap endpoint (the only source
// of expected_goals) is only called `if (match.xg_available)`. This walks
// Barcelona's LaLiga season the same way the real enrichment does, but logs
// per-match xg_available status and Lewandowski's own shots/xG so the gap is
// visible directly instead of inferred.
//
// Run:
//   node scripts/probeLewandowskiXgCoverage.mjs
// Optional:
//   DATE_FROM=2025-08-01 DATE_TO=2026-07-10 TEAM="barcelona" PLAYER="lewandowski" node scripts/probeLewandowskiXgCoverage.mjs

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

const COMP_ID = process.env.COMP || 'comp_8814'; // LaLiga
const DATE_FROM = process.env.DATE_FROM || '2025-08-01';
const DATE_TO = process.env.DATE_TO || '2026-07-10';
const TEAM_FILTER = (process.env.TEAM || 'barcelona').toLowerCase();
const PLAYER_FILTER = (process.env.PLAYER || 'lewandowski').toLowerCase();
const DELAY_MS = Number(process.env.DELAY_MS || 500);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(path, attempt = 0) {
  await sleep(DELAY_MS);
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${API_KEY}`, Accept: 'application/json' } });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { rawText: text }; }
  if (res.status === 429) {
    const wait = [10000, 20000, 40000, 60000][Math.min(attempt, 3)];
    console.log(`  [429] waiting ${wait / 1000}s...`);
    await sleep(wait);
    return api(path, attempt + 1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${path} — ${json?.error?.message || text.slice(0, 200)}`);
  if (json.error) throw new Error(json.error.message || JSON.stringify(json.error));
  return json;
}

function rows(json) {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.matches)) return json.matches;
  if (Array.isArray(json?.results)) return json.results;
  return [];
}
function shotRows(json) {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.shots)) return json.shots;
  if (Array.isArray(json?.shotmap)) return json.shotmap;
  return [];
}
function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

async function fetchMatches(from, to) {
  const all = [];
  let cursor = from;
  while (cursor <= to) {
    const end = addDays(cursor, 6);
    const windowEnd = end > to ? to : end;
    let page = 1;
    while (true) {
      const json = await api(`/matches?date_from=${cursor}&date_to=${windowEnd}&competition_id=${COMP_ID}&page=${page}`);
      all.push(...rows(json).filter((m) => m.competition_id === COMP_ID));
      const totalPages = json.meta?.total_pages || 1;
      if (page >= totalPages) break;
      page++;
    }
    cursor = addDays(windowEnd, 1);
  }
  const unique = new Map();
  for (const m of all) { const id = m.id || m.match_id; if (id) unique.set(id, m); }
  return [...unique.values()];
}

async function main() {
  console.log(`Fetching ${COMP_ID} matches ${DATE_FROM} → ${DATE_TO}...\n`);
  const matches = await fetchMatches(DATE_FROM, DATE_TO);
  console.log(`Total matches in range: ${matches.length}`);
  console.log(`Flagged xg_available  : ${matches.filter((m) => m.xg_available).length}\n`);

  // Narrow to matches involving the target team, using whatever team fields
  // the match object actually carries — print one raw match first so the
  // shape is visible if these guesses are wrong.
  console.log('── sample match object (first result) ──');
  console.log(JSON.stringify(matches[0], null, 2).slice(0, 1500));
  console.log('');

  const teamMatches = matches.filter((m) => {
    const blob = JSON.stringify(m).toLowerCase();
    return blob.includes(TEAM_FILTER);
  });
  console.log(`Matches mentioning "${TEAM_FILTER}": ${teamMatches.length}`);
  console.log(`Of those, xg_available: ${teamMatches.filter((m) => m.xg_available).length}\n`);

  let totalShots = 0, totalGoals = 0, totalXg = 0, totalShotmapXg = 0;
  let matchesWithPlayerStats = 0, matchesWithShotmap = 0, matchesPlayerAppeared = 0;

  for (const match of teamMatches) {
    const matchId = match.id || match.match_id;
    if (!matchId) continue;
    let appeared = false;

    try {
      const ps = await api(`/matches/${matchId}/player-stats`);
      matchesWithPlayerStats++;
      for (const row of rows(ps)) {
        if (!String(row.player_name || '').toLowerCase().includes(PLAYER_FILTER)) continue;
        appeared = true;
        const shooting = row.shooting || {};
        totalShots += num(shooting.total_shots);
        totalGoals += num(shooting.goals);
        totalXg += num(shooting.expected_goals);
        console.log(`  [player-stats] ${matchId} (xg_available=${!!match.xg_available}): shots=${num(shooting.total_shots)} goals=${num(shooting.goals)} expected_goals=${num(shooting.expected_goals)}`);
      }
    } catch (e) { console.error(`  player-stats error ${matchId}: ${e.message}`); }

    if (match.xg_available) {
      try {
        const sm = await api(`/matches/${matchId}/shotmap`);
        matchesWithShotmap++;
        for (const shot of shotRows(sm)) {
          if (!String(shot.player_name || '').toLowerCase().includes(PLAYER_FILTER)) continue;
          totalShotmapXg += num(shot.expected_goals);
        }
      } catch (e) { console.error(`  shotmap error ${matchId}: ${e.message}`); }
    }

    if (appeared) matchesPlayerAppeared++;
  }

  console.log(`\n══════════ ${PLAYER_FILTER} summary across ${teamMatches.length} ${TEAM_FILTER} matches ══════════`);
  console.log(`Matches player appeared in (player-stats): ${matchesPlayerAppeared}`);
  console.log(`Matches with player-stats fetched        : ${matchesWithPlayerStats}`);
  console.log(`Matches with shotmap fetched (xg_available): ${matchesWithShotmap}`);
  console.log(`Total shots (player-stats)   : ${totalShots}`);
  console.log(`Total goals (player-stats)   : ${totalGoals}`);
  console.log(`Total expected_goals (player-stats): ${totalXg.toFixed(2)}`);
  console.log(`Total shotmap xG (shotmap endpoint): ${totalShotmapXg.toFixed(2)}`);
  console.log(`\nStored players.xg for comparison: 3.5 (from the row pulled earlier this session)`);
  console.log(`If matchesWithShotmap << matchesPlayerAppeared, that confirms a coverage gap, not a real shot-quality read.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
