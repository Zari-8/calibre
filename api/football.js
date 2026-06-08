// Vercel serverless function — deploy at:  api/football.js
//
// The browser calls /api/football?endpoint=<endpoint>&<params>. This forwards
// the request to API-Football with the secret key attached server-side, so the
// key is never exposed to the client. apiFootball.js reads the x-calibre-*
// response headers this sets.
//
// Required Vercel env var (Project → Settings → Environment Variables):
//   API_FOOTBALL_KEY = your api-sports.io key
//
// Local testing: run `vercel dev` (not `npm run dev`) so this function is served
// alongside the app on the same origin, or set VITE_API_FOOTBALL_KEY in
// .env.local for the direct-call path.

const BASE = 'https://v3.football.api-sports.io';

// Only these endpoints may be proxied (prevents the endpoint param from being
// abused to reach arbitrary upstream paths).
const ALLOWED = new Set([
  'status',
  'fixtures',
  'fixtures/lineups',
  'standings',
  'leagues',
  'teams',
  'players',
  'players/profiles',
  'players/topscorers',
  'players/topassists',
  'transfers',
]);

export default async function handler(req, res) {
  const { endpoint, ...params } = req.query || {};

  if (!endpoint || !ALLOWED.has(String(endpoint))) {
    res.status(400).json({ error: 'Unknown or missing endpoint' });
    return;
  }

  const key = process.env.API_FOOTBALL_KEY;
  if (!key) {
    res.status(500).json({ error: 'API_FOOTBALL_KEY is not configured on the server' });
    return;
  }

  const qs = new URLSearchParams(params).toString();
  const url = `${BASE}/${endpoint}${qs ? `?${qs}` : ''}`;

  try {
    const upstream = await fetch(url, { headers: { 'x-apisports-key': key } });
    const json = await upstream.json();

    // Surface provider quota + source to the client (apiFootball.js reads these).
    res.setHeader('x-calibre-source', 'vercel-bridge');
    res.setHeader('x-calibre-requests-remaining', upstream.headers.get('x-ratelimit-requests-remaining') || '');
    res.setHeader('x-calibre-requests-limit', upstream.headers.get('x-ratelimit-requests-limit') || '');
    // Let Vercel's edge cache identical calls briefly to spare the daily quota.
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

    res.status(upstream.status).json(json);
  } catch (error) {
    res.status(502).json({ error: 'Upstream request failed', detail: String(error?.message || error) });
  }
}
