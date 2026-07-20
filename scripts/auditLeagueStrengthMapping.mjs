// scripts/auditLeagueStrengthMapping.mjs — READ-ONLY against Supabase, live
// reads against API-Football (same key every ingestion script uses).
//
// The Seimen case generalized: every SC Paderborn player was tagged
// league_id=78 (top-flight Bundesliga, sRaw=0.98 in LEAGUE_ID_STRENGTH)
// when Paderborn actually plays in 2. Bundesliga (id=79, sRaw=0.78) — a
// full team's worth of players inflated by a wrong league tag, invisible to
// any per-player formula fix. This generalizes that check across the WHOLE
// database: for every league_id that actually has players on record here,
// pull API-Football's real current team roster for that league and flag any
// team stored under it that ISN'T really a member — i.e. every "Paderborn
// hiding in Bundesliga" case, not just the one Zari happened to catch by
// eye.
//
// Also separately flags any league_id present in the DB that has NO entry
// in LEAGUE_ID_STRENGTH at all (falls through to DEFAULT_LEAGUE=0.70,
// silently, which may or may not be appropriate for that specific league).
//
// Run: node scripts/auditLeagueStrengthMapping.mjs
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
const API_KEY = process.env.API_FOOTBALL_KEY;
const API_HOST = 'https://v3.football.api-sports.io';
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
if (!API_KEY) { console.error('Missing API_FOOTBALL_KEY'); process.exit(1); }
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

// Mirrors calibreRating.js's LEAGUE_ID_STRENGTH keys (kept as a plain list
// here, not imported, since this script's job is to find gaps/mismatches in
// that map, not assume it's already correct).
const KNOWN_LEAGUE_IDS = [39,140,78,79,135,61,94,88,71,144,40,203,128,13,307,253,98,281,12,399,525,44,254,142,82,64,139,949];

const PAGE = 1000;
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchAllPlayers() {
  const rows = [];
  let offset = 0;
  while (true) {
    const { data, error } = await sb
      .from('players')
      .select('team,league_id')
      .gt('minutes', 0)
      .not('league_id', 'is', null)
      .order('id', { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) { console.error('Fetch failed:', error.message); process.exit(1); }
    if (!data || data.length === 0) break;
    rows.push(...data);
    offset += data.length;
    process.stdout.write(`\r  fetched ${rows.length} rows...`);
    if (data.length < PAGE) break;
  }
  process.stdout.write('\n');
  return rows;
}

async function fetchLeagueRoster(leagueId, season) {
  const res = await fetch(`${API_HOST}/teams?league=${leagueId}&season=${season}`, { headers: { 'x-apisports-key': API_KEY } });
  if (!res.ok) return null;
  const json = await res.json();
  return (json.response ?? []).map(t => String(t.team.name).toLowerCase());
}

function normalize(name) {
  return String(name || '').toLowerCase()
    .replace(/\bfc\b|\bcf\b|\bsc\b|\bac\b|\bafc\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

async function run() {
  console.log('League strength mapping audit — read-only against Supabase, live reads against API-Football.\n');
  const rows = await fetchAllPlayers();

  const byLeague = new Map();
  for (const r of rows) {
    const id = Number(r.league_id);
    if (!Number.isFinite(id) || id <= 0) continue;
    if (!byLeague.has(id)) byLeague.set(id, new Map());
    const teams = byLeague.get(id);
    teams.set(r.team, (teams.get(r.team) || 0) + 1);
  }

  const leagueIds = [...byLeague.keys()].sort((a, b) => a - b);
  console.log(`${leagueIds.length} distinct league_id values on record with real players.\n`);

  console.log('── league_id values with NO entry in LEAGUE_ID_STRENGTH (falls to DEFAULT_LEAGUE=0.70) ──');
  const missing = leagueIds.filter(id => !KNOWN_LEAGUE_IDS.includes(id));
  for (const id of missing) {
    const teams = [...byLeague.get(id).keys()];
    console.log(`  league_id=${id}  (${teams.length} teams, e.g. ${teams.slice(0, 3).join(', ')})`);
  }
  if (!missing.length) console.log('  none — every league_id in use has a strength entry.');

  console.log('\n── Cross-checking each known league_id against API-Football\'s real roster ──\n');
  for (const id of leagueIds) {
    if (!KNOWN_LEAGUE_IDS.includes(id)) continue; // already flagged above
    const teams = byLeague.get(id);
    const teamNames = [...teams.keys()].filter(Boolean);
    if (!teamNames.length) continue;

    let roster = await fetchLeagueRoster(id, 2025);
    if (!roster || !roster.length) roster = await fetchLeagueRoster(id, 2026);
    await sleep(250);
    if (!roster || !roster.length) { console.log(`league_id=${id}: could not fetch a roster to check against (skipping).`); continue; }

    const rosterNorm = new Set(roster.map(normalize));
    const mismatches = teamNames.filter(t => !rosterNorm.has(normalize(t)));
    if (mismatches.length) {
      console.log(`⚠ league_id=${id}: ${mismatches.length}/${teamNames.length} stored team(s) NOT found in API-Football's current roster for this league:`);
      for (const t of mismatches) console.log(`    "${t}"  (${teams.get(t)} players)`);
    } else {
      console.log(`✓ league_id=${id}: all ${teamNames.length} stored teams match the real roster.`);
    }
  }

  console.log('\nDone. Any ⚠ line above is a candidate "Paderborn" — a team whose players are being scored');
  console.log('at the wrong league strength. Investigate each with checkLeagueIdMapping.mjs\'s pattern before fixing.');
}

run().catch(e => { console.error('\nFatal:', e?.message ?? e); process.exit(1); });
