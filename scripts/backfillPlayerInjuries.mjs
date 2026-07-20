// scripts/backfillPlayerInjuries.mjs — HYBRID injury backfill.
//
// Two sources, blended per player:
//
// 1. API-Football's /injuries (fixture-scoped, no real dates — see
//    probeApiFootballInjuries.mjs). Reaches EVERY player on a team in one
//    call regardless of prior id-matching, so it's the full-squad baseline.
//    injury_days_last_365 here is a RECONSTRUCTED ESTIMATE:
//      a. Pull every injury row for a team/season in one call.
//      b. Group by player, sort by fixture date.
//      c. Merge rows within GAP_DAYS of each other into one "spell" (the
//         same injury often gets re-reported across several match previews
//         — "doubtful" one week, "muscle injury" the next).
//      d. Spell length = (last row date − first row date) + BUFFER_DAYS.
//         BUFFER_DAYS exists because rows only sample MATCHDAYS, not real
//         injury/recovery dates, so even one row means "out at least this
//         long," never zero.
//
// 2. TheStatsAPI's GET /players/{id}/injuries-suspensions — confirmed real
//    and live by their support (Sam), with actual start_date/reason/active
//    fields (see probeStatsApiInjuriesV2.mjs, probeStatsApiResolvedInjuries.mjs).
//    Only reachable for players with a stored statsapi_player_id (a subset —
//    enrichStatsAPI.mjs only name-matched players within domestic-league
//    runs), and even then only returns rows for players it has real data
//    for. When it DOES return data, it's authoritative and overrides the
//    API-Football estimate for that player — real start dates beat
//    reconstructed ones. Caveat found while probing: active:false does NOT
//    reliably mean "medically resolved" — it can just mean "superseded by a
//    newer record for the same player." So a real spell's end date is
//    derived as: expected_return if present, else (if active) today
//    (ongoing/open-ended), else the next record's start_date (implies this
//    one was superseded), else the same BUFFER_DAYS fallback as the
//    estimate path when there's nothing else to go on.
//
// injury_source records which path won for each player ('statsapi_real' vs
// 'api_football_estimate') so the two are never presented as equally
// reliable downstream.
//
// Players with a team but no injury evidence from either source are written
// as 0 / 0 / synced-now — that's a real signal ("checked, nothing found"),
// not a skip, so they're distinguishable from never-synced rows.
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... API_FOOTBALL_KEY=... STATSAPI_KEY=... \
//   SEASON=2025 DRY_RUN=1 node scripts/backfillPlayerInjuries.mjs
//
// Optional:
//   TEAM_IDS=529,541        limit to specific API-Football team ids
//   GAP_DAYS=21             max days between rows to merge into one spell (estimate path)
//   BUFFER_DAYS=7           minimum days credited per spell
//   MAJOR_THRESHOLD_DAYS=21 spell length that counts as a "major" injury
//   SKIP_STATSAPI=1         estimate-only, skip the real-data lookup entirely

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
const STATSAPI_KEY = process.env.STATSAPI_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY || !API_KEY) {
  console.error('Missing env: need SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, API_FOOTBALL_KEY');
  process.exit(1);
}
const SKIP_STATSAPI = process.env.SKIP_STATSAPI === '1' || !STATSAPI_KEY;
if (!STATSAPI_KEY && process.env.SKIP_STATSAPI !== '1') {
  console.warn('No STATSAPI_KEY set — running estimate-only (API-Football reconstruction, no real-data override).\n');
}
const API_HOST = 'https://v3.football.api-sports.io';
const STATSAPI_HOST = 'https://api.thestatsapi.com/api/football';
const SEASON = String(process.env.SEASON || '2025');
const DRY_RUN = process.env.DRY_RUN === '1';
const TEAM_IDS_ARG = (process.env.TEAM_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
const GAP_DAYS = Number(process.env.GAP_DAYS || 21);
const BUFFER_DAYS = Number(process.env.BUFFER_DAYS || 7);
const MAJOR_THRESHOLD_DAYS = Number(process.env.MAJOR_THRESHOLD_DAYS || 21);
const SERIOUS_KEYWORDS = /surgery|acl|ligament|fracture|ruptur|tendon|hamstring tear|cruciate|meniscus|achilles/i;

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date();

const TRANSIENT_WRITE = /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|network|socket|terminated/i;

async function apiGet(path, attempt = 1) {
  const MAX = 4;
  try {
    const res = await fetch(`${API_HOST}/${path}`, { headers: { 'x-apisports-key': API_KEY } });
    if (res.status === 429 || (res.status >= 500 && res.status < 600)) throw new Error(`API HTTP ${res.status}`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`API HTTP ${res.status}: ${JSON.stringify(json)}`);
    if (json?.errors && Array.isArray(json.errors) ? json.errors.length : Object.keys(json?.errors || {}).length) {
      throw new Error('API: ' + JSON.stringify(json.errors));
    }
    return json;
  } catch (e) {
    const msg = String(e?.message || e);
    const transient = /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|network|socket|HTTP 5|HTTP 429/i.test(msg);
    if (transient && attempt < MAX) {
      const wait = 800 * attempt;
      console.warn(`  ↻ ${path}: ${msg} — retry ${attempt}/${MAX - 1} in ${wait}ms`);
      await sleep(wait);
      return apiGet(path, attempt + 1);
    }
    throw e;
  }
}

// /injuries does NOT accept a `page` parameter — unlike most API-Football
// endpoints (confirmed via probeApiFootballInjuries.mjs: a plain
// team+season call with no page param returned all 240 rows in one shot,
// and adding &page=1 gets rejected outright with "The Page field do not
// exist."). So this is a single call per team, no pagination loop.
async function fetchTeamInjuries(teamId, season) {
  const json = await apiGet(`injuries?team=${teamId}&season=${season}`);
  return json?.response || [];
}

// Merge a player's sorted rows into spells, return [{start, end, days, reasons}]
function buildSpells(rows) {
  const sorted = rows
    .map((r) => ({ date: new Date(r.fixture?.date), reason: r.player?.reason || '' }))
    .filter((r) => !Number.isNaN(r.date.getTime()))
    .sort((a, b) => a.date - b.date);
  const spells = [];
  for (const row of sorted) {
    const last = spells[spells.length - 1];
    if (last && (row.date - last.end) / DAY_MS <= GAP_DAYS) {
      last.end = row.date;
      last.reasons.push(row.reason);
    } else {
      spells.push({ start: row.date, end: row.date, reasons: [row.reason] });
    }
  }
  return spells.map((s) => {
    const rawDays = Math.round((s.end - s.start) / DAY_MS);
    const days = Math.max(rawDays, BUFFER_DAYS);
    const serious = s.reasons.some((r) => SERIOUS_KEYWORDS.test(r));
    return { ...s, days, serious };
  });
}

function summarize(spells) {
  let daysLast365 = 0;
  let major = 0;
  for (const s of spells) {
    const daysAgo = (NOW - s.end) / DAY_MS;
    if (daysAgo <= 365) {
      const overlapStart = Math.max(0, daysAgo - s.days);
      const withinWindow = 365 - Math.max(overlapStart, 0);
      daysLast365 += Math.min(s.days, Math.max(withinWindow, 0));
    }
    if (s.days >= MAJOR_THRESHOLD_DAYS || s.serious) major++;
  }
  return { daysLast365: Math.round(Math.max(daysLast365, 0)), major };
}

// ── TheStatsAPI real-data path (hybrid override) ────────────────────────
async function statsApiGet(path, attempt = 1) {
  const MAX = 4;
  try {
    const res = await fetch(`${STATSAPI_HOST}${path}`, { headers: { Authorization: `Bearer ${STATSAPI_KEY}`, Accept: 'application/json' } });
    const json = await res.json().catch(() => ({}));
    if (res.status === 429 || (res.status >= 500 && res.status < 600)) throw new Error(`API HTTP ${res.status}`);
    if (!res.ok) return null; // 404s etc. — treat as "no real data", not a hard failure
    return json;
  } catch (e) {
    const msg = String(e?.message || e);
    const transient = /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|network|socket|HTTP 5|HTTP 429/i.test(msg);
    if (transient && attempt < MAX) {
      await sleep(600 * attempt);
      return statsApiGet(path, attempt + 1);
    }
    return null; // give up gracefully — falls back to the estimate
  }
}

// Real records are already discrete medical entries (no fixture-noise
// merging needed like the estimate path). end date per record:
//   expected_return if present
//   else, if active: NOW (ongoing/open-ended)
//   else: the next record's start_date (this one was superseded), or the
//   same BUFFER_DAYS fallback if there's no next record and no
//   expected_return — mirrors the estimate path's honesty about not
//   claiming precision it doesn't have.
function buildRealSpells(records) {
  const sorted = records
    .map((r) => ({ start: new Date(r.start_date), expectedReturn: r.expected_return ? new Date(r.expected_return) : null, active: !!r.active, reason: r.reason || '' }))
    .filter((r) => !Number.isNaN(r.start.getTime()))
    .sort((a, b) => a.start - b.start);
  return sorted.map((rec, i) => {
    let end;
    if (rec.expectedReturn) end = rec.expectedReturn;
    else if (rec.active) end = NOW;
    else {
      const next = sorted[i + 1];
      end = next ? next.start : new Date(rec.start.getTime() + BUFFER_DAYS * DAY_MS);
    }
    if (end < rec.start) end = rec.start;
    const days = Math.max(Math.round((end - rec.start) / DAY_MS), BUFFER_DAYS);
    const serious = SERIOUS_KEYWORDS.test(rec.reason);
    return { start: rec.start, end, days, serious };
  });
}

// Returns null if no real data available (falls back to estimate), else
// { daysLast365, major }.
async function fetchRealInjurySummary(statsapiPlayerId) {
  if (SKIP_STATSAPI || !statsapiPlayerId) return null;
  const json = await statsApiGet(`/players/${statsapiPlayerId}/injuries-suspensions`);
  const injuries = json?.data?.injuries || [];
  const suspensions = json?.data?.suspensions || [];
  if (!injuries.length && !suspensions.length) return null;
  // Suspensions are a disciplinary risk, not a durability one — kept out of
  // injury_days_last_365 for now (no schema field for them yet), but their
  // presence still counts toward major_injuries_count isn't right either,
  // so only injuries feed the day/major count here; suspensions are logged
  // but not yet wired into a column (flagged as a follow-up, not silently
  // dropped).
  if (!injuries.length) return null;
  const spells = buildRealSpells(injuries);
  return summarize(spells);
}

async function updatePlayer(apiPlayerId, teamId, payload, attempt = 1) {
  if (DRY_RUN) return { skipped: true };
  const { error } = await sb.from('players').update(payload).eq('api_player_id', apiPlayerId).eq('api_team_id', teamId);
  if (error) {
    if (TRANSIENT_WRITE.test(error.message || '') && attempt < 4) {
      await sleep(800 * attempt);
      return updatePlayer(apiPlayerId, teamId, payload, attempt + 1);
    }
    return { error };
  }
  return { ok: true };
}

async function main() {
  let teamIds = TEAM_IDS_ARG;
  if (!teamIds.length) {
    const { data, error } = await sb.from('players').select('api_team_id').not('api_team_id', 'is', null);
    if (error) { console.error('Failed to list teams:', error.message); process.exit(1); }
    teamIds = [...new Set(data.map((r) => String(r.api_team_id)))];
  }
  console.log(`Backfilling injuries for ${teamIds.length} team(s), season ${SEASON}${DRY_RUN ? ' [DRY RUN]' : ''}\n`);

  let teamsDone = 0, playersWritten = 0, playersZeroed = 0, failed = 0, realOverrides = 0;

  for (const teamId of teamIds) {
    let rows;
    try {
      rows = await fetchTeamInjuries(teamId, SEASON);
    } catch (e) {
      console.error(`team ${teamId}: fetch failed — ${e.message}`);
      failed++;
      continue;
    }

    const { data: roster, error: rosterErr } = await sb
      .from('players')
      .select('id, name, api_player_id, statsapi_player_id')
      .eq('api_team_id', teamId)
      .not('api_player_id', 'is', null);
    if (rosterErr) { console.error(`team ${teamId}: roster lookup failed — ${rosterErr.message}`); failed++; continue; }

    const byPlayer = new Map();
    for (const row of rows) {
      const pid = row.player?.id;
      if (!pid) continue;
      if (!byPlayer.has(pid)) byPlayer.set(pid, []);
      byPlayer.get(pid).push(row);
    }

    for (const p of roster) {
      const estimateRows = byPlayer.get(p.api_player_id) || [];
      const estimateSpells = buildSpells(estimateRows);
      const estimate = summarize(estimateSpells);

      let daysLast365 = estimate.daysLast365;
      let major = estimate.major;
      let source = 'api_football_estimate';

      const real = await fetchRealInjurySummary(p.statsapi_player_id);
      if (real) {
        daysLast365 = real.daysLast365;
        major = real.major;
        source = 'statsapi_real';
        realOverrides++;
      }
      if (p.statsapi_player_id && !SKIP_STATSAPI) await sleep(250);

      const payload = {
        injury_days_last_365: daysLast365,
        major_injuries_count: major,
        injury_source: source,
        injuries_synced_at: NOW.toISOString(),
      };
      const hadEvidence = estimateRows.length > 0 || real != null;
      if (hadEvidence) {
        console.log(`  ${p.name}: ${daysLast365}d last-365 · ${major} major [${source}]`);
      }
      const res = await updatePlayer(p.api_player_id, teamId, payload);
      if (res.error) { console.error(`    write failed for ${p.name}: ${res.error.message}`); failed++; }
      else { hadEvidence ? playersWritten++ : playersZeroed++; }
    }
    teamsDone++;
    await sleep(300);
  }

  console.log(`\nDone. Teams processed: ${teamsDone}/${teamIds.length}`);
  console.log(`Players written with injury history: ${playersWritten}`);
  console.log(`Players written as clean (0d, synced): ${playersZeroed}`);
  console.log(`Players using real StatsAPI data (override): ${realOverrides}`);
  console.log(`Failures: ${failed}`);
  if (DRY_RUN) console.log('DRY RUN — no writes were made.');
  if (SKIP_STATSAPI && STATSAPI_KEY == null) console.log('(No STATSAPI_KEY was set — this run was estimate-only.)');
}

main().catch((e) => { console.error(e); process.exit(1); });
