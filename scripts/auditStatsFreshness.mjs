// scripts/auditStatsFreshness.mjs — READ-ONLY against Supabase. Makes live
// read calls to API-Football (same key every ingestion script uses) to
// re-derive what EVERY tracked stat field should currently read, and diffs
// it against what's stored. No writes anywhere.
//
// WHY: D. Seimen's api_average_rating (7.85 stored) didn't match a fresh
// recompute from the same raw API-Football response (7.33) — see
// inspectRawApiRating.mjs. Zari asked to check whether this is isolated to
// `rating`, or whether goals/assists/minutes/xg/xa/pass_accuracy/tackles/
// etc. carry the same kind of drift. Re-checking the full ~13,900-row
// database against live API-Football would be hundreds/thousands of calls —
// too expensive to run blind. This audits a SAMPLE instead: every player
// this session already flagged as an outlier (highest-stakes, most
// scrutinized) plus N random players spread across rating bands, so we get
// a real read on how widespread this is before deciding whether a full
// re-enrichment sweep is worth the time/API quota.
//
// Usage:
//   node scripts/auditStatsFreshness.mjs                 (default sample)
//   SAMPLE=50 node scripts/auditStatsFreshness.mjs        (bigger random sample)
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

const SAMPLE = Number(process.env.SAMPLE || 20);
// v2 fix: originally tried [2026, 2025] in that order and took whichever
// came back non-empty — but API-Football's season=2026 is the brand-new
// season that had JUST started fixtures at the time of this audit (July
// 2026), so it often returns a tiny, technically-non-empty response (a
// couple of pre-season/early matches) that got wrongly accepted over the
// real, just-completed 2025-26 season (season=2025) — that's what produced
// the "Kane: 43 goals stored vs 11 fresh" false alarms. Now fetch BOTH and
// pick whichever has more total minutes (i.e. the more complete season on
// record), which is robust to calendar differences too (Brazilian clubs
// run Jan-Dec, so their "most complete recent season" isn't always the same
// relative year as a European club's).
const SEASONS = [2025, 2026];

// The named list every top-end investigation tonight actually used, plus
// the two Paderborn GKs (already partially checked, worth confirming with
// the same broader field diff for completeness).
const FLAGGED_NAMES = ['Aleix García', 'D. Szoboszlai', 'Bruno Fernandes', 'C. Romero', 'Carlos Romero', 'H. Kane', 'Kylian Mbappé', 'D. Seimen', 'S. Tangvik'];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchSeason(apiPlayerId, season) {
  const res = await fetch(`${API_HOST}/players?id=${apiPlayerId}&season=${season}`, { headers: { 'x-apisports-key': API_KEY } });
  if (!res.ok) return null;
  const json = await res.json();
  const entry = json.response?.[0];
  if (!entry?.statistics?.length) return null;

  // Minutes-weighted blend across ALL competition entries, same technique
  // enrichPlayerStats.mjs uses for rating/pass_accuracy, extended here to
  // every countable stat so goals/assists/tackles etc get a real diff too.
  // NOTE: xg/xa are NOT reliably present on API-Football's base /players
  // endpoint (they come from TheStatsAPI's separate shotmap enrichment in
  // this codebase — see enrichStatsAPI.mjs) — deliberately not faked or
  // diffed here to avoid printing a misleading always-zero comparison.
  let ratingSum = 0, ratingW = 0, accSum = 0, accW = 0;
  let minutes = 0, goals = 0, assists = 0, tackles = 0, interceptions = 0;
  for (const s of entry.statistics) {
    const m = Number(s.games?.minutes) || 0;
    minutes += m;
    goals += Number(s.goals?.total) || 0;
    assists += Number(s.goals?.assists) || 0;
    tackles += Number(s.tackles?.total) || 0;
    interceptions += Number(s.tackles?.interceptions) || 0;
    const r = parseFloat(s.games?.rating);
    if (Number.isFinite(r) && m > 0) { ratingSum += r * m; ratingW += m; }
    // Mirrors enrichPlayerStats.mjs exactly (was previously just Number(accuracy),
    // which produced a false "drift" alarm on nearly every player — API-Football's
    // passes.accuracy is sometimes a raw completed-pass COUNT, not a %, and this
    // normalization is what the real ingestion pipeline already does about it).
    const accRaw = s.passes?.accuracy;
    if (accRaw != null && m > 0) {
      const total = Number(s.passes?.total) || 0;
      const pct = Number(accRaw) <= 100 ? Number(accRaw) : (total > 0 ? (Number(accRaw) / total) * 100 : null);
      if (pct != null) { accSum += pct * m; accW += m; }
    }
  }
  return {
    season, entries: entry.statistics.length, minutes, goals, assists, tackles, interceptions,
    rating: ratingW > 0 ? Number((ratingSum / ratingW).toFixed(2)) : null,
    pass_accuracy: accW > 0 ? Number((accSum / accW).toFixed(1)) : null,
  };
}

// v2 fix: fetch every season in SEASONS and keep whichever has the MOST
// total minutes (the most complete body of work on record), instead of
// early-exiting on the first technically-non-empty response. season=2026
// (the brand-new campaign, just started as of this audit) was returning
// tiny non-empty responses that beat the real, complete 2025-26 season
// under the old first-match logic — see SEASONS comment above.
async function fetchFresh(apiPlayerId) {
  const results = [];
  for (const season of SEASONS) {
    const r = await fetchSeason(apiPlayerId, season);
    if (r) results.push(r);
  }
  if (!results.length) return null;
  return results.sort((a, b) => b.minutes - a.minutes)[0];
}

function diffLine(label, stored, fresh, tolPct = 0.05) {
  if (stored == null && fresh == null) return null;
  const s = Number(stored), f = Number(fresh);
  if (!Number.isFinite(s) || !Number.isFinite(f)) return `  ${label}: stored=${stored ?? '—'}  fresh=${fresh ?? '—'}`;
  const denom = Math.max(Math.abs(s), Math.abs(f), 1);
  const drift = Math.abs(s - f) / denom;
  const flag = drift > tolPct ? '  ⚠ DRIFT' : '';
  return `  ${label.padEnd(14)} stored=${String(s).padEnd(8)} fresh=${String(f).padEnd(8)}${flag}`;
}

async function auditRow(row) {
  if (!row.api_player_id) { console.log(`${row.name}: no api_player_id, can't audit.`); return; }
  const fresh = await fetchFresh(row.api_player_id);
  console.log(`\n${row.name} (${row.team ?? '—'})  api_player_id=${row.api_player_id}  updated=${row.stats_updated_at ?? '—'}`);
  if (!fresh) { console.log('  (no fresh data returned)'); return; }
  console.log(`  [fresh pull: season=${fresh.season}, ${fresh.entries} competition entries]`);
  const lines = [
    diffLine('rating', row.api_average_rating, fresh.rating),
    diffLine('minutes', row.minutes, fresh.minutes, 0.10),
    diffLine('goals', row.goals, fresh.goals, 0.10),
    diffLine('assists', row.assists, fresh.assists, 0.10),
    diffLine('pass_accuracy', row.pass_accuracy, fresh.pass_accuracy, 0.05),
    diffLine('tackles', row.tackles, fresh.tackles, 0.15),
    diffLine('interceptions', row.interceptions, fresh.interceptions, 0.15),
  ].filter(Boolean);
  for (const l of lines) console.log(l);
}

async function run() {
  console.log('Stats freshness audit (sample) — read-only against Supabase, live reads against API-Football.\n');

  const { data: flagged } = await sb.from('players').select('*').or(FLAGGED_NAMES.map(n => `name.ilike.%${n}%`).join(','));
  const seen = new Set();
  const flaggedRows = [];
  for (const n of FLAGGED_NAMES) {
    const match = (flagged ?? []).filter(r => r.name.toLowerCase().includes(n.toLowerCase().split(' ').pop().toLowerCase()))
      .sort((a, b) => (b.minutes ?? 0) - (a.minutes ?? 0))[0];
    if (match && !seen.has(match.id)) { seen.add(match.id); flaggedRows.push(match); }
  }

  const { data: randomPool } = await sb.from('players').select('*').not('api_player_id', 'is', null).gt('minutes', 900).limit(2000);
  const shuffled = (randomPool ?? []).sort(() => Math.random() - 0.5).slice(0, SAMPLE);

  console.log(`── Flagged reference players (${flaggedRows.length}) ──`);
  for (const row of flaggedRows) { await auditRow(row); await sleep(300); }

  console.log(`\n\n── Random sample (${shuffled.length}, 900+ minutes) ──`);
  for (const row of shuffled) { await auditRow(row); await sleep(300); }

  console.log('\nDone. ⚠ DRIFT flags fields where stored vs a fresh recompute differ by more than the tolerance');
  console.log('(5% for rating/pass_accuracy, 10% for minutes/goals/assists, 15% for tackles/interceptions —');
  console.log('looser tolerances there since raw counting stats are noisier match-to-match).');
}

run().catch(e => { console.error('\nFatal:', e?.message ?? e); process.exit(1); });
