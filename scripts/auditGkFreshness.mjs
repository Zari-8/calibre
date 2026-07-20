// scripts/auditGkFreshness.mjs — READ-ONLY against Supabase, live reads
// against API-Football. No writes.
//
// WHY: the GK production fix (minutes-trust ramp, apiR weight capped at
// 70% instead of 90%) reduces how much any ONE stale/thin apiR number can
// distort a GK's rating, but it doesn't find or fix rows where the
// UNDERLYING stored apiR/minutes/saves/goals_conceded are themselves stale
// — exactly the class of bug found for D. Seimen (7.85 stored vs 7.33 fresh,
// because his early-season sample was never refreshed as it grew). Zari
// asked to check whether other GKs have the same issue before pushing.
//
// This audits EVERY GK-bucket row currently rated >=80 by the new engine
// (i.e. every GK where staleness could plausibly be inflating a
// medium-to-high rating), re-deriving apiR/minutes/saves/conceded from a
// live API-Football pull the same way auditStatsFreshness.mjs does for
// outfield stats, extended here with the two GK-specific fields
// (goals.saves / goals.conceded) that script didn't need.
//
// Run: node scripts/auditGkFreshness.mjs
//      MIN_RATING=75 node scripts/auditGkFreshness.mjs   (widen the net)
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { calibreRating as calibreRatingNEW, positionBucket } from '../src/services/calibreRating.js';

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

const MIN_RATING = Number(process.env.MIN_RATING || 80);
const SEASONS = [2025, 2026]; // same order/logic as auditStatsFreshness.mjs — 2026 is a barely-started season as of July 2026, so we keep whichever has more minutes, not whichever responds first.
const PAGE = 500;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchAllPlayers() {
  const rows = [];
  let offset = 0;
  while (true) {
    const { data, error } = await sb
      .from('players')
      .select('*')
      .or('minutes.gt.0,appearances.gt.0,api_average_rating.gt.0')
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

async function fetchSeason(apiPlayerId, season) {
  const res = await fetch(`${API_HOST}/players?id=${apiPlayerId}&season=${season}`, { headers: { 'x-apisports-key': API_KEY } });
  if (!res.ok) return null;
  const json = await res.json();
  const entry = json.response?.[0];
  if (!entry?.statistics?.length) return null;

  let ratingSum = 0, ratingW = 0;
  let minutes = 0, saves = 0, conceded = 0, hasGkFields = false;
  for (const s of entry.statistics) {
    const m = Number(s.games?.minutes) || 0;
    minutes += m;
    if (s.goals?.saves != null) { saves += Number(s.goals.saves) || 0; hasGkFields = true; }
    if (s.goals?.conceded != null) { conceded += Number(s.goals.conceded) || 0; hasGkFields = true; }
    const r = parseFloat(s.games?.rating);
    if (Number.isFinite(r) && m > 0) { ratingSum += r * m; ratingW += m; }
  }
  return {
    season, entries: entry.statistics.length, minutes,
    saves: hasGkFields ? saves : null, conceded: hasGkFields ? conceded : null,
    rating: ratingW > 0 ? Number((ratingSum / ratingW).toFixed(2)) : null,
  };
}

async function fetchFresh(apiPlayerId) {
  const results = [];
  for (const season of SEASONS) {
    const r = await fetchSeason(apiPlayerId, season);
    if (r) results.push(r);
  }
  if (!results.length) return null;
  return results.sort((a, b) => b.minutes - a.minutes)[0];
}

function drift(label, stored, fresh, tolPct) {
  const s = Number(stored), f = Number(fresh);
  if (!Number.isFinite(s) || !Number.isFinite(f)) {
    if (stored == null && fresh == null) return null;
    return { label, stored: stored ?? '—', fresh: fresh ?? '—', flagged: stored == null || fresh == null };
  }
  const denom = Math.max(Math.abs(s), Math.abs(f), 1);
  const d = Math.abs(s - f) / denom;
  return { label, stored: s, fresh: f, flagged: d > tolPct };
}

async function run() {
  console.log(`GK freshness audit (rating >= ${MIN_RATING}) — read-only against Supabase, live reads against API-Football.\n`);
  const rows = await fetchAllPlayers();
  const gks = rows.filter(r => positionBucket(r) === 'GK' && r.api_player_id);

  const scored = [];
  for (const r of gks) {
    let res;
    try { res = calibreRatingNEW(r); } catch { continue; }
    if (!res || !Number.isFinite(res.rating)) continue;
    if (res.rating < MIN_RATING) continue;
    scored.push({ row: r, rating: res.rating });
  }
  scored.sort((a, b) => b.rating - a.rating);
  console.log(`${gks.length} GK-bucket rows total; ${scored.length} rated >=${MIN_RATING} under the new engine — auditing all of them.\n`);

  let flaggedCount = 0;
  for (const { row, rating } of scored) {
    const fresh = await fetchFresh(row.api_player_id);
    await sleep(300);
    if (!fresh) {
      console.log(`${String(rating).padEnd(4)} ${row.name.padEnd(22)} ${String(row.team ?? '—').padEnd(20)} — no fresh data returned, could not check.`);
      continue;
    }
    const checks = [
      drift('rating', row.api_average_rating, fresh.rating, 0.05),
      drift('minutes', row.minutes, fresh.minutes, 0.10),
      drift('saves', row.saves, fresh.saves, 0.10),
      drift('conceded', row.goals_conceded, fresh.conceded, 0.10),
    ].filter(Boolean);
    const anyFlag = checks.some(c => c.flagged);
    if (anyFlag) flaggedCount++;
    const flag = anyFlag ? '⚠ DRIFT' : 'ok';
    console.log(`${String(rating).padEnd(4)} ${row.name.padEnd(22)} ${String(row.team ?? '—').padEnd(20)} [${flag}] (fresh season=${fresh.season}, ${fresh.entries} entries)`);
    if (anyFlag) {
      for (const c of checks.filter(c => c.flagged)) {
        console.log(`      ${c.label.padEnd(10)} stored=${c.stored}  fresh=${c.fresh}`);
      }
    }
  }

  console.log(`\nDone. ${flaggedCount}/${scored.length} GKs rated >=${MIN_RATING} have a stale field (rating/minutes/saves/conceded drift beyond tolerance).`);
  console.log('Any flagged here is a candidate for a live enrichPlayerStats.mjs re-run (bookmarked full sweep covers this).');
}

run().catch(e => { console.error('\nFatal:', e?.message ?? e); process.exit(1); });
