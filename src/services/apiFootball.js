/**
 * Calibre football-data bridge.
 *
 * Production requests go through /api/football so the API-Sports key remains
 * server-side in Vercel. For local-only development, VITE_API_FOOTBALL_KEY can
 * be used as a convenience fallback. Do not commit a real key.
 */

const DIRECT_BASE = 'https://v3.football.api-sports.io';
const LOCAL_KEY = import.meta.env.VITE_API_FOOTBALL_KEY || '';
const IS_LOCAL = ['localhost', '127.0.0.1'].includes(window.location.hostname);

export const LEAGUE_IDS = {
  'Premier League': 39,
  'La Liga': 140,
  'Serie A': 135,
  'Bundesliga': 78,
  'Ligue 1': 61,
  'Eredivisie': 88,
  'Belgian Pro League': 144,
  'Champions League': 2,
  'Europa League': 3,
};

const now = new Date();
export const CURRENT_SEASON = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;

const TTL = {
  fixtures: 90 * 1000,
  status: 10 * 60 * 1000,
  teams: 60 * 60 * 1000,
  players: 60 * 60 * 1000,
  standings: 6 * 60 * 60 * 1000,
  'players/topscorers': 6 * 60 * 60 * 1000,
};

function emitFlow(detail) {
  const payload = { at: new Date().toISOString(), ...detail };
  try { window.localStorage.setItem('calibre:api-flow', JSON.stringify(payload)); } catch {}
  window.dispatchEvent(new CustomEvent('calibre:api-flow', { detail: payload }));
}

function cacheKey(endpoint, params) {
  return `calibre_api_${endpoint}_${new URLSearchParams(params).toString()}`.replace(/[^a-z0-9_]/gi, '_');
}

function getCached(key, ttl) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.ts > ttl) {
      window.localStorage.removeItem(key);
      return null;
    }
    return parsed.data;
  } catch { return null; }
}

function setCached(key, data) {
  try { window.localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); } catch {}
}

async function apiFetch(endpoint, params = {}, options = {}) {
  const ttl = options.ttl ?? TTL[endpoint] ?? 60 * 60 * 1000;
  const key = cacheKey(endpoint, params);
  const cached = options.skipCache ? null : getCached(key, ttl);
  if (cached) {
    emitFlow({ status: 'connected', source: 'browser-cache', endpoint, records: cached?.response?.length ?? 0 });
    return cached;
  }

  const query = new URLSearchParams({ endpoint, ...params });
  const directLocal = IS_LOCAL && LOCAL_KEY;
  const url = directLocal
    ? `${DIRECT_BASE}/${endpoint}${Object.keys(params).length ? `?${new URLSearchParams(params)}` : ''}`
    : `/api/football?${query}`;

  try {
    const response = await fetch(url, {
      headers: directLocal ? { 'x-apisports-key': LOCAL_KEY } : undefined,
    });
    const json = await response.json();
    if (!response.ok || (json.errors && Object.keys(json.errors).length)) {
      emitFlow({ status: 'fallback', source: directLocal ? 'api-football-local' : 'vercel-bridge', endpoint, message: json.error || 'API request failed' });
      return null;
    }
    setCached(key, json);
    emitFlow({
      status: 'connected',
      source: directLocal ? 'api-football-local' : (response.headers.get('x-calibre-source') || 'vercel-bridge'),
      endpoint,
      records: json?.response?.length ?? 0,
      remaining: response.headers.get('x-calibre-requests-remaining') || '',
      limit: response.headers.get('x-calibre-requests-limit') || '',
    });
    return json;
  } catch (error) {
    emitFlow({ status: 'fallback', source: 'network', endpoint, message: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

export async function getFixturesByDate(date) {
  const data = await apiFetch('fixtures', { date }, { ttl: TTL.fixtures });
  return data?.response ?? null;
}

export async function getUpcomingFixtures(leagueId, season = CURRENT_SEASON, next = 1) {
  if (!leagueId) return null;
  const data = await apiFetch('fixtures', { league: leagueId, season, next }, { ttl: TTL.fixtures });
  return data?.response ?? null;
}

export async function getStandings(leagueId, season = CURRENT_SEASON) {
  const data = await apiFetch('standings', { league: leagueId, season });
  return data?.response?.[0]?.league?.standings?.[0] ?? null;
}

export async function getTopScorers(leagueId, season = CURRENT_SEASON) {
  const data = await apiFetch('players/topscorers', { league: leagueId, season });
  return data?.response ?? null;
}

export async function getTeamForm(teamId, last = 5) {
  const data = await apiFetch('fixtures', { team: teamId, last }, { ttl: 15 * 60 * 1000 });
  return data?.response ?? null;
}

export async function getPlayerStats(playerId, season = CURRENT_SEASON) {
  const data = await apiFetch('players', { id: playerId, season });
  return data?.response?.[0] ?? null;
}

export async function getAllLeagueStandings() {
  const results = {};
  const launchLeagues = Object.entries(LEAGUE_IDS).filter(([name]) => !['Champions League', 'Europa League'].includes(name));
  await Promise.all(launchLeagues.map(async ([name, id]) => {
    const standing = await getStandings(id);
    if (standing) results[name] = standing;
  }));
  return results;
}

export async function getAllTopScorers() {
  const results = {};
  const launchLeagues = Object.entries(LEAGUE_IDS).filter(([name]) => !['Champions League', 'Europa League'].includes(name));
  await Promise.all(launchLeagues.map(async ([name, id]) => {
    const scorers = await getTopScorers(id);
    if (scorers?.[0]) results[name] = scorers[0].player.name;
  }));
  return results;
}

export async function searchTeams(query) {
  const search = String(query || '').trim();
  if (search.length < 3) return [];
  const data = await apiFetch('teams', { search });
  return (data?.response ?? []).slice(0, 10).map(({ team, venue }) => ({
    id: team.id,
    name: team.name,
    country: team.country,
    crestUrl: team.logo,
    venue: venue?.name ?? '',
    source: 'api',
  }));
}

export async function searchPlayers(query, season = CURRENT_SEASON, options = {}) {
  const search = String(query || '').trim();
  if (search.length < 3) return [];
  const params = season ? { search, season } : { search };
  const data = await apiFetch('players', params, options);
  return (data?.response ?? []).slice(0, 10).map(({ player, statistics }) => ({
    id: player.id,
    name: player.name,
    age: player.age,
    image: player.photo,
    team: statistics?.[0]?.team?.name ?? '',
    position: statistics?.[0]?.games?.position ?? '',
    source: 'api',
  }));
}

export async function getApiStatus({ force = false } = {}) {
  const data = await apiFetch('status', {}, { ttl: TTL.status, skipCache: force });
  return data?.response ?? null;
}


const PLAYER_PHOTO_TTL = 7 * 24 * 60 * 60 * 1000;
const playerPhotoInflight = new Map();

function photoCacheKey(name) {
  return `calibre_player_photo_v2_${String(name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
}

function readPhotoCache(name) {
  try {
    const raw = window.localStorage.getItem(photoCacheKey(name));
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    if (!parsed?.url || Date.now() - parsed.ts > PLAYER_PHOTO_TTL) {
      window.localStorage.removeItem(photoCacheKey(name));
      return '';
    }
    return parsed.url;
  } catch { return ''; }
}

function writePhotoCache(name, url) {
  if (!url) return;
  try { window.localStorage.setItem(photoCacheKey(name), JSON.stringify({ ts: Date.now(), url })); } catch {}
}

export function clearPlayerPhotoCache(name) {
  try { window.localStorage.removeItem(photoCacheKey(name)); } catch {}
}

function normalisePlayerName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .toLowerCase();
}

function scoreNameMatch(requestedName, candidateName) {
  const requested = normalisePlayerName(requestedName);
  const candidate = normalisePlayerName(candidateName);
  if (!requested || !candidate) return 0;
  if (requested === candidate) return 100;
  if (candidate.includes(requested) || requested.includes(candidate)) return 80;
  const requestedParts = requested.split(' ').filter(Boolean);
  const candidateParts = candidate.split(' ').filter(Boolean);
  return requestedParts.reduce((score, part) => score + (candidateParts.includes(part) ? 12 : 0), 0);
}

/**
 * Resolve a current API-Football player portrait by name.
 * Results are cached in localStorage for seven days and duplicate in-flight
 * requests are collapsed so list views do not burn through the daily quota.
 */
export async function getPlayerPhotoByName(name) {
  const search = String(name || '').trim();
  if (search.length < 3) return '';

  const cached = readPhotoCache(search);
  if (cached) return cached;

  const inflightKey = normalisePlayerName(search);
  if (playerPhotoInflight.has(inflightKey)) return playerPhotoInflight.get(inflightKey);

  const request = (async () => {
    // Bypass stale empty player-search caches during the live-data beta.
    // Most portraits resolve against the current season; the second lookup
    // is a safe fallback for players whose current-season row is unavailable.
    let rows = await searchPlayers(search, CURRENT_SEASON, { skipCache: true, ttl: 5 * 60 * 1000 });
    if (!rows.length) rows = await searchPlayers(search, null, { skipCache: true, ttl: 5 * 60 * 1000 });
    const best = [...rows]
      .filter(row => row.image)
      .sort((a, b) => scoreNameMatch(search, b.name) - scoreNameMatch(search, a.name))[0];
    const url = best?.image || '';
    if (url) writePhotoCache(search, url);
    return url;
  })().finally(() => playerPhotoInflight.delete(inflightKey));

  playerPhotoInflight.set(inflightKey, request);
  return request;
}
