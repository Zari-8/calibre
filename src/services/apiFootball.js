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
  'Europa Conference League': 848,
  'Copa Libertadores': 13,
  'CAF Champions League': 12,
  'Primeira Liga': 94,
  'Brasileirão Série A': 71,
  "Women's Champions League": null,
  "Women's Super League": null,
  'Liga F': null,
  'NWSL': null,
};

const now = new Date();
export const CURRENT_SEASON = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;

const TTL = {
  fixtures: 90 * 1000,
  status: 10 * 60 * 1000,
  teams: 60 * 60 * 1000,
  players: 60 * 60 * 1000,
  'players/profiles': 60 * 60 * 1000,
  standings: 6 * 60 * 60 * 1000,
  'players/topscorers': 6 * 60 * 60 * 1000,
  'fixtures/lineups': 5 * 60 * 1000,
  transfers: 60 * 60 * 1000,
  leagues: 24 * 60 * 60 * 1000,
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

export async function searchLeagues(query, season = CURRENT_SEASON) {
  const search = String(query || '').trim();
  if (search.length < 2) return [];
  const data = await apiFetch('leagues', { search, season }, { ttl: TTL.leagues });
  return (data?.response ?? []).map(({ league, country, seasons }) => ({
    id: league?.id,
    name: league?.name || '',
    type: league?.type || '',
    logo: league?.logo || '',
    country: country?.name || '',
    seasons: seasons || [],
  })).filter(item => item.id && item.name);
}

export async function resolveLeagueId(competition, season = CURRENT_SEASON) {
  if (competition?.id) return competition.id;
  const rows = await searchLeagues(competition?.name || '', season);
  const target = String(competition?.name || '').toLowerCase();
  const exact = rows.find(item => item.name.toLowerCase() === target);
  return (exact || rows[0])?.id || null;
}

export async function getCompetitionPlayers(leagueId, season = CURRENT_SEASON, pages = 2) {
  if (!leagueId) return [];
  const pageNumbers = Array.from({ length: Math.max(1, Math.min(3, pages)) }, (_, index) => index + 1);
  const payloads = await Promise.all(pageNumbers.map(page => apiFetch('players', { league: leagueId, season, page }, { ttl: 6 * 60 * 60 * 1000 })));
  return payloads.flatMap(data => data?.response ?? []);
}

export async function getTopCreators(leagueId, season = CURRENT_SEASON, limit = 5) {
  if (!leagueId) return [];

  let endpointRows = [];

  try {
    const data = await apiFetch('players/topassists', {
      league: leagueId,
      season,
    });

    endpointRows = (data?.response || []).map(row => {
      const stats = row.statistics?.[0] || {};
      return {
        player: row.player || {},
        team: stats.team?.name || '—',
        assists: Number(stats.goals?.assists || 0),
        img: row.player?.photo || '',
      };
    });
  } catch (error) {
    console.warn('Top-assists endpoint unavailable. Falling back to competition player rows.', error);
  }

  const competitionRows = endpointRows.length >= limit
    ? []
    : (await getCompetitionPlayers(leagueId, season, 3)).map(row => {
        const stats = row.statistics?.[0] || {};
        return {
          player: row.player || {},
          team: stats.team?.name || '—',
          assists: Number(stats.goals?.assists || 0),
          img: row.player?.photo || '',
        };
      });

  const merged = new Map();

  [...endpointRows, ...competitionRows].forEach(row => {
    if (!row.player?.name || row.assists <= 0) return;
    const key = row.player?.id || String(row.player.name).toLowerCase();
    const existing = merged.get(key);
    if (!existing || row.assists > existing.assists) merged.set(key, row);
  });

  return [...merged.values()]
    .sort((a, b) => b.assists - a.assists)
    .slice(0, limit);
}

export async function getRecentFixtures(leagueId, season = CURRENT_SEASON, last = 1) {
  if (!leagueId) return null;
  const data = await apiFetch('fixtures', { league: leagueId, season, last }, { ttl: TTL.fixtures });
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


export function playerPhotoUrl(playerId) {
  return playerId ? `https://media.api-sports.io/football/players/${playerId}.png` : '';
}

/**
 * Search the API-Football profile directory. Unlike the season-statistics
 * endpoint, /players/profiles is intended for global player discovery and
 * returns a stable player id that can be used for the official media URL.
 */
export async function searchPlayerProfiles(query, options = {}) {
  const search = String(query || '').trim();
  if (search.length < 3) return [];
  const data = await apiFetch('players/profiles', { search }, options);
  return (data?.response ?? []).slice(0, 25).map((row) => {
    const player = row?.player ?? row ?? {};
    return {
      id: player.id,
      name: player.name || [player.firstname, player.lastname].filter(Boolean).join(' '),
      firstname: player.firstname || '',
      lastname: player.lastname || '',
      age: player.age ?? '',
      nationality: player.nationality || player.birth?.country || '',
      birth: player.birth || {},
      height: player.height || '',
      weight: player.weight || '',
      position: player.position || '',
      image: player.photo || playerPhotoUrl(player.id),
      source: 'api-profile',
    };
  }).filter(player => player.id && player.name);
}

export async function getPlayerProfile(playerId) {
  if (!playerId) return null;
  const data = await apiFetch('players/profiles', { player: playerId });
  const row = data?.response?.[0];
  if (!row) return null;
  const player = row?.player ?? row;
  return {
    id: player.id,
    name: player.name || [player.firstname, player.lastname].filter(Boolean).join(' '),
    firstname: player.firstname || '',
    lastname: player.lastname || '',
    age: player.age ?? '',
    nationality: player.nationality || player.birth?.country || '',
    birth: player.birth || {},
    height: player.height || '',
    weight: player.weight || '',
    position: player.position || '',
    image: player.photo || playerPhotoUrl(player.id),
    source: 'api-profile',
  };
}

export async function getApiStatus({ force = false } = {}) {
  const data = await apiFetch('status', {}, { ttl: TTL.status, skipCache: force });
  return data?.response ?? null;
}



export function leagueLogoUrl(leagueId) {
  return leagueId ? `https://media.api-sports.io/football/leagues/${leagueId}.png` : '';
}

export function teamLogoUrl(teamId) {
  return teamId ? `https://media.api-sports.io/football/teams/${teamId}.png` : '';
}

export async function getTeamsByLeague(leagueId, season = CURRENT_SEASON) {
  if (!leagueId) return [];
  const data = await apiFetch('teams', { league: leagueId, season });
  return (data?.response ?? []).map(({ team, venue }) => ({
    id: team?.id, name: team?.name || '', country: team?.country || '', crestUrl: team?.logo || teamLogoUrl(team?.id),
    code: team?.code || '', venue: venue?.name || '', source:'api',
  })).filter(team => team.id && team.name);
}

export async function getLeaguePlayers(leagueId, season = CURRENT_SEASON, page = 1) {
  if (!leagueId) return [];
  const data = await apiFetch('players', { league: leagueId, season, page }, { ttl: 60 * 60 * 1000 });
  return (data?.response ?? []).map(({ player, statistics }) => {
    const stat = statistics?.[0] || {};
    return {
      id:player?.id, name:player?.name || '', age:player?.age ?? '', image:player?.photo || playerPhotoUrl(player?.id),
      nationality:player?.nationality || '', team:stat?.team?.name || '', teamId:stat?.team?.id || null, teamLogo:stat?.team?.logo || teamLogoUrl(stat?.team?.id),
      position:stat?.games?.position || player?.position || '', appearances:stat?.games?.appearences ?? stat?.games?.appearances ?? 0,
      starts:stat?.games?.lineups ?? 0, minutes:stat?.games?.minutes ?? 0, apiAverageRating:Number.parseFloat(stat?.games?.rating || 0) || null,
      api_average_rating:Number.parseFloat(stat?.games?.rating || 0) || null,
      goals:stat?.goals?.total ?? 0, assists:stat?.goals?.assists ?? 0, passes:stat?.passes?.total ?? 0, keyPasses:stat?.passes?.key ?? 0,
      passAccuracy:stat?.passes?.accuracy ?? null, duelsWon:stat?.duels?.won ?? 0, tackles:stat?.tackles?.total ?? 0, interceptions:stat?.tackles?.interceptions ?? 0,
      source:'api-stats', statistics:stat,
    };
  }).filter(player => player.id && player.name);
}

export async function getFixtureLineups(fixtureId) {
  if (!fixtureId) return [];
  const data = await apiFetch('fixtures/lineups', { fixture:fixtureId }, { ttl:TTL['fixtures/lineups'] });
  return data?.response ?? [];
}

export async function getTransfersForPlayer(playerId) {
  if (!playerId) return [];
  const data = await apiFetch('transfers', { player:playerId }, { ttl:TTL.transfers });
  return data?.response ?? [];
}

const PLAYER_PHOTO_TTL = 7 * 24 * 60 * 60 * 1000;
const playerPhotoInflight = new Map();

function photoCacheKey(name) {
  return `calibre_player_photo_v3_${String(name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
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
    // Use the global profile directory for portraits. The statistics endpoint
    // only covers players attached to a specific season and was the reason
    // some homepage cards remained stuck on local placeholder artwork.
    const profileRows = await searchPlayerProfiles(search, { skipCache: true, ttl: 5 * 60 * 1000 });
    const statRows = profileRows.length
      ? []
      : await searchPlayers(search, CURRENT_SEASON, { skipCache: true, ttl: 5 * 60 * 1000 });

    const best = [...profileRows, ...statRows]
      .filter(row => row.image)
      .sort((a, b) => scoreNameMatch(search, b.name) - scoreNameMatch(search, a.name))[0];

    const url = best?.image || '';
    if (url) writePhotoCache(search, url);
    return url;
  })().finally(() => playerPhotoInflight.delete(inflightKey));

  playerPhotoInflight.set(inflightKey, request);
  return request;
}
