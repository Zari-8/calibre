// scripts/inspectRawApiRating.mjs — READ-ONLY. No writes to Supabase. Makes
// a live API-Football call (same key every ingestion script uses) but that's
// a read against API-Football, not our DB.
//
// Zari's question on D. Seimen: is api_average_rating=7.85 genuinely a
// season-long average, or is enrichPlayerStats.mjs's ratingSum/ratingW
// blend mixing in something that inflates it? (Sofascore reportedly has him
// at 7.20 for the league specifically, lower for U19 Euro qualifiers.)
// enrichPlayerStats.mjs computes api_average_rating as a MINUTES-WEIGHTED
// average of `s.games.rating` across every `statistics` entry API-Football
// returns for that player+season call — and that response can contain one
// entry PER COMPETITION the player featured in (league, domestic cup,
// continental, international youth duty, etc.), all blended into one number
// with no per-competition breakdown stored back to the DB. This pulls the
// player's api_player_id from our DB, re-fetches the RAW API-Football
// response directly, and prints every competition entry's own
// games.rating/appearances/minutes — so we can see exactly what's being
// averaged into the single number the rating engine trusts.
//
// Usage: NAME="seimen" node scripts/inspectRawApiRating.mjs
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

const NAME = process.env.NAME;
const ID = process.env.ID;
if (!NAME && !ID) { console.error('Set NAME="player name" or ID=<uuid>'); process.exit(1); }

let rows;
if (ID) {
  ({ data: rows } = await sb.from('players').select('*').eq('id', ID));
} else {
  ({ data: rows } = await sb.from('players').select('*').ilike('name', `%${NAME}%`).order('minutes', { ascending: false, nullsFirst: false }));
}
if (!rows?.length) { console.log('No matching row.'); process.exit(0); }
const row = rows[0];
if (rows.length > 1) console.log(`(${rows.length} matches, using ${row.name} / ${row.team} — most minutes)\n`);

if (!row.api_player_id) { console.log(`${row.name} has no api_player_id on record — can't re-fetch raw API-Football data for this row.`); process.exit(0); }

console.log(`${row.name} (${row.team ?? '—'}) — api_player_id=${row.api_player_id}, stored api_average_rating=${row.api_average_rating}\n`);

const seasons = [2026, 2025, 2024]; // current + prior two, in case a player has a thin/injury-hit current season and we need to fall back to a real prior-season sample
for (const season of seasons) {
  const res = await fetch(`${API_HOST}/players?id=${row.api_player_id}&season=${season}`, { headers: { 'x-apisports-key': API_KEY } });
  if (!res.ok) { console.log(`season=${season}: request failed (${res.status})`); continue; }
  const json = await res.json();
  const entry = json.response?.[0];
  if (!entry) { console.log(`season=${season}: no data.`); continue; }

  console.log(`── season=${season} — ${entry.statistics?.length ?? 0} competition entries ──`);
  let ratingSum = 0, ratingW = 0, totalMinutes = 0, totalSaves = 0, totalConceded = 0, hasGk = false;
  for (const s of entry.statistics ?? []) {
    const m = Number(s.games?.minutes) || 0;
    const r = parseFloat(s.games?.rating);
    const league = s.league?.name ?? '—';
    const apps = s.games?.appearences ?? s.games?.appearances ?? '—';
    const saves = s.goals?.saves, conceded = s.goals?.conceded;
    if (saves != null || conceded != null) hasGk = true;
    console.log(`  league="${league}"  rating=${Number.isFinite(r) ? r : '—'}  minutes=${m}  apps=${apps}  saves=${saves ?? '—'}  conceded=${conceded ?? '—'}`);
    if (Number.isFinite(r) && m > 0) { ratingSum += r * m; ratingW += m; }
    totalMinutes += m;
    if (saves != null) totalSaves += Number(saves) || 0;
    if (conceded != null) totalConceded += Number(conceded) || 0;
  }
  const blended = ratingW > 0 ? (ratingSum / ratingW).toFixed(2) : '—';
  console.log(`  -> minutes-weighted blend: rating=${blended}  totalMinutes=${totalMinutes}${hasGk ? `  saves=${totalSaves}  conceded=${totalConceded}` : ''}  (this is what enrichPlayerStats.mjs would compute/store for this season)\n`);
}
