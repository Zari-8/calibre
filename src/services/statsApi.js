// TheStatsAPI (api.thestatsapi.com) client — proxied through api/statsapi.js
// so STATSAPI_KEY never reaches the browser, same pattern as apiFootball.js
// and api/football.js.
//
// This app already calls TheStatsAPI server-side, from the batch enrichment
// scripts in /scripts (enrichStatsAPI.mjs, statsapi-enrich-advanced-season.mjs)
// that populate Supabase's player/team advanced-stat columns feeding the
// Calibre rating engine. The endpoint paths, response envelope, and field
// names below are taken directly from those scripts — not guessed — since
// they're the only place in this codebase that has actually called this API
// successfully. See scripts/enrichStatsAPI.mjs (api(), rows(), aggregatePlayerStats(),
// aggregateShotmap()) and scripts/statsapi-enrich-advanced-season.mjs (pick())
// for the source of truth this mirrors.
//
// Unlike those scripts (season-wide batch jobs), this file is built for one
// thing: pulling ONE specific match's real stats live, for a single featured
// fixture — not a full-season sweep.

async function statsApiFetch(endpoint, params = {}) {
  try {
    const qs = new URLSearchParams({ endpoint, ...params }).toString();
    const res = await fetch(`/api/statsapi?${qs}`);
    if (!res.ok) return null;
    const json = await res.json();
    if (json?.error) return null;
    return json;
  } catch {
    return null;
  }
}

// Same envelope-unwrapping fallback chain as scripts/enrichStatsAPI.mjs's rows().
function rows(json) {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.matches)) return json.matches;
  if (Array.isArray(json?.results)) return json.results;
  return [];
}

// Shotmap responses have been observed nested a couple of different ways —
// same fallback chain scripts/statsapi-enrich-advanced-season.mjs uses.
function shotRows(json) {
  const direct = rows(json);
  if (direct.length) return direct;
  if (Array.isArray(json?.data?.shots)) return json.data.shots;
  if (Array.isArray(json?.shots)) return json.shots;
  if (Array.isArray(json?.shotmap)) return json.shotmap;
  return [];
}

// Reads the first present key from a row — never guesses a value, returns
// null (not 0) when none of the candidate field names exist, so callers can
// tell "genuinely zero" apart from "field not returned by this response".
// Keys may be dot-paths ('shooting.big_chances_created') since the two
// enrichment scripts observed this API returning stats both nested under
// category objects (shooting/passing/duels/defending) and as flat top-level
// fields depending on the call — this checks both without assuming either.
export function pickStat(row, keys) {
  for (const k of keys) {
    const val = k.includes('.') ? k.split('.').reduce((acc, part) => (acc == null ? acc : acc[part]), row) : row?.[k];
    if (val != null) return val;
  }
  return null;
}

// Resolves a competition's StatsAPI id by name (e.g. "World Cup"). The
// club-league ids already hardcoded in scripts/enrichStatsAPI.mjs were
// confirmed once via scripts/listStatsAPICompetitions.mjs and pinned as
// constants — this does the equivalent lookup at request time instead of
// requiring a new hardcoded id for every new competition this page might
// ever want to feature.
export async function findStatsApiCompetitionId(nameQuery) {
  const json = await statsApiFetch('football/competitions', { per_page: 100 });
  const list = rows(json);
  const target = nameQuery.toLowerCase();
  const exact = list.find(c => String(c.name || '').toLowerCase() === target);
  if (exact) return exact.id || exact.competition_id || null;
  const partial = list.find(c => String(c.name || '').toLowerCase().includes(target));
  return partial ? (partial.id || partial.competition_id || null) : null;
}

// Finds one match by date range + the two real team names (matched either
// order, case-insensitively) — narrow enough that it can't cross-contaminate
// with an unrelated fixture the way a broad multi-week/name-substring sweep
// could. Returns null if nothing matches rather than guessing.
export async function findStatsApiMatch(dateFrom, dateTo, homeTeamName, awayTeamName, competitionId) {
  const params = { date_from: dateFrom, date_to: dateTo };
  if (competitionId) params.competition_id = competitionId;
  const json = await statsApiFetch('football/matches', params);
  const list = rows(json);
  const home = homeTeamName.toLowerCase();
  const away = awayTeamName.toLowerCase();
  return list.find(m => {
    const h = String(m.home_team_name || m.home?.name || '').toLowerCase();
    const a = String(m.away_team_name || m.away?.name || '').toLowerCase();
    return (h.includes(home) && a.includes(away)) || (h.includes(away) && a.includes(home));
  }) || null;
}

export async function getStatsApiMatchPlayerStats(matchId) {
  if (!matchId) return [];
  const json = await statsApiFetch('football/matches/player-stats', { matchId });
  return rows(json);
}

export async function getStatsApiMatchShotmap(matchId) {
  if (!matchId) return [];
  const json = await statsApiFetch('football/matches/shotmap', { matchId });
  return shotRows(json);
}

// Team-name attribution for a player-stats or shotmap row — checks both the
// flat `team_name` field and a nested `team.name` object, matching the two
// shapes the enrichment scripts guard against.
export function rowTeamName(row) {
  return String(row?.team_name || row?.team?.name || '').toLowerCase();
}
