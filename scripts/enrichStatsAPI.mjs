/**
 * enrichStatsAPI.mjs — Calibre × TheStatsAPI match-based enrichment
 *
 * Uses:
 *   /matches?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
 *   /matches/{match_id}/player-stats
 *   /matches/{match_id}/shotmap
 *
 * Run:
 *   DRY_RUN=1 DATE_FROM=2025-08-01 DATE_TO=2025-08-10 node scripts/enrichStatsAPI.mjs
 *   DRY_RUN=1 COMP=comp_3039 DATE_FROM=2025-08-01 DATE_TO=2025-08-10 node scripts/enrichStatsAPI.mjs
 *   COMP=comp_3039 DATE_FROM=2025-08-01 DATE_TO=2025-08-10 node scripts/enrichStatsAPI.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
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
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY;

const DRY_RUN = process.env.DRY_RUN === '1';
const ONLY_COMP = process.env.COMP || null;
const DATE_FROM = process.env.DATE_FROM || process.argv[2] || '2025-08-01';
const DATE_TO = process.env.DATE_TO || process.argv[3] || '2025-08-10';
const DELAY_MS = Number(process.env.DELAY_MS || 500);
// v5 — Supabase disk-IO throttle. writePlayerBatch/writeTeamBatch fire
// sequential .update()/.upsert() calls with zero delay between them (never
// concurrent — each one is awaited before the next starts — but back-to-back
// with no gap at ~217k-265k write attempts across a full-season run, this
// tripped the project's Disk IO budget alert). WRITE_DELAY_MS adds a pause
// between each write; default 200ms is the middle of the requested
// 150-250ms range. Only applied on LIVE runs — DRY_RUN never reaches a real
// write, so delaying it would just slow down the dry run for no reason.
const WRITE_DELAY_MS = Number(process.env.WRITE_DELAY_MS || 200);
const WRITE_RAW = process.env.WRITE_RAW === '1';
const OUT_DIR = join(ROOT, 'tmp-statsapi');
const BASE = 'https://api.thestatsapi.com/api/football';

// v7 — hard timeout on every Supabase call. Found 2026-08-02: a full-season
// RESET_PROGRESS=1 run raced through its first ~6 weeks in moments, then
// went completely silent for 7+ hours — process still alive (`ps` showed
// it), but only 3:35 of accumulated CPU time and zero new log lines the
// entire time. Supabase-js's underlying fetch has no default timeout, and
// none of updatePlayer()'s/findPlayer()'s existing retry logic can ever
// fire on a call that neither resolves nor rejects — a single stalled
// connection (half-open socket, silently dropped packets, whatever) just
// hangs that await forever, and every write behind it in the sequential
// loop waits with it. SUPABASE_TIMEOUT_MS forces every Supabase call to
// fail with a real, catchable error after a bounded wait, so the existing
// TRANSIENT_WRITE / NETWORK_ERR_RE retry paths actually get a chance to run
// instead of never triggering at all.
const SUPABASE_TIMEOUT_MS = Number(process.env.SUPABASE_TIMEOUT_MS || 20000);

function withTimeout(promiseLike, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promiseLike, timeout]).finally(() => clearTimeout(timer));
}

// Shared read-path helper — every Supabase SELECT in this script (findPlayer's
// lookups, the resume-safety bulk seed loads) goes through this instead of a
// bare `await sb.from(...)`. `builderFactory` must be a FUNCTION returning a
// fresh query builder per call, since re-awaiting the same builder object
// doesn't re-issue the request. Retries a few times on the same transient
// network patterns already used for the write path (see NETWORK_ERR_RE
// below) before giving up and letting the error surface to the caller.
async function sbCall(builderFactory, label, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await withTimeout(builderFactory(), SUPABASE_TIMEOUT_MS, label);
    } catch (e) {
      const msg = String(e?.message || e);
      if (NETWORK_ERR_RE.test(msg) && attempt < retries) {
        console.log(`  [${label} timeout/network error, retry ${attempt + 1}/${retries}] ${msg}`);
        await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
        continue;
      }
      throw e;
    }
  }
}

// v3 — auto-resume. A full-season sweep is meant to run in chunks across
// several nights (see main() comment below for why), so re-invoking with
// the same or an overlapping DATE_FROM/DATE_TO shouldn't burn API calls and
// Supabase writes re-doing weeks already saved. Gated to LIVE runs only —
// a DRY_RUN never writes anything real, so it must never advance or even
// look at this file, or a later live run would wrongly believe a
// dry-run-only preview had actually been persisted.
const PROGRESS_FILE = join(ROOT, 'enrichStatsAPI_progress.json');
const RESET_PROGRESS = process.env.RESET_PROGRESS === '1';
const PROGRESS_SCOPE = ONLY_COMP || 'ALL';

function loadProgress() {
  if (!existsSync(PROGRESS_FILE)) return null;
  try { return JSON.parse(readFileSync(PROGRESS_FILE, 'utf8')); } catch { return null; }
}
function saveProgress(lastCompletedDate) {
  writeFileSync(PROGRESS_FILE, JSON.stringify({ scope: PROGRESS_SCOPE, lastCompletedDate, updated_at: new Date().toISOString() }, null, 2));
}

if (!API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing env vars. Need STATSAPI_KEY, SUPABASE_URL/VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const COMPETITIONS = [
  { name: 'Premier League', id: 'comp_3039' },
  { name: 'LaLiga', id: 'comp_8814' },
  { name: 'Bundesliga', id: 'comp_4643' },
  { name: 'Serie A', id: 'comp_5840' },
  { name: 'Ligue 1', id: 'comp_0256' },
  { name: 'Eredivisie', id: 'comp_3809' },
  { name: 'Pro League', id: 'comp_8531' },
  { name: 'Liga Portugal', id: 'comp_8385' },
  { name: 'Brasileirão', id: 'comp_4795' },
  // Phase 2 — next 10, added 2026-07-13. Ids confirmed live via
  // scripts/listStatsAPICompetitions.mjs (149-competition catalog), not
  // guessed. Rounds out the "big five" second tiers plus other globally
  // significant top flights; Saudi Pro League specifically closes the gap
  // that caused the Ruben Neves position-data miss earlier this session.
  { name: 'Championship', id: 'comp_8321' },  // England, 2nd tier
  { name: 'LaLiga 2', id: 'comp_0976' },  // Spain, 2nd tier (Segunda División)
  { name: '2. Bundesliga', id: 'comp_0406' },  // Germany, 2nd tier
  { name: 'Serie B', id: 'comp_5450' },  // Italy, 2nd tier
  { name: 'Ligue 2', id: 'comp_9777' },  // France, 2nd tier
  { name: 'Saudi Pro League', id: 'comp_45025' },
  { name: 'MLS', id: 'comp_9799' },  // USA
  { name: 'Trendyol Süper Lig', id: 'comp_9235' }, // Turkey
  { name: 'Scottish Premiership', id: 'comp_6387' },
  { name: 'Liga Profesional de Fútbol', id: 'comp_4540' }, // Argentina
];

const TARGET_COMP_IDS = new Set(
  ONLY_COMP ? [ONLY_COMP] : COMPETITIONS.map(c => c.id)
);

if (WRITE_RAW) mkdirSync(join(OUT_DIR, 'raw'), { recursive: true });

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
const sleep = ms => new Promise(r => setTimeout(r, ms));

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function round(v, dp = 3) {
  return Number(num(v).toFixed(dp));
}

function rows(json) {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.matches)) return json.matches;
  if (Array.isArray(json?.results)) return json.results;
  return [];
}

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function norm(s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Matches the same TRANSIENT_WRITE pattern already used below for Supabase
// write retries — extended here to the read side. Found 2026-07-30: a plain
// DRY_RUN (just listing matches, the cheapest phase of this script) crashed
// the whole process on a bare ECONNRESET with no HTTP response at all, so
// the 429 handling a few lines down never got a chance to run — fetch()
// itself threw before res existed. A live full-season sweep (thousands of
// matches, hours of runtime) will hit these routinely, not rarely.
const NETWORK_ERR_RE = /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|network|socket|terminated|timed out/i;

// v7 — same hang risk as the Supabase side (see SUPABASE_TIMEOUT_MS comment):
// a stalled TCP connection to TheStatsAPI with no response, no error, ever,
// would hang this fetch forever with nothing in the NETWORK_ERR_RE catch
// block below ever getting a chance to run. AbortController gives a REAL
// cancellation (not just a Promise.race side-step) — the request is
// actually torn down, not left dangling.
const API_TIMEOUT_MS = Number(process.env.API_TIMEOUT_MS || 20000);

async function api(path, attempt = 0) {
  await sleep(DELAY_MS);

  let res;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
  } catch (e) {
    const msg = e?.name === 'AbortError' ? `timed out after ${API_TIMEOUT_MS}ms` : (e?.message || String(e));
    if (NETWORK_ERR_RE.test(msg) && attempt < 5) {
      const wait = [5000, 10000, 20000, 40000, 60000][Math.min(attempt, 4)];
      console.log(`  [network error: ${msg}] retry ${attempt + 1}/5 in ${wait / 1000}s...`);
      await sleep(wait);
      return api(path, attempt + 1);
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }

  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { rawText: text }; }

  if (res.status === 429) {
    const wait = [10000, 20000, 40000, 60000][Math.min(attempt, 3)];
    console.log(`  [429] waiting ${wait / 1000}s...`);
    await sleep(wait);
    return api(path, attempt + 1);
  }

  if (!res.ok) {
    const msg = json?.error?.message || text.slice(0, 300);
    throw new Error(`HTTP ${res.status} — ${path} — ${msg}`);
  }

  if (json.error) throw new Error(json.error.message || JSON.stringify(json.error));
  return json;
}

// v2 — split out of the old fetchMatches(from, to), which used to fetch
// EVERY week in the whole requested range before returning anything. That
// meant main() only ever saw one giant match list at the very end, with no
// natural checkpoint in between — see the main() comment below for why that
// made a multi-hour full-season sweep lose 100% of its work on any crash.
// This fetches ONE week at a time so main() can aggregate+write after each
// window instead of only once at the end.
async function fetchMatchesWindow(cursor, windowEnd) {
  const all = [];
  let page = 1;
  let windowTotal = 0;

  while (true) {
    const compParam = ONLY_COMP ? `&competition_id=${ONLY_COMP}` : '';
    const json = await api(`/matches?date_from=${cursor}&date_to=${windowEnd}${compParam}&page=${page}`);

    const batch = rows(json)
      .filter(m => TARGET_COMP_IDS.has(m.competition_id));

    windowTotal += batch.length;
    all.push(...batch);

    const totalPages = json.meta?.total_pages || 1;
    if (page >= totalPages) break;
    page++;
  }

  console.log(`  ${windowTotal} target matches`);

  const unique = new Map();
  for (const m of all) {
    const id = m.id || m.match_id;
    if (id) unique.set(id, m);
  }

  return [...unique.values()];
}

// touched (optional Set) — v2: records which map keys were created/updated
// during THIS call so main() can write only the players/teams actually
// affected by the current week's matches after each checkpoint, instead of
// re-writing every player accumulated since the start of the whole run.
//
// priorStats (optional Map) — v6, resume-safety. A resumed process starts
// with an EMPTY map: without this, a player touched again after the resume
// point gets rebuilt from zero for the resumed portion only, and since
// buildPlayerUpdate() writes an ABSOLUTE cumulative total (not a delta),
// their next write would silently overwrite the correct pre-crash total
// with a much smaller partial one. priorStats (built by loadPriorStats()
// below, only populated on an actual resume) seeds a NEW map entry from
// whatever's already sitting in Supabase for every field that's actually
// recoverable from a prior write — see loadPriorStats() for exactly which
// fields that covers and which it can't (minutes/goals/assists/appearances
// are tracked here but never themselves written to Supabase, only derived
// per-90 rates and percentages are, so they can't be reconstructed and
// start at 0 for the resumed portion — per-90 rates for a player who spans
// the resume boundary will undercount minutes and read slightly high until
// their next full non-resumed run recomputes them from scratch).
function ensurePlayer(map, playerId, base, touched, priorStats) {
  const key = `${playerId}|${base.competition_id || ''}|${base.season_id || ''}`;
  if (touched) touched.add(key);

  if (!map.has(key)) {
    const seed = priorStats?.get(key);
    map.set(key, {
      statsapi_player_id: playerId,
      player_name: base.player_name || '',
      statsapi_team_id: base.team_id || '',
      team_name: base.team_name || '',
      statsapi_competition_id: base.competition_id || '',
      statsapi_season_id: base.season_id || '',

      // NOT recoverable from Supabase — never written there, only consumed
      // internally to compute per-90 rates / accuracy denominators. Always
      // starts at 0 even on a resume.
      appearances: 0,
      starts: 0,
      stats_minutes: 0,
      saves: 0,
      goals: 0,
      assists: 0,
      big_chances_created: 0,
      duel_won: 0,
      duel_lost: 0,
      challenge_lost: 0,
      fouls: 0,
      offsides: 0,
      yellow_cards: 0,
      red_cards: 0,

      // Recoverable — seeded from the player's current Supabase row on a
      // genuine resume (seed is undefined on a fresh/non-resumed run, so
      // these fall back to their normal 0 default via `?? 0`).
      position_counts: seed?.position_counts || {},

      total_shots: seed?.total_shots ?? 0,
      shots_on_target: seed?.shots_on_target ?? 0,
      shots_off_target: seed?.shots_off_target ?? 0,
      blocked_shots: seed?.blocked_shots ?? 0,

      expected_goals: seed?.expected_goals ?? 0,
      np_expected_goals: seed?.np_expected_goals ?? 0,
      expected_assists: seed?.expected_assists ?? 0,
      shotmap_xg: 0, // only a fallback source for expected_goals — seeding expected_goals directly makes this redundant
      open_play_xg: seed?.open_play_xg ?? 0,
      set_piece_xg: seed?.set_piece_xg ?? 0,
      penalty_xg: seed?.penalty_xg ?? 0,
      headed_xg: seed?.headed_xg ?? 0,
      outside_box_xg: seed?.outside_box_xg ?? 0,

      total_passes: seed?.total_passes ?? 0,
      accurate_passes: seed?.accurate_passes ?? 0,
      key_passes: seed?.key_passes ?? 0,
      total_crosses: seed?.total_crosses ?? 0,
      accurate_crosses: seed?.accurate_crosses ?? 0,
      total_long_balls: seed?.total_long_balls ?? 0,
      accurate_long_balls: seed?.accurate_long_balls ?? 0,

      aerial_won: seed?.aerial_won ?? 0,
      won_contest: seed?.won_contest ?? 0,
      dispossessed: seed?.dispossessed ?? 0,

      tackles: seed?.tackles ?? 0,
      interceptions: seed?.interceptions ?? 0,
      clearances: seed?.clearances ?? 0,

      touches: seed?.touches ?? 0,
      was_fouled: seed?.was_fouled ?? 0,
      possession_lost: seed?.possession_lost ?? 0,
    });
  }

  return map.get(key);
}

function ensureTeam(map, teamId, base, touched, priorStats) {
  const key = `${teamId}|${base.competition_id || ''}|${base.season_id || ''}`;
  if (touched) touched.add(key);

  if (!map.has(key)) {
    // Team side is fully recoverable — every field tracked here is written
    // to team_shot_profiles as-is, no derived-only fields like the player
    // side's minutes/per-90 problem.
    const seed = priorStats?.get(key);
    map.set(key, {
      statsapi_team_id: teamId,
      team_name: base.team_name || '',
      statsapi_competition_id: base.competition_id || '',
      statsapi_season_id: base.season_id || '',
      shots_for: seed?.shots_for ?? 0,
      shots_on_target_for: seed?.shots_on_target_for ?? 0,
      xg_for: seed?.xg_for ?? 0,
      goals_for: seed?.goals_for ?? 0,
      open_play_xg_for: seed?.open_play_xg_for ?? 0,
      set_piece_xg_for: seed?.set_piece_xg_for ?? 0,
      penalty_xg_for: seed?.penalty_xg_for ?? 0,
    });
  }

  return map.get(key);
}

function aggregatePlayerStats(playerAgg, match, json, touched, priorStats) {
  for (const row of rows(json)) {
    const playerId = row.player_id;
    if (!playerId) continue;

    const player = ensurePlayer(playerAgg, playerId, {
      player_name: row.player_name,
      team_id: row.team_id,
      team_name: row.team_name,
      competition_id: match.competition_id,
      season_id: match.season_id,
    }, touched, priorStats);

    const passing = row.passing || {};
    const shooting = row.shooting || {};
    const duels = row.duels || {};
    const defending = row.defending || {};
    const general = row.general || {};
    const goalkeeping = row.goalkeeping || {};

    player.appearances += row.played ? 1 : 0;
    player.starts += row.started ? 1 : 0;
    player.stats_minutes += num(row.minutes_played);

    // Real per-match position code (G/D/M/F) — only tally matches actually
    // played, so an unused bench appearance doesn't count toward the mode.
    if (row.played && row.position) {
      const code = String(row.position).toUpperCase();
      player.position_counts[code] = (player.position_counts[code] || 0) + 1;
    }
    player.saves += num(goalkeeping.saves);

    player.goals += num(shooting.goals);
    player.assists += num(passing.assists);

    player.total_shots += num(shooting.total_shots);
    player.shots_on_target += num(shooting.shots_on_target);
    player.shots_off_target += num(shooting.shots_off_target);
    player.blocked_shots += num(shooting.blocked_shots);

    player.expected_goals += num(shooting.expected_goals);
    player.np_expected_goals += num(shooting.np_expected_goals);
    player.expected_assists += num(shooting.expected_assists);
    player.big_chances_created += num(shooting.big_chances_created);

    player.total_passes += num(passing.total_passes);
    player.accurate_passes += num(passing.accurate_passes);
    player.key_passes += num(passing.key_passes);
    player.total_crosses += num(passing.total_crosses);
    player.accurate_crosses += num(passing.accurate_crosses);
    player.total_long_balls += num(passing.total_long_balls);
    player.accurate_long_balls += num(passing.accurate_long_balls);

    player.duel_won += num(duels.duel_won);
    player.duel_lost += num(duels.duel_lost);
    player.aerial_won += num(duels.aerial_won);
    player.challenge_lost += num(duels.challenge_lost);
    player.won_contest += num(duels.won_contest);
    player.dispossessed += num(duels.dispossessed);

    player.tackles += num(defending.tackles);
    player.interceptions += num(defending.interceptions);
    player.clearances += num(defending.clearances);

    player.touches += num(general.touches);
    player.fouls += num(general.fouls);
    player.was_fouled += num(general.was_fouled);
    player.offsides += num(general.offsides);
    player.yellow_cards += num(general.yellow_cards);
    player.red_cards += num(general.red_cards);
    player.possession_lost += num(general.possession_lost);
  }
}

function shotRows(json) {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.shots)) return json.shots;
  if (Array.isArray(json?.shotmap)) return json.shotmap;
  return [];
}

function aggregateShotmap(playerAgg, teamAgg, match, json, touchedPlayers, touchedTeams, priorPlayerStats, priorTeamStats) {
  for (const shot of shotRows(json)) {
    const playerId = shot.player_id;
    const teamId = shot.team_id;
    const xg = num(shot.expected_goals);
    const situation = String(shot.situation || '').toLowerCase();

    if (playerId) {
      const player = ensurePlayer(playerAgg, playerId, {
        player_name: shot.player_name,
        team_id: shot.team_id,
        team_name: shot.team_name,
        competition_id: match.competition_id,
        season_id: match.season_id,
      }, touchedPlayers, priorPlayerStats);

      player.shotmap_xg += xg;

      if (shot.is_goal) player.goals += 1;
      if (shot.is_on_target || shot.is_goal) player.shots_on_target += 1;

      if (shot.is_penalty) player.penalty_xg += xg;
      else if (situation.includes('corner') || situation.includes('free') || situation.includes('set')) player.set_piece_xg += xg;
      else player.open_play_xg += xg;

      if (shot.is_headed) player.headed_xg += xg;
      if (shot.is_outside_box) player.outside_box_xg += xg;
    }

    if (teamId) {
      const team = ensureTeam(teamAgg, teamId, {
        team_name: shot.team_name,
        competition_id: match.competition_id,
        season_id: match.season_id,
      }, touchedTeams, priorTeamStats);

      team.shots_for += 1;
      team.xg_for += xg;
      if (shot.is_goal) team.goals_for += 1;
      if (shot.is_on_target || shot.is_goal) team.shots_on_target_for += 1;

      if (shot.is_penalty) team.penalty_xg_for += xg;
      else if (situation.includes('corner') || situation.includes('free') || situation.includes('set')) team.set_piece_xg_for += xg;
      else team.open_play_xg_for += xg;
    }
  }
}

const POSITION_WORD = { G: 'Goalkeeper', D: 'Defender', M: 'Midfielder', F: 'Forward' };

// Mode of the per-match position code this player was actually listed under
// (only matches they played, per aggregatePlayerStats). A single-match
// sample is noisy — e.g. a wing-back can get logged D at one club and M at
// another — so this is the code with the most matches, with the full counts
// written alongside for transparency rather than pretending certainty.
function modePosition(counts) {
  const entries = Object.entries(counts || {});
  if (!entries.length) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

function buildPlayerUpdate(player) {
  const minutes = player.stats_minutes || 0;
  const shots = player.total_shots || 0;
  const passes = player.total_passes || 0;
  const crosses = player.total_crosses || 0;
  const longBalls = player.total_long_balls || 0;
  const duels = player.duel_won + player.duel_lost;

  const xg = player.expected_goals > 0 ? player.expected_goals : player.shotmap_xg;
  const npxg = player.np_expected_goals > 0 ? player.np_expected_goals : Math.max(0, xg - player.penalty_xg);

  const per90 = (v) => minutes ? round((v / minutes) * 90) : null;
  const modeCode = modePosition(player.position_counts);

  return {
    // Identity / join keys only. These are safe.
    statsapi_player_id: player.statsapi_player_id,
    statsapi_season_id: player.statsapi_season_id,
    statsapi_competition_id: player.statsapi_competition_id,
    statsapi_enriched_at: new Date().toISOString(),

    // Real per-match position (G/D/M/F, from a source independent of
    // whatever originally populated position/pos/primary_role/raw_position —
    // kept in its own column pending review, not auto-merged into those.
    statsapi_position: modeCode ? POSITION_WORD[modeCode] || modeCode : null,
    statsapi_position_counts: Object.keys(player.position_counts || {}).length ? player.position_counts : null,

    // xG/xA layer. API-Football does not provide this baseline, so these can stay unprefixed.
    xg: round(xg),
    npxg: round(npxg),
    xa: round(player.expected_assists),
    expected_goals: round(xg),
    np_expected_goals: round(npxg),
    expected_assists: round(player.expected_assists),
    open_play_xg: round(player.open_play_xg),
    set_piece_xg: round(player.set_piece_xg),
    penalty_xg: round(player.penalty_xg),
    headed_xg: round(player.headed_xg),
    outside_box_xg: round(player.outside_box_xg),
    xg_per_90: per90(xg),
    xa_per_90: per90(player.expected_assists),
    shot_quality: shots ? round(xg / shots) : null,

    // StatsAPI advanced layer — prefixed so it never overwrites API-Football baseline.
    statsapi_total_shots: player.total_shots || null,
    statsapi_shots_on_target: player.shots_on_target || null,
    statsapi_shots_off_target: player.shots_off_target || null,
    statsapi_blocked_shots: player.blocked_shots || null,
    statsapi_shot_accuracy: shots ? Math.round((player.shots_on_target / shots) * 100) : null,
    statsapi_shots_per90: per90(player.total_shots),

    statsapi_total_passes: player.total_passes || null,
    statsapi_accurate_passes: player.accurate_passes || null,
    statsapi_pass_accuracy: passes ? Math.round((player.accurate_passes / passes) * 100) : null,
    statsapi_passes_per90: per90(player.total_passes),

    statsapi_key_passes: player.key_passes || null,
    statsapi_key_passes_per90: per90(player.key_passes),

    statsapi_total_crosses: player.total_crosses || null,
    statsapi_accurate_crosses: player.accurate_crosses || null,
    statsapi_cross_accuracy: crosses ? Math.round((player.accurate_crosses / crosses) * 100) : null,

    statsapi_total_long_balls: player.total_long_balls || null,
    statsapi_accurate_long_balls: player.accurate_long_balls || null,
    statsapi_long_ball_accuracy: longBalls ? Math.round((player.accurate_long_balls / longBalls) * 100) : null,

    statsapi_ground_duel_win_pct: duels ? Math.round((player.duel_won / duels) * 100) : null,
    // aerial_duels_won, touches, possession_lost: API-Football has NO
    // equivalent field for any of these (it only gives one combined
    // duels.won, and nothing at all for touches/possession-lost), so unlike
    // tackles/interceptions/duels_won/shots there's no collision risk in
    // writing these unprefixed. calibreRating.js already reads all three
    // (aerial_duels_won as a duel-count fallback, touches/possession_lost
    // for touchBonus/lossPenalty) — they were computed correctly this whole
    // time, just published under a name the engine never looked for.
    aerial_duels_won: player.aerial_won || null,
    statsapi_aerial_duels_won: player.aerial_won || null,
    statsapi_aerial_duels_won_per90: per90(player.aerial_won),

    statsapi_successful_dribbles: player.won_contest || null,
    statsapi_successful_dribbles_per90: per90(player.won_contest),

    statsapi_dispossessed: player.dispossessed || null,
    statsapi_dispossessed_per90: per90(player.dispossessed),

    possession_lost: player.possession_lost || null,
    statsapi_possession_lost: player.possession_lost || null,
    statsapi_possession_lost_per90: per90(player.possession_lost),

    touches: player.touches || null,
    statsapi_touches: player.touches || null,
    statsapi_touches_per90: per90(player.touches),

    statsapi_was_fouled: player.was_fouled || null,
    statsapi_was_fouled_per90: per90(player.was_fouled),

    statsapi_tackles: player.tackles || null,
    statsapi_tackles_per90: per90(player.tackles),

    statsapi_interceptions: player.interceptions || null,
    statsapi_interceptions_per90: per90(player.interceptions),

    statsapi_clearances: player.clearances || null,
    statsapi_clearances_per90: per90(player.clearances),

    progressive_carries: null,
    pressures: null,
  };
}

function dropMissingColumn(fields, message) {
  const match = String(message || '').match(/'([^']+)'|"([^"]+)"/);
  const col = match?.[1] || match?.[2];
  if (!col || !(col in fields)) return null;
  const copy = { ...fields };
  delete copy[col];
  return { fields: copy, column: col };
}

const TRANSIENT_WRITE = /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|network|socket|terminated|timed out/i;

async function updatePlayer(rowId, fields) {
  if (DRY_RUN) return { ok: true, dropped: [] };

  let current = { ...fields };
  const dropped = [];
  let transientAttempts = 0;

  for (let i = 0; i < 40; i++) {
    let error;
    try {
      ({ error } = await withTimeout(
        sb.from('players').update(current).eq('id', rowId),
        SUPABASE_TIMEOUT_MS, 'Supabase update(players)'
      ));
    } catch (e) {
      // withTimeout REJECTS (throws) on timeout, unlike Supabase's normal
      // { error } return shape — normalize it into the same shape so the
      // exact same retry logic below (TRANSIENT_WRITE.test) handles it.
      error = e;
    }
    if (!error) return { ok: true, dropped };

    const msg = String(error.message || '');
    const isColumnIssue =
      msg.includes('column') ||
      msg.includes('schema cache') ||
      msg.includes('Could not find');

    if (isColumnIssue) {
      const next = dropMissingColumn(current, msg);
      if (!next) return { ok: false, error, dropped };
      dropped.push(next.column);
      current = next.fields;
      continue;
    }

    // Network-level blips (Cloudflare/Supabase hiccups) are worth a few
    // retries before giving up — this is what silently ate 2 players'
    // stats in the 19-competition live run (Nikolai Soyset Hopland,
    // Maximiliano Puig) since this loop previously only retried on
    // column-schema errors, not transient fetch failures.
    if (TRANSIENT_WRITE.test(msg) && transientAttempts < 4) {
      transientAttempts++;
      await new Promise((r) => setTimeout(r, 800 * transientAttempts));
      continue;
    }

    return { ok: false, error, dropped };
  }

  return { ok: false, error: new Error('Too many missing-column retries'), dropped };
}

const nameCache = new Map();
const statsapiIdCache = new Map();

// Same first/last-name comparison helpers as scripts/reconcileNames.mjs's
// (fixed) findPlayer() — exact token match, or either side abbreviated to
// its initial. NOT substring containment.
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

async function findPlayer({ statsapiPlayerId, playerName }) {
  if (statsapiPlayerId) {
    const key = String(statsapiPlayerId);
    if (statsapiIdCache.has(key)) return statsapiIdCache.get(key);

    const { data } = await sbCall(
      () => sb.from('players').select('id, name, statsapi_player_id').eq('statsapi_player_id', key).limit(1),
      'Supabase select(players by statsapi_id)'
    );

    if (data?.length) {
      statsapiIdCache.set(key, data[0]);
      return data[0];
    }
  }

  const key = norm(playerName);
  if (!key) return null;
  if (nameCache.has(key)) return nameCache.get(key);

  // Strategy 1: exact full-name match (case-insensitive) — safe, requires
  // literal equality.
  let { data } = await sbCall(
    () => sb.from('players').select('id, name, statsapi_player_id').ilike('name', playerName).limit(1),
    'Supabase select(players exact ilike)'
  );

  // Strategy 2 (fallback): the ORIGINAL version here did
  // `.ilike('name', '%${key}%').limit(1)` — a raw substring search across
  // the whole name with NO ranking (arbitrary row order) and NO name-token
  // verification at all. That's the same class of bug fixed in
  // reconcileNames.mjs, but with even less protection (no minutes-based
  // ranking, not even a first-name check). Confirmed as a real, separate
  // corruption source live 2026-07-14 via cross-script audit (e.g. "Ian
  // Struyf" / "Karim Dermane" linked to unrelated "J. Struyf" / "A.
  // Lindermane" rows with no shared first name). Replaced with the same
  // surname-pool + strict first/last token matching used in
  // reconcileNames.mjs's Strategy 0.
  //
  // v4 — accent/hyphen-preserving pool search. `last` above comes from
  // norm(playerName), which strips accents AND hyphens before this ilike
  // ever runs — but Postgres ilike is a literal substring match, not
  // accent-insensitive. A stored row like "Predrag Rajković" or "S.
  // Milinković-Savić" never turns up when searching '%rajkovic%' or
  // '%milinkovicsavic%', because the accent/hyphen characters break the
  // literal substring. Confirmed live 2026-08-01 via
  // scripts/diagnoseNameMatchGap.mjs: adding the RAW (unstripped) last
  // token as a second candidate-pool query dropped a 462-player sample's
  // miss rate from 23.4% to 14.7% (Kanté, Rajković, Milinković-Savić, and
  // other diacritic/hyphenated surnames all recovered) with zero change to
  // the strict first/last-name verification below — this only widens the
  // candidate POOL, the same accept/reject logic still gates the result.
  if (!data?.length) {
    const parts = key.split(' ').filter(Boolean);
    const last = parts[parts.length - 1];
    const first = parts[0];
    const rawParts = String(playerName || '').trim().split(/\s+/).filter(Boolean);
    const rawLast = rawParts[rawParts.length - 1] || '';
    const searchTerms = [...new Set([last, rawLast].filter(s => s && s.length > 2))];

    if (searchTerms.length) {
      let pool = [];
      for (const term of searchTerms) {
        const { data: batch } = await sbCall(
          () => sb.from('players')
            .select('id, name, statsapi_player_id, minutes, api_player_id')
            .ilike('name', `%${term}%`)
            .order('minutes', { ascending: false, nullsFirst: false })
            .limit(25),
          'Supabase select(players surname pool)'
        );
        if (batch?.length) pool.push(...batch);
      }
      pool = [...new Map(pool.map(p => [p.id, p])).values()];

      const narrowed = pool.filter(p => {
        const tokens = norm(p.name).split(' ').filter(Boolean);
        const pFirst = tokens[0] || '';
        const pLast = tokens[tokens.length - 1] || '';
        return lastNameMatches(last, pLast) && firstNameMatches(first, pFirst);
      });
      const best = narrowed
        .filter(p => (p.minutes > 0) || p.api_player_id)
        .sort((a, b) => (b.minutes || 0) - (a.minutes || 0))[0];
      data = best ? [best] : [];
    }
  }

  const row = data?.[0] || null;
  nameCache.set(key, row);
  return row;
}

// v2 — write helpers extracted so main() can call them once per week
// (only for that week's touched keys) instead of once for the whole run.
async function writePlayerBatch(playerAgg, keys, counters, droppedColumns) {
  let idx = 0;
  for (const key of keys) {
    const player = playerAgg.get(key);
    if (!player) continue;
    idx++;
    if (idx % 25 === 0 || idx === 1) {
      console.log(`  writing player ${idx}/${keys.size}: ${player.player_name}`);
    }

    // v7 — this whole per-player body is now wrapped: findPlayer()'s lookups
    // go through sbCall, which retries transient/timeout errors a few times
    // but THROWS once retries are exhausted (see sbCall's comment). Found
    // 2026-08-02 live: that throw wasn't caught anywhere above this loop, so
    // one single player whose lookup kept timing out crashed the ENTIRE
    // multi-hour run (exit 1) instead of just failing that one player. A
    // persistent per-player failure should cost that player, not the run.
    try {
      const row = await findPlayer({
        statsapiPlayerId: player.statsapi_player_id,
        playerName: player.player_name,
      });

      if (!row) {
        counters.noMatch++;
        continue;
      }

      const fields = buildPlayerUpdate(player);
      const result = await updatePlayer(row.id, fields);

      // Disk-IO throttle — pause between writes regardless of outcome (findPlayer
      // lookups above are reads, not writes, so this only paces the .update() calls
      // themselves). Skipped entirely in DRY_RUN since updatePlayer() short-circuits
      // before touching Supabase there.
      if (!DRY_RUN && WRITE_DELAY_MS > 0) await sleep(WRITE_DELAY_MS);

      if (!result.ok) {
        counters.errors++;
        console.error(`  update error ${player.player_name}: ${result.error?.message || result.error}`);
        continue;
      }

      for (const col of result.dropped || []) {
        droppedColumns.set(col, (droppedColumns.get(col) || 0) + 1);
      }

      counters.enriched++;
    } catch (e) {
      counters.errors++;
      console.error(`  lookup/write failed for ${player.player_name}, skipping this player for this checkpoint: ${e?.message || e}`);
      continue;
    }
  }
}

// Persist the team-season shotmap aggregate to team_shot_profiles — this
// used to be computed and immediately discarded. aggregateTeamStats.mjs
// reads it (joined by normalized team name, same pattern as its existing
// team_indices/PPDA join) to blend an open-play xG-share signal into the
// transition axis of derived_team_profiles.
async function writeTeamBatch(teamAgg, keys, counters) {
  if (DRY_RUN || !keys.size) return;
  const teamRows = [...keys]
    .map(k => teamAgg.get(k))
    .filter(Boolean)
    .map(t => ({
      statsapi_team_id: t.statsapi_team_id,
      statsapi_competition_id: t.statsapi_competition_id || '',
      statsapi_season_id: t.statsapi_season_id || '',
      team_name: t.team_name,
      shots_for: t.shots_for,
      shots_on_target_for: t.shots_on_target_for,
      goals_for: t.goals_for,
      xg_for: round(t.xg_for),
      open_play_xg_for: round(t.open_play_xg_for),
      set_piece_xg_for: round(t.set_piece_xg_for),
      penalty_xg_for: round(t.penalty_xg_for),
      updated_at: new Date().toISOString(),
    }));
  for (let i = 0; i < teamRows.length; i += 100) {
    const chunk = teamRows.slice(i, i + 100);
    let error;
    try {
      ({ error } = await sbCall(
        () => sb.from('team_shot_profiles').upsert(chunk, { onConflict: 'statsapi_team_id,statsapi_competition_id,statsapi_season_id' }),
        'Supabase upsert(team_shot_profiles)'
      ));
    } catch (e) {
      error = e;
    }
    if (error) { counters.teamWriteErrors++; console.error('  team_shot_profiles upsert error:', error.message); continue; }
    counters.teamRowsWritten += chunk.length;
    // Same disk-IO throttle as writePlayerBatch — team volume is much smaller
    // (12,183 rows total last run) so this matters less, but keeps every
    // Supabase write path in the script paced consistently.
    if (WRITE_DELAY_MS > 0) await sleep(WRITE_DELAY_MS);
  }
}

// v6 — resume-safety bulk seed. Only called when main() determines this is
// an actual resume (cursor advanced past DATE_FROM from a saved checkpoint),
// never on a fresh/RESET_PROGRESS run — seeding from Supabase on a fresh
// run would double-count on top of a stale PREVIOUS pass's totals instead
// of starting clean. Paginated fetch of every row this script could have
// written to previously (statsapi_player_id not null), keyed identically to
// ensurePlayer()'s map key so a lookup at first-touch is a simple Map.get().
const PLAYER_SEED_PAGE = 1000;

async function loadPriorStats() {
  const seed = new Map();
  let offset = 0;
  console.log('Resume detected — bulk-loading existing statsapi-enriched player rows to seed cumulative totals...');
  while (true) {
    let data, error;
    try {
      ({ data, error } = await sbCall(
        () => sb.from('players')
          .select([
            'statsapi_player_id', 'statsapi_competition_id', 'statsapi_season_id',
            'statsapi_position_counts',
            'total_shots:statsapi_total_shots', 'shots_on_target:statsapi_shots_on_target',
            'shots_off_target:statsapi_shots_off_target', 'blocked_shots:statsapi_blocked_shots',
            'expected_goals', 'np_expected_goals', 'expected_assists',
            'open_play_xg', 'set_piece_xg', 'penalty_xg', 'headed_xg', 'outside_box_xg',
            'total_passes:statsapi_total_passes', 'accurate_passes:statsapi_accurate_passes',
            'key_passes:statsapi_key_passes',
            'total_crosses:statsapi_total_crosses', 'accurate_crosses:statsapi_accurate_crosses',
            'total_long_balls:statsapi_total_long_balls', 'accurate_long_balls:statsapi_accurate_long_balls',
            'aerial_won:statsapi_aerial_duels_won', 'won_contest:statsapi_successful_dribbles',
            'dispossessed:statsapi_dispossessed',
            'tackles:statsapi_tackles', 'interceptions:statsapi_interceptions', 'clearances:statsapi_clearances',
            'touches:statsapi_touches', 'was_fouled:statsapi_was_fouled',
            'possession_lost:statsapi_possession_lost',
          ].join(', '))
          .not('statsapi_player_id', 'is', null)
          .range(offset, offset + PLAYER_SEED_PAGE - 1),
        'Supabase select(players prior-stats seed)'
      ));
    } catch (e) { error = e; }
    if (error) { console.error('  loadPriorStats fetch failed (giving up on further pages, seeding with what was loaded so far):', error.message); break; }
    if (!data?.length) break;
    for (const row of data) {
      const key = `${row.statsapi_player_id}|${row.statsapi_competition_id || ''}|${row.statsapi_season_id || ''}`;
      seed.set(key, row);
    }
    offset += data.length;
    if (data.length < PLAYER_SEED_PAGE) break;
  }
  console.log(`  loaded ${seed.size} existing player rows to seed from.`);
  return seed;
}

async function loadPriorTeamStats() {
  const seed = new Map();
  let offset = 0;
  while (true) {
    let data, error;
    try {
      ({ data, error } = await sbCall(
        () => sb.from('team_shot_profiles')
          .select('statsapi_team_id, statsapi_competition_id, statsapi_season_id, shots_for, shots_on_target_for, xg_for, goals_for, open_play_xg_for, set_piece_xg_for, penalty_xg_for')
          .range(offset, offset + PLAYER_SEED_PAGE - 1),
        'Supabase select(team_shot_profiles prior-stats seed)'
      ));
    } catch (e) { error = e; }
    if (error) { console.error('  loadPriorTeamStats fetch failed (giving up on further pages, seeding with what was loaded so far):', error.message); break; }
    if (!data?.length) break;
    for (const row of data) {
      const key = `${row.statsapi_team_id}|${row.statsapi_competition_id || ''}|${row.statsapi_season_id || ''}`;
      seed.set(key, row);
    }
    offset += data.length;
    if (data.length < PLAYER_SEED_PAGE) break;
  }
  console.log(`  loaded ${seed.size} existing team_shot_profiles rows to seed from.`);
  return seed;
}

async function main() {
  console.log(DRY_RUN ? 'DRY RUN\n' : 'LIVE RUN\n');
  console.log('Date range:', DATE_FROM, '→', DATE_TO);
  if (ONLY_COMP) console.log('Competition:', ONLY_COMP);
  console.log('');

  // v2 — checkpointed per week instead of accumulating the ENTIRE requested
  // date range in memory before writing anything. Found 2026-07-30: a plain
  // DRY_RUN crashed on a bare ECONNRESET partway through just LISTING
  // matches — the cheapest phase of this script (1 call per week). A live
  // full-season run doing 1-2 more API calls per match for HOURS will hit
  // this routinely, and the old structure meant any crash, even 99% of the
  // way through, wrote ZERO rows and burned all the API quota spent getting
  // there. Now: fetch one week, aggregate it into the persistent
  // playerAgg/teamAgg maps (which span the whole run, so cumulative totals
  // stay correct season-to-date), write ONLY the players/teams touched
  // during that week, then move on. A crash after week N only costs
  // whatever wasn't fetched yet — everything through week N is already saved.
  const playerAgg = new Map();
  const teamAgg = new Map();
  const droppedColumns = new Map();
  const counters = {
    playerStatsOk: 0, shotmapOk: 0, matchErrors: 0,
    enriched: 0, noMatch: 0, errors: 0,
    teamRowsWritten: 0, teamWriteErrors: 0,
    totalMatches: 0, totalXgMatches: 0,
  };

  // v3 — auto-resume: skip weeks already completed by a prior LIVE run with
  // the same competition scope. Lets the same DATE_FROM/DATE_TO be reused
  // night after night (or a smaller month-sized range be re-passed if a run
  // gets interrupted) without re-fetching or re-writing anything already
  // saved. Never consulted or advanced during DRY_RUN — see the const
  // comment above for why.
  let cursor = DATE_FROM;
  if (!DRY_RUN && !RESET_PROGRESS) {
    const progress = loadProgress();
    if (progress && progress.scope === PROGRESS_SCOPE && progress.lastCompletedDate >= DATE_FROM) {
      if (progress.lastCompletedDate >= DATE_TO) {
        console.log(`Nothing to do — already completed through ${progress.lastCompletedDate}, which covers the requested range up to ${DATE_TO}.`);
        console.log(`Set RESET_PROGRESS=1 to force a full re-run anyway.`);
        return;
      }
      const resumeCursor = addDays(progress.lastCompletedDate, 1);
      console.log(`Resuming from ${resumeCursor} — already completed through ${progress.lastCompletedDate} per ${PROGRESS_FILE}.`);
      cursor = resumeCursor;
    }
  } else if (RESET_PROGRESS) {
    console.log('RESET_PROGRESS=1 set — ignoring any saved progress, running the full requested range.');
  }

  // v6 — resume-safety: this process's playerAgg/teamAgg maps start empty
  // regardless of where cursor landed. If cursor moved past DATE_FROM (a
  // genuine resume, not a fresh start), bulk-load what's already in Supabase
  // so a player/team touched again later gets its NEW-entry seeded from the
  // real cumulative total instead of silently restarting from zero and
  // overwriting a correct pre-resume value with a partial one. See
  // loadPriorStats()'s comment for exactly what is and isn't recoverable.
  const isResume = cursor !== DATE_FROM;
  const priorPlayerStats = (!DRY_RUN && isResume) ? await loadPriorStats() : null;
  const priorTeamStats = (!DRY_RUN && isResume) ? await loadPriorTeamStats() : null;

  while (cursor <= DATE_TO) {
    const end = addDays(cursor, 6);
    const windowEnd = end > DATE_TO ? DATE_TO : end;

    console.log(`\nFetching matches ${cursor} → ${windowEnd}`);
    const matches = await fetchMatchesWindow(cursor, windowEnd);
    counters.totalMatches += matches.length;
    counters.totalXgMatches += matches.filter(m => m.xg_available).length;

    const touchedPlayers = new Set();
    const touchedTeams = new Set();

    for (const match of matches) {
      const matchId = match.id || match.match_id;
      if (!matchId) continue;

      console.log(`  fetching enrichment for ${matchId}`);

      try {
        const ps = await api(`/matches/${matchId}/player-stats`);
        if (WRITE_RAW) writeFileSync(join(OUT_DIR, 'raw', `${matchId}-player-stats.json`), JSON.stringify(ps, null, 2));
        aggregatePlayerStats(playerAgg, match, ps, touchedPlayers, priorPlayerStats);
        counters.playerStatsOk++;
      } catch (e) {
        counters.matchErrors++;
        console.error(`    player-stats: ${e.message}`);
      }

      if (match.xg_available) {
        try {
          const sm = await api(`/matches/${matchId}/shotmap`);
          if (WRITE_RAW) writeFileSync(join(OUT_DIR, 'raw', `${matchId}-shotmap.json`), JSON.stringify(sm, null, 2));
          aggregateShotmap(playerAgg, teamAgg, match, sm, touchedPlayers, touchedTeams, priorPlayerStats, priorTeamStats);
          counters.shotmapOk++;
        } catch (e) {
          counters.matchErrors++;
          console.error(`    shotmap: ${e.message}`);
        }
      }
    }

    if (touchedPlayers.size || touchedTeams.size) {
      console.log(`  checkpoint: writing ${touchedPlayers.size} players, ${touchedTeams.size} teams touched this window...`);
      await writePlayerBatch(playerAgg, touchedPlayers, counters, droppedColumns);
      await writeTeamBatch(teamAgg, touchedTeams, counters);
    }

    // Mark this week done AFTER its writes complete (not before), so a crash
    // mid-write on this window still resumes from the correct place next
    // time rather than skipping a partially-written week. Never touched
    // during DRY_RUN — no real data was saved, so nothing should be marked
    // as done.
    if (!DRY_RUN) saveProgress(windowEnd);

    cursor = addDays(windowEnd, 1);
  }

  console.log(`\n── Summary ──────────────────`);
  console.log(`Total matches seen : ${counters.totalMatches} (xG available: ${counters.totalXgMatches})`);
  console.log(`player-stats OK    : ${counters.playerStatsOk}`);
  console.log(`shotmap OK         : ${counters.shotmapOk}`);
  console.log(`Match errors       : ${counters.matchErrors}`);
  console.log(`Enriched players   : ${counters.enriched}`);
  console.log(`No Supabase match  : ${counters.noMatch}`);
  console.log(`Update errors      : ${counters.errors}`);
  console.log(`Team rows written  : ${counters.teamRowsWritten}${counters.teamWriteErrors ? `, ${counters.teamWriteErrors} errors` : ''}`);
  console.log(`Dry run            : ${DRY_RUN ? 'yes' : 'no'}`);

  if (droppedColumns.size) {
    console.log('\nMissing columns dropped during update:');
    for (const [col, count] of droppedColumns.entries()) {
      console.log(`  ${col}: ${count}`);
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
