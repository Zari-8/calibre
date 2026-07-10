// scripts/probeStatsApiSeasonEndpoint.mjs — READ-ONLY, no Supabase writes.
// reconcileNames.mjs destructures `de = stats.defending || {}` from
// TheStatsAPI's season endpoint (/players/{id}/stats?season_id=) and then
// never uses it — a real gap. But unlike the match-based endpoint, there's
// no cached raw sample on disk for THIS endpoint, so guessing field names
// (e.g. "tackles" vs "tackles_won_percentage") for a live write would repeat
// exactly the kind of silent-wrong-field mistake this whole session has been
// finding and fixing. This probe fetches ONE real player's season stats and
// prints/saves the full raw response so we know the actual field names
// before writing any parsing code.
//
// Run (one line, no quotes):
//   STATSAPI_KEY=... node scripts/probeStatsApiSeasonEndpoint.mjs
// Optional:
//   COMP=comp_3039   (default Premier League — see COMPETITIONS in reconcileNames.mjs)

import { readFileSync, existsSync, writeFileSync } from 'fs';
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
const COMP = process.env.COMP || 'comp_3039'; // Premier League
const BASE = 'https://api.thestatsapi.com/api/football';

if (!API_KEY) { console.error('Missing STATSAPI_KEY'); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(path) {
  await sleep(500);
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${API_KEY}` } });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${path}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json;
}

function pickBestSeason(seasons) {
  return [...seasons].sort((a, b) => b.end_year - a.end_year)[0];
}

async function main() {
  console.log(`Probing TheStatsAPI season-stats endpoint via ${COMP}...\n`);

  const seasonsJson = await api(`/competitions/${COMP}/seasons`);
  const season = pickBestSeason(seasonsJson.data || []);
  console.log(`Season: ${season.name} (${season.id})`);

  const teamsJson = await api(`/teams?competition_id=${COMP}&season_id=${season.id}&per_page=1`);
  const team = teamsJson.data?.[0];
  if (!team) { console.error('No team found — check COMP id.'); process.exit(1); }
  console.log(`Team: ${team.name} (${team.id})`);

  const squadJson = await api(`/players?team_id=${team.id}&per_page=25`);
  const squad = squadJson.data || [];
  if (!squad.length) { console.error('No players found for that team.'); process.exit(1); }

  // Try players until one actually has appearances this season (skip empty
  // benchwarmers AND players who 404 on this endpoint — not every squad
  // member resolves, same as reconcileNames.mjs's own getStats() handling).
  for (const player of squad) {
    let stats;
    try {
      const statsJson = await api(`/players/${player.id}/stats?season_id=${season.id}`);
      stats = statsJson.data;
    } catch (e) {
      console.log(`  · ${player.name}: ${e.message} — trying next player`);
      continue;
    }
    if (!stats?.appearances || stats.appearances < 1) continue;

    console.log(`\nPlayer: ${player.name} (${player.id}) — ${stats.appearances} appearances\n`);
    console.log(JSON.stringify(stats, null, 2));

    writeFileSync(join(ROOT, 'tmp-statsapi-season-probe.json'), JSON.stringify(stats, null, 2));
    console.log('\nSaved to tmp-statsapi-season-probe.json — paste its contents back so the real');
    console.log('field names (especially the "defending" object) can be wired in correctly.');
    return;
  }

  console.log('No player on this team had appearances this season — try a different COMP.');
}

main().catch((e) => { console.error(e); process.exit(1); });
