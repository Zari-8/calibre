// Vercel serverless function — deploy at:  api/statsapi.js
//
// Proxies TheStatsAPI (api.thestatsapi.com) the same way api/football.js
// proxies API-Football — the browser calls /api/statsapi?endpoint=<endpoint>
// and this forwards the request with the secret key attached server-side, so
// STATSAPI_KEY is never exposed to the client.
//
// This app already uses TheStatsAPI server-side, via the batch enrichment
// scripts in /scripts (enrichStatsAPI.mjs, statsapi-enrich-advanced-season.mjs)
// that populate Supabase player/team advanced-stat columns — those run with
// STATSAPI_KEY read directly from the local shell environment, never through
// this proxy. This file exists for the NEW use case: a single browser page
// (the World Cup Featured Match card) fetching one specific match's real
// xG / big chances / progressive passes live, rather than a season-wide
// batch job. Same key, new code path.
//
// Required Vercel env var (Project → Settings → Environment Variables):
//   STATSAPI_KEY = your thestatsapi.com key (same one scripts/.env* already use)
//
// matchId-scoped endpoints (player-stats, shotmap) take the id via a
// `matchId` query param rather than embedding it in `endpoint`, since Vercel
// query params can't carry a `/` — this handler builds the real upstream
// path from the two.

const BASE = 'https://api.thestatsapi.com/api';

// Only these endpoints may be proxied (prevents the endpoint param from being
// abused to reach arbitrary upstream paths).
const ALLOWED = new Set([
  'football/competitions',
  'football/matches',
  'football/matches/player-stats',
  'football/matches/shotmap',
]);

export default async function handler(req, res) {
  const { endpoint, matchId, ...params } = req.query || {};

  if (!endpoint || !ALLOWED.has(String(endpoint))) {
    res.status(400).json({ error: 'Unknown or missing endpoint' });
    return;
  }

  const key = process.env.STATSAPI_KEY;
  if (!key) {
    res.status(500).json({ error: 'STATSAPI_KEY is not configured on the server' });
    return;
  }

  let path = `/${endpoint}`;
  if (endpoint === 'football/matches/player-stats' || endpoint === 'football/matches/shotmap') {
    if (!matchId) {
      res.status(400).json({ error: 'matchId is required for this endpoint' });
      return;
    }
    const suffix = endpoint.endsWith('player-stats') ? 'player-stats' : 'shotmap';
    path = `/football/matches/${encodeURIComponent(String(matchId))}/${suffix}`;
  }

  const qs = new URLSearchParams(params).toString();
  const url = `${BASE}${path}${qs ? `?${qs}` : ''}`;

  try {
    const upstream = await fetch(url, {
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
    });
    const json = await upstream.json();

    res.setHeader('x-calibre-source', 'vercel-bridge');
    // A finished match's stats never change — cache generously to spare quota.
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');

    res.status(upstream.status).json(json);
  } catch (error) {
    res.status(502).json({ error: 'Upstream request failed', detail: String(error?.message || error) });
  }
}
