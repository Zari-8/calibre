// scripts/inspectRashfordRawApiStats.mjs — READ-ONLY, hits API-Football directly
// (no Supabase writes). competition_splits was null on the stored row, so we
// can't see the base/friendly/overlay breakdown after the fact — this pulls
// the same raw per-competition entries enrichPlayerStats.mjs itself consumed
// (api_player_id=909, season 2025, per stored stats_season) to see exactly
// which competition(s) and how many minutes are behind the 8.9 average.
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

const API_KEY = process.env.API_FOOTBALL_KEY;
if (!API_KEY) { console.error('Missing API_FOOTBALL_KEY in .env.local'); process.exit(1); }
const API_HOST = 'https://v3.football.api-sports.io';

const PLAYER_ID = Number(process.env.PLAYER_ID || 909); // Rashford
const SEASONS = (process.env.SEASONS || '2025,2024').split(',').map((s) => s.trim());

async function apiGet(path) {
  const res = await fetch(`${API_HOST}/${path}`, { headers: { 'x-apisports-key': API_KEY } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

for (const season of SEASONS) {
  console.log(`\n══════════ season ${season} ══════════`);
  const json = await apiGet(`players?id=${PLAYER_ID}&season=${season}`);
  const stats = json?.response?.[0]?.statistics || [];
  if (!stats.length) { console.log('  (no statistics entries)'); continue; }

  let ratingSum = 0, ratingW = 0;
  for (const s of stats) {
    const league = `${s?.league?.name ?? '—'} (${s?.league?.country ?? '—'}, id=${s?.league?.id ?? '—'}, type=${s?.league?.type ?? '—'})`;
    const team = s?.team?.name ?? '—';
    const mins = s?.games?.minutes ?? 0;
    const apps = s?.games?.appearences ?? 0;
    const rating = s?.games?.rating ?? null;
    console.log(`  ${team.padEnd(20)} ${league}`);
    console.log(`    minutes: ${mins}   appearances: ${apps}   games.rating: ${rating}`);
    const r = parseFloat(rating);
    if (Number.isFinite(r) && mins > 0) { ratingSum += r * mins; ratingW += mins; }
  }
  if (ratingW > 0) {
    console.log(`  ── minutes-weighted average across ALL entries above: ${(ratingSum / ratingW).toFixed(2)} (${ratingW} total minutes) ──`);
  }
}
