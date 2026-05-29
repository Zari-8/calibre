/**
 * API Football v3 service
 * Base: https://v3.football.api-sports.io/
 * Auth: x-apisports-key header
 * Free plan: 100 req/day — ALL calls are cached in localStorage (6h TTL)
 *
 * Key is read from VITE_API_FOOTBALL_KEY env var.
 * Create a .env file in project root:
 *   VITE_API_FOOTBALL_KEY=your_key_here
 */

const BASE = 'https://v3.football.api-sports.io';
const KEY  = import.meta.env.VITE_API_FOOTBALL_KEY || '';
const TTL  = 6 * 60 * 60 * 1000; // 6 hours in ms

// League IDs for the five major leagues
export const LEAGUE_IDS = {
  'Premier League': 39,
  'La Liga':        140,
  'Serie A':        135,
  'Bundesliga':     78,
  'Ligue 1':        61,
};

export const CURRENT_SEASON = 2024;

// ── Cache helpers ────────────────────────────────────────────────
function cacheKey(url) {
  return `calibre_api_${url.replace(/[^a-z0-9]/gi, '_')}`;
}

function getCached(url) {
  try {
    const raw = localStorage.getItem(cacheKey(url));
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > TTL) { localStorage.removeItem(cacheKey(url)); return null; }
    return data;
  } catch { return null; }
}

function setCache(url, data) {
  try { localStorage.setItem(cacheKey(url), JSON.stringify({ ts: Date.now(), data })); }
  catch { /* storage full — ignore */ }
}

// ── Core fetch ───────────────────────────────────────────────────
async function apiFetch(endpoint) {
  const url = `${BASE}${endpoint}`;
  const cached = getCached(url);
  if (cached) return cached;

  if (!KEY) {
    console.warn('[API Football] No API key set. Add VITE_API_FOOTBALL_KEY to .env');
    return null;
  }

  try {
    const res = await fetch(url, {
      headers: { 'x-apisports-key': KEY },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.errors && Object.keys(json.errors).length) {
      console.warn('[API Football] API error:', json.errors);
      return null;
    }
    setCache(url, json);
    return json;
  } catch (e) {
    console.error('[API Football] Fetch error:', e.message);
    return null;
  }
}

// ── Public API ───────────────────────────────────────────────────

/** Fetch standings for a league (includes last-5 form) */
export async function getStandings(leagueId, season = CURRENT_SEASON) {
  const data = await apiFetch(`/standings?league=${leagueId}&season=${season}`);
  return data?.response?.[0]?.league?.standings?.[0] ?? null;
}

/** Fetch top scorers for a league */
export async function getTopScorers(leagueId, season = CURRENT_SEASON) {
  const data = await apiFetch(`/players/topscorers?league=${leagueId}&season=${season}`);
  return data?.response ?? null;
}

/** Fetch last N fixtures for a team */
export async function getTeamForm(teamId, last = 5) {
  const data = await apiFetch(`/fixtures?team=${teamId}&last=${last}`);
  return data?.response ?? null;
}

/** Fetch player stats (for battle algorithm) */
export async function getPlayerStats(playerId, season = CURRENT_SEASON) {
  const data = await apiFetch(`/players?id=${playerId}&season=${season}`);
  return data?.response?.[0] ?? null;
}

/**
 * Fetch standings for ALL major leagues — batches 5 calls.
 * Returns a map: { 'Premier League': [...standings], ... }
 */
export async function getAllLeagueStandings() {
  const results = {};
  await Promise.all(
    Object.entries(LEAGUE_IDS).map(async ([name, id]) => {
      const standing = await getStandings(id);
      if (standing) results[name] = standing;
    })
  );
  return results;
}

/**
 * Fetch top scorers for ALL major leagues.
 * Returns a map: { 'Premier League': player_name, ... }
 */
export async function getAllTopScorers() {
  const results = {};
  await Promise.all(
    Object.entries(LEAGUE_IDS).map(async ([name, id]) => {
      const scorers = await getTopScorers(id);
      if (scorers?.[0]) {
        results[name] = scorers[0].player.name;
      }
    })
  );
  return results;
}

/** Remaining requests today (from cache-busted status endpoint) */
export async function getApiStatus() {
  const data = await apiFetch('/status');
  return data?.response ?? null;
}
