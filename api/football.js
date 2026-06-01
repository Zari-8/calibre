const API_BASE = 'https://v3.football.api-sports.io';

const ENDPOINTS = {
  fixtures: ['id', 'date', 'live', 'team', 'league', 'last', 'season', 'next', 'from', 'to', 'timezone'],
  'fixtures/lineups': ['fixture', 'team', 'player', 'type'],
  standings: ['league', 'season', 'team'],
  teams: ['id', 'name', 'league', 'season', 'country', 'code', 'search'],
  players: ['id', 'team', 'league', 'season', 'search', 'page'],
  'players/profiles': ['player', 'search', 'page'],
  'players/topscorers': ['league', 'season'],
  leagues: ['id', 'name', 'country', 'season', 'search', 'type', 'current'],
  transfers: ['player', 'team'],
  status: [],
};

function getCachePolicy(endpoint) {
  if (endpoint === 'fixtures') return 's-maxage=90, stale-while-revalidate=180';
  if (endpoint === 'status') return 'no-store';
  if (endpoint === 'teams' || endpoint === 'players' || endpoint === 'players/profiles' || endpoint === 'leagues') return 's-maxage=3600, stale-while-revalidate=86400';
  return 's-maxage=21600, stale-while-revalidate=86400';
}

function valueOf(input) {
  return Array.isArray(input) ? input[0] : input;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const key = process.env.API_FOOTBALL_KEY;
  if (!key) {
    return res.status(503).json({
      error: 'API bridge not configured',
      hint: 'Add API_FOOTBALL_KEY in Vercel Environment Variables and redeploy.',
    });
  }

  const endpoint = valueOf(req.query.endpoint);
  if (!endpoint || !Object.prototype.hasOwnProperty.call(ENDPOINTS, endpoint)) {
    return res.status(400).json({ error: 'Unsupported API-Football endpoint' });
  }

  const params = new URLSearchParams();
  for (const name of ENDPOINTS[endpoint]) {
    const value = valueOf(req.query[name]);
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      params.set(name, String(value));
    }
  }

  const url = `${API_BASE}/${endpoint}${params.toString() ? `?${params.toString()}` : ''}`;

  try {
    const upstream = await fetch(url, {
      headers: { 'x-apisports-key': key },
    });
    const body = await upstream.json();

    const remaining = upstream.headers.get('x-ratelimit-requests-remaining')
      || upstream.headers.get('x-ratelimit-remaining');
    const limit = upstream.headers.get('x-ratelimit-requests-limit')
      || upstream.headers.get('x-ratelimit-limit');

    res.setHeader('Cache-Control', getCachePolicy(endpoint));
    res.setHeader('X-Calibre-Source', 'api-football');
    res.setHeader('X-Calibre-Endpoint', endpoint);
    if (remaining) res.setHeader('X-Calibre-Requests-Remaining', remaining);
    if (limit) res.setHeader('X-Calibre-Requests-Limit', limit);

    return res.status(upstream.status).json(body);
  } catch (error) {
    return res.status(502).json({
      error: 'API-Football upstream request failed',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
