// scripts/lookupLeagueNames.mjs — READ-ONLY. Hits API-Football's /leagues
// endpoint directly (the actual source of truth) for a given list of
// league_ids, so we get REAL names instead of guessing from memory — same
// principle as lookupGermanLeagueIds.mjs, generalized to any id list.
//
// Built to answer: what are the 25 league_ids in the scored population
// (checkScoredPopulationLeagues.mjs's output) actually called?
//
// Run: node scripts/lookupLeagueNames.mjs
//      IDS=39,140,78 node scripts/lookupLeagueNames.mjs   (custom list)
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

const API_KEY = process.env.API_FOOTBALL_KEY;
const API_HOST = 'https://v3.football.api-sports.io';
if (!API_KEY) { console.error('Missing API_FOOTBALL_KEY in .env/.env.local'); process.exit(1); }

// Default: the exact order printed by checkScoredPopulationLeagues.mjs
// (most players first), so the two outputs line up directly.
const DEFAULT_IDS = [13,253,140,61,128,39,135,94,203,144,88,78,307,12,71,82,44,139,64,254,525,142,949,79,399];
const IDS = process.env.IDS ? process.env.IDS.split(',').map(Number) : DEFAULT_IDS;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  console.log(`Looking up ${IDS.length} league_id(s) directly against API-Football — read-only.\n`);
  for (const id of IDS) {
    const res = await fetch(`${API_HOST}/leagues?id=${id}`, { headers: { 'x-apisports-key': API_KEY } });
    if (!res.ok) { console.log(`league_id=${id}: request failed (${res.status})`); await sleep(200); continue; }
    const json = await res.json();
    const entry = json.response?.[0];
    if (!entry) { console.log(`league_id=${id}: no data returned.`); await sleep(200); continue; }
    const name = entry.league?.name ?? '—';
    const type = entry.league?.type ?? '—';
    const country = entry.country?.name ?? '—';
    console.log(`league_id=${String(id).padEnd(5)} "${name}"  (${type}, ${country})`);
    await sleep(200);
  }
}

run().catch(e => { console.error('\nFatal:', e?.message ?? e); process.exit(1); });
