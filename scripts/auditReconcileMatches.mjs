/**
 * auditReconcileMatches.mjs — READ-ONLY audit for reconcileNames.mjs's
 * name-resolution bug.
 *
 * Bug recap: Strategy 0's "narrow the surname-substring pool by first name"
 * filter degraded (via a stray .trim()) into "does the candidate's full name
 * contain this one letter anywhere," which is true for almost every name.
 * A famous player sharing only a SURNAME with an obscure one (e.g. "Cole
 * Palmer" vs "Liam Palmer") could silently win the match by having more
 * minutes, and reconcileNames.mjs would then overwrite that famous player's
 * row with statsapi_player_id + derived stat columns (shot_accuracy,
 * ground_duel_win_pct, big_chances_created, etc. — see buildFields() in
 * reconcileNames.mjs) belonging to someone else entirely. It never touches
 * team/position/name, only statsapi_* + those derived columns — but that's
 * still wrong data driving the rating/trait engines.
 *
 * This audit re-walks the same team squads reconcileNames.mjs walks (read
 * only, no writes) across every competition in COMPETITIONS. For each squad
 * member, TheStatsAPI tells us their real name directly (that's what "squad
 * member" data is). We look up the Supabase row currently holding that
 * statsapi_player_id and compare the name TheStatsAPI just told us against
 * the name stored on that row. A first-name mismatch is the exact signature
 * of the bug — not a maybe, a direct source-of-truth contradiction.
 *
 * Run:
 *   node scripts/auditReconcileMatches.mjs
 *
 * Optional:
 *   COMP=comp_3039   audit a single competition only (faster smoke test)
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
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
const ONLY_COMP    = process.env.COMP || null;
const BASE         = 'https://api.thestatsapi.com/api/football';

if (!API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing STATSAPI_KEY / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Same 19-competition list reconcileNames.mjs / enrichStatsAPI.mjs use.
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
  { name: 'Championship',   id: 'comp_8321' },
  { name: 'LaLiga 2',       id: 'comp_0976' },
  { name: '2. Bundesliga',  id: 'comp_0406' },
  { name: 'Serie B',        id: 'comp_5450' },
  { name: 'Ligue 2',        id: 'comp_9777' },
  { name: 'Saudi Pro League', id: 'comp_45025' },
  { name: 'MLS',            id: 'comp_9799' },
  { name: 'Trendyol Süper Lig', id: 'comp_9235' },
  { name: 'Scottish Premiership', id: 'comp_6387' },
  { name: 'Liga Profesional de Fútbol', id: 'comp_4540' },
];

function norm(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

// Same corrected comparison as the fixed findPlayer() in reconcileNames.mjs.
function firstNameMatches(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length === 1) return b[0] === a;
  if (b.length === 1) return a[0] === b;
  return false;
}

async function api(path, attempt = 0) {
  await sleep(800);
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${API_KEY}` } });
  if (res.status === 429) {
    const wait = [10000, 20000, 40000][Math.min(attempt, 2)];
    console.log(`  [429] wait ${wait / 1000}s`);
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

function pickBestSeason(seasons) {
  return [...seasons].sort((a, b) => b.end_year - a.end_year)[0];
}

async function main() {
  console.log('AUDIT — read-only, no writes.\n');
  const comps = ONLY_COMP ? COMPETITIONS.filter(c => c.id === ONLY_COMP) : COMPETITIONS;

  let checked = 0, flagged = 0;
  const flaggedRows = [];

  for (const comp of comps) {
    console.log(`\n═══ ${comp.name} ═══`);
    let season;
    try {
      const j = await api(`/competitions/${comp.id}/seasons`);
      season = pickBestSeason(j.data || []);
    } catch (e) { console.error(`  Season: ${e.message}`); continue; }

    let teams;
    try { teams = await fetchAll(`/teams?competition_id=${comp.id}&season_id=${season.id}`); }
    catch (e) { console.error(`  Teams: ${e.message}`); continue; }

    for (const team of teams) {
      const squad = await fetchAll(`/players?team_id=${team.id}`);
      for (const player of squad) {
        const { data } = await sb.from('players')
          .select('id,name,team,statsapi_player_id')
          .eq('statsapi_player_id', player.id)
          .limit(1);
        const row = data?.[0];
        if (!row) continue; // this squad member was never matched to a row — not this bug
        checked++;

        const realFirst = norm(player.name).split(' ').filter(Boolean)[0] || '';
        const storedFirst = norm(row.name).split(' ').filter(Boolean)[0] || '';
        if (!firstNameMatches(realFirst, storedFirst)) {
          flagged++;
          flaggedRows.push({
            statsapi_player_id: player.id,
            statsapi_real_name: player.name,
            statsapi_team: team.name,
            stored_row_id: row.id,
            stored_name: row.name,
            stored_team: row.team,
          });
          console.log(`  ⚠ MISMATCH: statsapi says "${player.name}" (${team.name}) but row ${row.id} is stored as "${row.name}" (${row.team})`);
        }
      }
    }
  }

  console.log(`\n── Summary ──`);
  console.log(`Rows checked (had a statsapi_player_id match): ${checked}`);
  console.log(`Flagged mismatches: ${flagged}`);

  if (flaggedRows.length) {
    const outDir = join(ROOT, 'scripts', 'output');
    mkdirSync(outDir, { recursive: true });
    const outPath = join(outDir, 'reconcile_mismatches.json');
    writeFileSync(outPath, JSON.stringify(flaggedRows, null, 2), 'utf8');
    console.log(`\nWrote ${flaggedRows.length} flagged rows to: ${outPath}`);
    console.log('Review before fixing — each entry needs its statsapi_* and derived');
    console.log('stat columns cleared/reset so the corrected reconcileNames.mjs can');
    console.log('re-match them cleanly on the next live run.');
  } else {
    console.log('\nNo mismatches found in the competitions checked.');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
