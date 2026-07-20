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
  "Women's Champions League": 525,
  "Women's Super League": 44,
  'Liga F': 142,
  'NWSL': 254,
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

// The pop-up's Season tab defaults to CURRENT_SEASON, but CURRENT_SEASON
// flips to the new season on July 1 even though most leagues don't kick off
// again until August — so for roughly six weeks a year (and for any player
// whose league genuinely hasn't started yet) a straight CURRENT_SEASON call
// comes back with zero statistics rows even though last season's real data
// exists one call away. Walk backwards until a season actually has evidence
// (real appearances/minutes), and tag the result with which season it is so
// the UI can label it correctly instead of silently claiming CURRENT_SEASON.
//
// A season can have REAL evidence that's entirely international (World Cup
// qualifiers, a tournament) while the player's actual club season sits one
// year back — e.g. Haaland already has Norway minutes tagged under 2026
// while Man City's 2026/27 hasn't kicked off, so a plain "any evidence"
// check stopped right there and the Season tab showed 7 caps for Norway as
// his whole season, silently hiding a full Premier League campaign one call
// away. When nationalTeamId is supplied, prefer a season with CLUB evidence
// specifically; only fall back to an international-only season if no season
// in the list has club evidence anywhere (better than showing nothing).
export async function getPlayerStatsWithFallback(playerId, seasons = [CURRENT_SEASON, CURRENT_SEASON - 1], nationalTeamId = null) {
  let bestAnyEvidence = null;
  for (const season of seasons) {
    const data = await getPlayerStats(playerId, season);
    const rows = Array.isArray(data?.statistics) ? data.statistics : [];
    const hasRealGames = s => { const g = s?.games; return g && (Number(g.appearences ?? g.appearances) > 0 || Number(g.minutes) > 0); };
    const hasClubEvidence = rows.some(s => hasRealGames(s) && (nationalTeamId == null || Number(s?.team?.id) !== Number(nationalTeamId)));
    if (hasClubEvidence) return { ...data, __season: season };
    if (!bestAnyEvidence && rows.some(hasRealGames)) bestAnyEvidence = { ...data, __season: season };
  }
  return bestAnyEvidence;
}

// Career tab: real season-by-season lines, one API-Football call per season
// (same /players endpoint the Season tab already uses, just walked backwards
// a few years). Runs in parallel and drops any season with no evidence
// (player not at a tracked club / pre-debut / API gap) rather than showing a
// fabricated blank row.
export async function getPlayerCareerSeasons(playerId, seasonsBack = 5) {
  if (!playerId) return [];
  const seasons = Array.from({ length: seasonsBack }, (_, i) => CURRENT_SEASON - i);
  const rows = await Promise.all(seasons.map(season => getPlayerStats(playerId, season).catch(() => null)));
  return seasons
    .map((season, i) => ({ season, data: rows[i] }))
    .filter(row => row.data && Array.isArray(row.data.statistics) && row.data.statistics.some(s => s?.games));
}

// Form tab: last N finished fixtures for a team, then this player's own line
// out of each fixture's player-stats payload (API-Football /fixtures/players
// is fixture-scoped — one call per match, no per-player season shortcut).
// Returns real match ratings only; a fixture where this player didn't
// feature (rest/injury/bench-only) is simply omitted, never zero-filled.
export async function getTeamRecentFixtures(teamId, last = 8) {
  if (!teamId) return [];
  const data = await apiFetch('fixtures', { team: teamId, last, status: 'FT' }, { ttl: 15 * 60 * 1000 });
  return data?.response ?? [];
}

export async function getFixturePlayerMatchStats(fixtureId, apiPlayerId) {
  if (!fixtureId || !apiPlayerId) return null;
  const data = await apiFetch('fixtures/players', { fixture: fixtureId }, { ttl: 60 * 60 * 1000 });
  for (const teamBlock of data?.response ?? []) {
    const hit = (teamBlock.players || []).find(p => Number(p.player?.id) === Number(apiPlayerId));
    if (hit) {
      const s = hit.statistics?.[0] || {};
      return {
        rating: Number.parseFloat(s.games?.rating) || null,
        minutes: Number(s.games?.minutes) || 0,
        goals: Number(s.goals?.total) || 0,
        assists: Number(s.goals?.assists) || 0,
        position: s.games?.position || null,
      };
    }
  }
  return null;
}

// Resolves a player's NATIONAL team id from their nationality (e.g.
// "Norway" -> Norway men's national team), so Form/Days Since Last Match
// aren't blind to international fixtures. API-Football's /teams?search=
// returns both the country's national side and any club sharing the name;
// `team.national === true` is the real discriminator. Cached for 24h via
// apiFetch's normal TTL handling since a country's team id never changes.
export async function getNationalTeamId(nationality) {
  const name = String(nationality || '').trim();
  if (!name) return null;
  const data = await apiFetch('teams', { search: name }, { ttl: 24 * 60 * 60 * 1000 });
  const rows = data?.response ?? [];
  const national = rows.find(r => r.team?.national === true);
  return national?.team?.id ?? null;
}

// Merges club + national-team fixtures by date so a player's "recent form"
// and "days since last match" reflect whichever they actually played most
// recently — a World Cup match doesn't get silently dropped just because it
// wasn't played under the club's team id. Falls back to club-only when no
// national team id is available (curated rows without a resolved
// nationality, or a player with no senior caps on record).
export async function getRecentPlayerForm(teamId, apiPlayerId, last = 8, nationalTeamId = null) {
  const [clubFixtures, ntFixtures] = await Promise.all([
    getTeamRecentFixtures(teamId, last),
    nationalTeamId ? getTeamRecentFixtures(nationalTeamId, last) : Promise.resolve([]),
  ]);

  const tagged = [
    ...clubFixtures.map(fx => ({ fx, refTeamId: teamId })),
    ...ntFixtures.map(fx => ({ fx, refTeamId: nationalTeamId })),
  ]
    .sort((a, b) => new Date(b.fx.fixture?.date || 0) - new Date(a.fx.fixture?.date || 0))
    .slice(0, last * 2); // cap the per-fixture lookup fan-out before we know who actually featured

  const results = await Promise.all(tagged.map(async ({ fx, refTeamId }) => {
    const stats = await getFixturePlayerMatchStats(fx.fixture?.id, apiPlayerId).catch(() => null);
    if (!stats || !stats.minutes) return null; // didn't feature — omit, don't zero-fill
    const home = fx.teams?.home?.id === refTeamId;
    const opponent = home ? fx.teams?.away : fx.teams?.home;
    return {
      date: fx.fixture?.date || null,
      competition: fx.league?.name || '',
      international: refTeamId === nationalTeamId,
      opponentName: opponent?.name || '—',
      opponentLogo: opponent?.logo || '',
      ...stats,
    };
  }));

  return results.filter(Boolean)
    .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0))
    .slice(-last);
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

// Defensive relevance filter for external search results. API-Football's
// search endpoints have been observed returning loosely-matched or outright
// unrelated rows for a query with no real substring match anywhere (e.g. a
// typo like "bernaldo silva" — genuinely not a substring of "Bernardo
// Silva" once the transposed letters are accounted for — came back with
// three unrelated players instead of an honest empty result). Requires at
// least one real query word (3+ chars, so single initials like "B." don't
// force everything to pass) to actually appear as a substring in the
// candidate's name. An honest "no matches" beats a confidently wrong list.
function relevant(query, name) {
  const words = String(query || '').toLowerCase().split(/\s+/).filter(w => w.length >= 3);
  if (!words.length) return true; // nothing meaningful to check against — don't over-filter short/initial-only queries
  const target = String(name || '').toLowerCase();
  return words.some(w => target.includes(w));
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
  })).filter(row => relevant(search, row.name));
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
  })).filter(row => relevant(search, row.name));
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
  }).filter(player => player.id && player.name && relevant(search, player.name));
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

export async function getFixtureEvents(fixtureId) {
  if (!fixtureId) return [];
  const data = await apiFetch('fixtures/events', { fixture:fixtureId }, { ttl:TTL.fixtures });
  return data?.response ?? [];
}

// Model win/draw/win probabilities, advice and side-by-side comparison metrics
// for a single fixture (API-Football /predictions). Returns the first entry or
// null. The matchroom turns this into the on-page "Match signals".
export async function getMatchPredictions(fixtureId) {
  if (!fixtureId) return null;
  const data = await apiFetch('predictions', { fixture:fixtureId }, { ttl: 15 * 60 * 1000 });
  return data?.response?.[0] ?? null;
}

// Bookmaker odds for a fixture (API-Football /odds). Optional secondary signal.
export async function getMatchOdds(fixtureId) {
  if (!fixtureId) return null;
  const data = await apiFetch('odds', { fixture:fixtureId }, { ttl: 15 * 60 * 1000 });
  return data?.response?.[0] ?? null;
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
