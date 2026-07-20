// scripts/lookupGermanLeagueIds.mjs — READ-ONLY. Hits API-Football's /leagues
// endpoint (the actual source of truth this whole pipeline is built on) for
// country=Germany, so we get the REAL league_id for 2. Bundesliga instead of
// guessing. Uses the same API_FOOTBALL_KEY / host every ingestion script in
// this repo already uses (enrichPlayerStats.mjs etc.) — no new credentials.
//
// Run: node scripts/lookupGermanLeagueIds.mjs
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

async function run() {
  const res = await fetch(`${API_HOST}/leagues?country=Germany`, { headers: { 'x-apisports-key': API_KEY } });
  if (!res.ok) { console.error('Request failed:', res.status, await res.text()); process.exit(1); }
  const json = await res.json();
  const leagues = json.response ?? [];
  console.log(`${leagues.length} Germany-tagged leagues/cups on record with API-Football:\n`);
  for (const l of leagues) {
    const seasons = (l.seasons ?? []).filter(s => s.current).map(s => s.year);
    console.log(`  id=${l.league.id}  name="${l.league.name}"  type=${l.league.type}  currentSeason=${seasons.join(',') || '—'}`);
  }

  console.log('\n── Cross-check: teams currently under league_id=78 in the working DB (from checkLeagueIdMapping.mjs) ──');
  const paderborn = await fetch(`${API_HOST}/teams?name=Paderborn`, { headers: { 'x-apisports-key': API_KEY } });
  if (paderborn.ok) {
    const pj = await paderborn.json();
    for (const t of pj.response ?? []) console.log(`  Paderborn team id=${t.team.id}  name="${t.team.name}"  country=${t.team.country}`);
  }
  console.log('\nNow look for the team\'s CURRENT league via /teams/statistics or check which league_id above is');
  console.log('the "2. Bundesliga" / "Bundesliga 2" entry by name — that\'s the correct league_id for Paderborn\'s rows.');
}

run().catch(e => { console.error('\nFatal:', e?.message ?? e); process.exit(1); });
