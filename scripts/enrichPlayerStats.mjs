// ─────────────────────────────────────────────────────────────────────────
// Calibre · player-stat enrichment  (API-Football Pro → Supabase)
//
// Pulls player statistics for the current season. If a player has no minutes
// in the current season, it automatically checks the previous season and
// stores those statistics instead. stats_season always records the season
// that actually supplied the saved statistics.
//
// Non-destructive: it does NOT touch goals/assists/api_average_rating you may
// already store — only the event columns + stats metadata.
//
// One player normally costs one API call. A player with no current-season
// minutes costs a second call for the fallback season.
//
//   npm i @supabase/supabase-js          (Node 18+ has global fetch)
//   SUPABASE_URL=...  SUPABASE_SERVICE_ROLE_KEY=...  API_FOOTBALL_KEY=...  \
//   SEASON=2025 FALLBACK_SEASON=2024 node scripts/enrichPlayerStats.mjs
//
// Use the SERVICE ROLE key (server-side secret), NOT the anon key — writes
// need it. Never ship this key to the frontend.
// ─────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';

// ── config ────────────────────────────────────────────────────────────────
const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_KEY       = process.env.API_FOOTBALL_KEY;

const SEASON          = String(process.env.SEASON || '2025'); // 2025 = 2025/26
const FALLBACK_SEASON = String(process.env.FALLBACK_SEASON || (Number(SEASON) - 1));
const MAX_PLAYERS     = Number(process.env.MAX_PLAYERS || 250); // hard cap on players per run
const REFRESH_DAYS    = Number(process.env.REFRESH_DAYS || 7);  // skip rows enriched within this window
const DELAY_MS        = Number(process.env.DELAY_MS || 250);    // pause between calls
const FORCE           = process.env.FORCE === '1';              // ignore freshness check
const NATIONALITY     = process.env.NATIONALITY || null;        // optional: only enrich one nationality
const API_HOST        = 'https://v3.football.api-sports.io';

if (!SUPABASE_URL || !SUPABASE_KEY || !API_KEY) {
  console.error('Missing env: need SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, API_FOOTBALL_KEY');
  process.exit(1);
}

if (!Number.isFinite(Number(SEASON)) || !Number.isFinite(Number(FALLBACK_SEASON))) {
  console.error('SEASON and FALLBACK_SEASON must be numeric API-Football starting years, for example 2025 and 2024.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };

// ── API-Football ──────────────────────────────────────────────────────────
async function fetchPlayer(apiId, season) {
  const url = `${API_HOST}/players?id=${apiId}&season=${season}`;
  const res = await fetch(url, { headers: { 'x-apisports-key': API_KEY } });
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(`API HTTP ${res.status}: ${JSON.stringify(json)}`);
  }
  if (json?.errors && Object.keys(json.errors).length) {
    throw new Error('API: ' + JSON.stringify(json.errors));
  }
  return json?.response?.[0]?.statistics || [];
}

// A player can have several statistics entries in a season (loan, cups, etc.).
// Sum the counting stats; minutes-weight accuracy & rating; take the position
// from the entry with the most minutes.
function aggregate(stats) {
  let minutes = 0, passes = 0, key = 0, dribS = 0, dribA = 0;
  let tackles = 0, inter = 0, duelsWon = 0, shots = 0, goals = 0, assists = 0;
  let accW = 0, accSum = 0, ratingW = 0, ratingSum = 0;
  let pos = null, posMin = -1;

  for (const s of stats) {
    const m = num(s?.games?.minutes);
    minutes += m;
    passes  += num(s?.passes?.total);
    key     += num(s?.passes?.key);
    dribS   += num(s?.dribbles?.success);
    dribA   += num(s?.dribbles?.attempts);
    tackles += num(s?.tackles?.total);
    inter   += num(s?.tackles?.interceptions); // nested under tackles in API-Football
    duelsWon+= num(s?.duels?.won);
    shots   += num(s?.shots?.total);
    goals   += num(s?.goals?.total);
    assists += num(s?.goals?.assists);

    const accRaw = s?.passes?.accuracy; // sometimes %, sometimes a raw count — normalise
    if (accRaw != null && m > 0) {
      const total = num(s?.passes?.total);
      const pct = Number(accRaw) <= 100
        ? Number(accRaw)
        : (total > 0 ? (Number(accRaw) / total) * 100 : null);
      if (pct != null) { accSum += pct * m; accW += m; }
    }

    const r = parseFloat(s?.games?.rating);
    if (Number.isFinite(r) && m > 0) { ratingSum += r * m; ratingW += m; }
    if (m > posMin) { posMin = m; pos = s?.games?.position || pos; }
  }

  return {
    stats_minutes: minutes,
    passes,
    key_passes: key,
    dribbles_success: dribS,
    dribbles_attempts: dribA,
    tackles,
    interceptions: inter,
    duels_won: duelsWon,
    shots,
    pass_accuracy: accW > 0 ? Math.round((accSum / accW) * 10) / 10 : null,
    _rating: ratingW > 0 ? Math.round((ratingSum / ratingW) * 100) / 100 : null, // info only
    _position: pos,
    _goals: goals,
    _assists: assists,
  };
}

async function fetchPlayerWithFallback(apiId) {
  let apiCalls = 1;
  const currentStats = await fetchPlayer(apiId, SEASON);
  const currentAggregate = aggregate(currentStats);

  if (currentAggregate.stats_minutes > 0) {
    return {
      season: SEASON,
      stats: currentStats,
      aggregate: currentAggregate,
      usedFallback: false,
      apiCalls,
    };
  }

  await sleep(DELAY_MS);
  apiCalls++;
  const fallbackStats = await fetchPlayer(apiId, FALLBACK_SEASON);
  const fallbackAggregate = aggregate(fallbackStats);

  return {
    season: fallbackAggregate.stats_minutes > 0 ? FALLBACK_SEASON : null,
    stats: fallbackStats,
    aggregate: fallbackAggregate,
    usedFallback: fallbackAggregate.stats_minutes > 0,
    apiCalls,
  };
}

// ── main ──────────────────────────────────────────────────────────────────
async function main() {
  let select = supabase
    .from('players')
    .select('id, name, api_player_id, stats_updated_at')
    .not('api_player_id', 'is', null);

  if (NATIONALITY) select = select.ilike('nationality', `%${NATIONALITY}%`);

  const { data: rows, error } = await select
    .order('stats_updated_at', { ascending: true, nullsFirst: true })
    .limit(MAX_PLAYERS);

  if (error) {
    console.error('Supabase read failed:', error.message);
    process.exit(1);
  }

  const cutoff = Date.now() - REFRESH_DAYS * 86400000;
  let enriched = 0, fallback = 0, skipped = 0, empty = 0, failed = 0, calls = 0;

  for (const row of rows) {
    if (!FORCE && row.stats_updated_at && new Date(row.stats_updated_at).getTime() > cutoff) {
      skipped++;
      continue;
    }

    try {
      const result = await fetchPlayerWithFallback(row.api_player_id);
      calls += result.apiCalls;

      if (!result.season || result.aggregate.stats_minutes === 0) {
        // Mark attempted so the script does not retry the same empty player every run.
        // stats_season is null because no season supplied usable statistics.
        const { error: emptyErr } = await supabase
          .from('players')
          .update({ stats_season: null, stats_updated_at: new Date().toISOString() })
          .eq('id', row.id);

        if (emptyErr) throw new Error(emptyErr.message);
        empty++;
        console.log(`· ${row.name}: no minutes in ${SEASON} or ${FALLBACK_SEASON}`);
        await sleep(DELAY_MS);
        continue;
      }

      const a = result.aggregate;
      const { error: upErr } = await supabase.from('players').update({
        passes: a.passes,
        pass_accuracy: a.pass_accuracy,
        key_passes: a.key_passes,
        dribbles_success: a.dribbles_success,
        dribbles_attempts: a.dribbles_attempts,
        tackles: a.tackles,
        interceptions: a.interceptions,
        duels_won: a.duels_won,
        shots: a.shots,
        stats_minutes: a.stats_minutes,
        stats_season: result.season,
        stats_updated_at: new Date().toISOString(),
      }).eq('id', row.id);

      if (upErr) throw new Error(upErr.message);

      enriched++;
      if (result.usedFallback) fallback++;

      const source = result.usedFallback ? ` ↩ fallback ${result.season}` : ` ${result.season}`;
      console.log(`✓ ${row.name}:${source} · ${a.stats_minutes}' · ${a.passes}p ${a.pass_accuracy}% · ${a.key_passes}kp · ${a.dribbles_success}drb · ${a.tackles}tkl ${a.interceptions}int · ${a.shots}sh`);
    } catch (e) {
      failed++;
      console.warn(`✗ ${row.name} (${row.api_player_id}): ${e.message}`);
    }

    await sleep(DELAY_MS);
  }

  console.log(`\nDone. enriched=${enriched} fallback=${fallback} skipped=${skipped} no-minutes=${empty} failed=${failed} · api calls=${calls}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
