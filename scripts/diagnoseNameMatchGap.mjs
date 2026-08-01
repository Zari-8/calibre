// scripts/diagnoseNameMatchGap.mjs — READ-ONLY. No writes (to Supabase OR
// to enrichStatsAPI_progress.json — this never touches that file).
//
// checkEnrichmentGaps.mjs found 45% of scored players (6,846, incl. 4,672
// regulars) were never touched by the full-season enrichStatsAPI.mjs sweep.
// Some of that is players in leagues genuinely outside the 19-competition
// scope (expected). But some — e.g. Racing Club, Flamengo, Atlético-MG,
// Al-Hilal, Al-Ittihad, FC Cincinnati — are in COVERED competitions and
// still missing, which points at enrichStatsAPI.mjs's findPlayer() failing
// to link a real TheStatsAPI player to an existing Supabase row (the "No
// Supabase match" counter — 46,883 in the live run, far bigger than the 331
// write-errors). This script re-fetches ONE short window per suspect
// competition, re-runs the exact same findPlayer() matching logic used by
// the live script, and prints every miss side-by-side with its raw
// TheStatsAPI name and (if one exists) the closest-looking Supabase row —
// so we can see the actual mismatch pattern (accents, name order,
// suffixes, single-name Brazilian-style players, etc.) before touching
// findPlayer() itself.
//
// Run: node scripts/diagnoseNameMatchGap.mjs
//      COMP=comp_4540 DATE_FROM=2025-09-05 DATE_TO=2025-09-12 node scripts/diagnoseNameMatchGap.mjs
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
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
if (!API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing STATSAPI_KEY / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const BASE = 'https://api.thestatsapi.com/api/football';
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Same suspects that showed up in checkEnrichmentGaps.mjs's never-enriched
// top-20 despite being in covered competitions. One short window each —
// this is a diagnostic sample, not a re-sweep.
const SUSPECTS = process.env.COMP
  ? [{ name: 'custom', id: process.env.COMP, from: process.env.DATE_FROM || '2025-09-05', to: process.env.DATE_TO || '2025-09-12' }]
  : [
      { name: 'Liga Profesional (Argentina)', id: 'comp_4540', from: '2025-09-05', to: '2025-09-12' },
      { name: 'Brasileirão', id: 'comp_4795', from: '2025-09-05', to: '2025-09-12' },
      { name: 'Saudi Pro League', id: 'comp_45025', from: '2025-09-05', to: '2025-09-12' },
      { name: 'MLS', id: 'comp_9799', from: '2025-09-05', to: '2025-09-12' },
    ];

function rows(json) {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.matches)) return json.matches;
  if (Array.isArray(json?.results)) return json.results;
  return [];
}

async function api(path) {
  await sleep(500);
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${API_KEY}`, Accept: 'application/json' } });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { rawText: text }; }
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${path} — ${json?.error?.message || text.slice(0, 200)}`);
  if (json.error) throw new Error(json.error.message || JSON.stringify(json.error));
  return json;
}

function norm(s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
function firstNameMatches(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length === 1) return b[0] === a;
  if (b.length === 1) return a[0] === b;
  return false;
}
function lastNameMatches(searchLast, candidateLastToken) {
  if (!searchLast || !candidateLastToken) return false;
  if (candidateLastToken === searchLast) return true;
  return candidateLastToken.split('-').includes(searchLast);
}

// Mirrors enrichStatsAPI.mjs's findPlayer() exactly (statsapi_player_id
// lookup, then exact ilike, then surname-pool + first/last token match).
async function findPlayer({ statsapiPlayerId, playerName }) {
  if (statsapiPlayerId) {
    const { data } = await sb.from('players').select('id, name, statsapi_player_id')
      .eq('statsapi_player_id', String(statsapiPlayerId)).limit(1);
    if (data?.length) return { row: data[0], via: 'statsapi_id' };
  }
  const key = norm(playerName);
  if (!key) return { row: null, via: 'none', pool: [] };

  let { data } = await sb.from('players').select('id, name, statsapi_player_id')
    .ilike('name', playerName).limit(1);
  if (data?.length) return { row: data[0], via: 'exact_ilike' };

  const parts = key.split(' ').filter(Boolean);
  const last = parts[parts.length - 1];
  const first = parts[0];

  // HYPOTHESIS TEST — production findPlayer() only tries `last` here, which
  // is the ACCENT- AND HYPHEN-STRIPPED token (from norm()). Postgres ilike
  // is a literal substring match, not accent-insensitive — so if the DB row
  // itself still has the accent/hyphen ("Rajković", "Milinković-Savić",
  // "Kanté", "Al-Ghamdi"), searching ilike '%rajkovic%' against a stored
  // "Rajković" never matches, and the pool comes back empty even though the
  // player IS in the table. Also trying the RAW (accent/hyphen-preserved)
  // last token here, from the ORIGINAL playerName not the normalized key,
  // to see how many "none found" misses are actually this bug vs. genuinely
  // absent from the table.
  const rawParts = String(playerName || '').trim().split(/\s+/).filter(Boolean);
  const rawLast = rawParts[rawParts.length - 1] || '';

  let pool = [];
  const patterns = [...new Set([last, rawLast].filter(s => s && s.length > 2))];
  for (const pat of patterns) {
    const { data: poolData } = await sb.from('players')
      .select('id, name, statsapi_player_id, minutes, api_player_id')
      .ilike('name', `%${pat}%`)
      .order('minutes', { ascending: false, nullsFirst: false })
      .limit(25);
    if (poolData?.length) pool.push(...poolData);
  }
  // de-dupe by id
  pool = [...new Map(pool.map(p => [p.id, p])).values()];

  if (pool.length) {
    const narrowed = pool.filter(p => {
      const tokens = norm(p.name).split(' ').filter(Boolean);
      return lastNameMatches(last, tokens[tokens.length - 1] || '') && firstNameMatches(first, tokens[0] || '');
    });
    const best = narrowed.filter(p => (p.minutes > 0) || p.api_player_id).sort((a, b) => (b.minutes || 0) - (a.minutes || 0))[0];
    if (best) {
      const foundViaRawOnly = patterns.includes(rawLast) && !norm(best.name).includes(last);
      return { row: best, via: foundViaRawOnly ? 'surname_pool_RAW_ONLY (bug confirmed)' : 'surname_pool' };
    }
  }
  return { row: null, via: 'none', pool };
}

async function run() {
  let totalSeen = 0, totalMatched = 0, totalMissed = 0, totalRawBugfix = 0;

  for (const comp of SUSPECTS) {
    console.log(`\n${'═'.repeat(70)}\n${comp.name} (${comp.id})  ${comp.from} → ${comp.to}`);
    let matches;
    try {
      const json = await api(`/matches?date_from=${comp.from}&date_to=${comp.to}&competition_id=${comp.id}&page=1`);
      matches = rows(json).filter(m => m.competition_id === comp.id);
    } catch (e) {
      console.log(`  fetch matches failed: ${e.message}`);
      continue;
    }
    console.log(`  ${matches.length} matches`);
    if (!matches.length) continue;

    const seenNames = new Map(); // playerId -> name (dedupe across matches in window)
    for (const match of matches.slice(0, 6)) { // cap per competition — sample, not full re-sweep
      const matchId = match.id || match.match_id;
      if (!matchId) continue;
      let ps;
      try { ps = await api(`/matches/${matchId}/player-stats`); } catch (e) { console.log(`  match ${matchId} player-stats failed: ${e.message}`); continue; }
      for (const row of rows(ps)) {
        if (row.player_id && row.player_name) seenNames.set(row.player_id, { name: row.player_name, team: row.team_name });
      }
    }

    let missed = [];
    let rawBugfix = [];
    for (const [playerId, info] of seenNames) {
      totalSeen++;
      const result = await findPlayer({ statsapiPlayerId: playerId, playerName: info.name });
      if (result.row) {
        totalMatched++;
        if (result.via?.startsWith('surname_pool_RAW_ONLY')) {
          totalRawBugfix++;
          rawBugfix.push({ statsapi: info.name, matched: result.row.name });
        }
        continue;
      }
      totalMissed++;
      missed.push({ ...info, pool: result.pool });
    }

    console.log(`  ${seenNames.size} unique players seen, ${seenNames.size - missed.length} matched, ${missed.length} missed`);
    if (rawBugfix.length) {
      console.log(`  ${rawBugfix.length} of those matches ONLY succeeded via the accent-preserved fallback (i.e. production findPlayer() would have missed them):`);
      for (const b of rawBugfix) console.log(`    RESCUED: statsapi="${b.statsapi}"  →  matched Supabase row "${b.matched}"`);
    }
    for (const m of missed.slice(0, 15)) {
      const closest = (m.pool || []).slice(0, 3).map(p => `"${p.name}"`).join(', ') || 'none found';
      console.log(`    MISS: statsapi="${m.name}" (${m.team})  →  closest Supabase surname-pool candidates: ${closest}`);
    }
  }

  console.log(`\n${'═'.repeat(70)}\nTotals: ${totalSeen} seen, ${totalMatched} matched (${totalRawBugfix} only via accent-preserved fallback), ${totalMissed} genuinely missed (${totalSeen ? (totalMissed / totalSeen * 100).toFixed(1) : '0.0'}%)`);
}

run().catch(e => { console.error('\nFatal:', e?.message ?? e); process.exit(1); });
