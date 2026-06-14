#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────
// xG Provider Probe — test TheStatsAPI and iSports API trial endpoints to
// see exactly what xG/xA data comes back before spending anything.
//
// SETUP:
//   1. Sign up for a free trial:
//      • TheStatsAPI  → https://www.thestatsapi.com  (7-day trial, $50/mo after)
//      • iSports API  → https://www.isportsapi.com   (free trial, $49/mo after)
//   2. Grab your API key from each dashboard.
//   3. Run ONE provider at a time:
//
//      PROVIDER=thestatsapi API_KEY=your_key node testXgProviders.mjs
//      PROVIDER=isports     API_KEY=your_key node testXgProviders.mjs
//
//   No npm install needed — uses Node's built-in fetch (v18+).
// ─────────────────────────────────────────────────────────────────────────

const PROVIDER = (process.env.PROVIDER || '').toLowerCase();
const API_KEY  = process.env.API_KEY || '';

if (!API_KEY) { console.error('Missing API_KEY env var.'); process.exit(1); }
if (!['thestatsapi', 'isports'].includes(PROVIDER)) {
  console.error('Set PROVIDER=thestatsapi or PROVIDER=isports'); process.exit(1);
}

// ── helpers ──────────────────────────────────────────────────────────────
async function jsonFetch(url, headers = {}) {
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

function printSection(title) { console.log(`\n${'═'.repeat(60)}\n  ${title}\n${'═'.repeat(60)}`); }

function deepFindKeys(obj, targets, path = '', results = {}) {
  if (!obj || typeof obj !== 'object') return results;
  for (const [k, v] of Object.entries(obj)) {
    const p = path ? `${path}.${k}` : k;
    const kl = k.toLowerCase();
    if (targets.some(t => kl.includes(t))) results[p] = v;
    if (v && typeof v === 'object') deepFindKeys(v, targets, p, results);
  }
  return results;
}

// ── TheStatsAPI probes ──────────────────────────────────────────────────
async function probeTheStatsAPI() {
  const BASE = 'https://api.thestatsapi.com/api/football';
  const headers = { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' };
  const get = (path) => jsonFetch(`${BASE}${path}`, headers);

  // 1. Search for a known player
  printSection('1. Player search: "Bruno Fernandes"');
  const search = await get('/players?search=Bruno%20Fernandes&per_page=5');
  const players = search.data || search.results || search || [];
  const list = Array.isArray(players) ? players : (players.data || []);
  if (!list.length) { console.log('No players found. Check API key / trial access.'); return; }

  for (const p of list.slice(0, 3)) {
    console.log(`  → ${p.name || p.common_name || p.full_name} | id: ${p.id} | team: ${p.team?.name || p.current_team?.name || '?'}`);
  }

  // 2. Get season stats for the first match
  const playerId = list[0]?.id;
  if (!playerId) { console.log('Could not resolve a player id.'); return; }

  printSection(`2. Season stats for player ${playerId}`);
  let stats;
  try {
    stats = await get(`/players/${playerId}/stats`);
  } catch (e) {
    // Some APIs need a season_id param — try listing seasons first
    console.log(`  Direct stats failed (${e.message}). Trying without season filter...`);
    try { stats = await get(`/players/${playerId}`); } catch (e2) {
      console.log(`  Also failed: ${e2.message}`); return;
    }
  }

  // 3. Hunt for xG / xA fields anywhere in the response
  printSection('3. xG / xA fields in player stats response');
  const xgHits = deepFindKeys(stats, ['xg', 'xa', 'expected_goal', 'expected_assist', 'npxg']);
  if (Object.keys(xgHits).length) {
    for (const [path, val] of Object.entries(xgHits)) {
      console.log(`  ✅ ${path} = ${JSON.stringify(val)}`);
    }
  } else {
    console.log('  ❌ No xG/xA fields found in the player stats response.');
    console.log('     Dumping top-level keys for inspection:');
    const top = stats.data || stats;
    if (Array.isArray(top)) {
      console.log(`     (array of ${top.length} items, first item keys: ${Object.keys(top[0] || {}).join(', ')})`);
    } else {
      console.log(`     ${Object.keys(top).join(', ')}`);
    }
  }

  // 4. Check a recent match for match-level xG
  printSection('4. Match-level xG check (Premier League recent)');
  try {
    // comp_3039 is commonly PL on TheStatsAPI; adjust if needed
    const matches = await get('/matches?competition_id=comp_3039&per_page=3');
    const mList = matches.data || matches.results || [];
    for (const m of (Array.isArray(mList) ? mList : []).slice(0, 2)) {
      const mxg = deepFindKeys(m, ['xg', 'expected_goal']);
      const home = m.home_team?.name || m.teams?.home?.name || '?';
      const away = m.away_team?.name || m.teams?.away?.name || '?';
      console.log(`  ${home} vs ${away}`);
      if (Object.keys(mxg).length) {
        for (const [path, val] of Object.entries(mxg)) console.log(`    ✅ ${path} = ${val}`);
      } else {
        console.log('    ❌ No xG in this match object');
      }
    }
  } catch (e) { console.log(`  Match fetch failed: ${e.message}`); }

  // 5. Raw dump of one player stats object for manual inspection
  printSection('5. Raw player stats sample (first 2000 chars)');
  console.log(JSON.stringify(stats, null, 2).slice(0, 2000));
}

// ── iSports API probes ──────────────────────────────────────────────────
async function probeISports() {
  // iSports uses a different auth pattern — typically ?api_key= or similar
  // Their docs aren't as clear, so we probe common patterns
  const BASE = 'https://api.isportsapi.com/sport/football';
  const sep = '?'; // most REST APIs use query param for key

  printSection('1. Probing iSports API endpoints');
  console.log('  iSports API documentation is less standardized.');
  console.log('  Checking common endpoint patterns...\n');

  const tryEndpoints = [
    { label: 'Player search', url: `${BASE}/player/search${sep}api_key=${API_KEY}&name=Bruno%20Fernandes` },
    { label: 'Player search (alt)', url: `${BASE}/players${sep}api_key=${API_KEY}&search=Bruno%20Fernandes` },
    { label: 'Matches (PL)', url: `${BASE}/match/list${sep}api_key=${API_KEY}&leagueId=8&page=1` },
    { label: 'Matches (alt)', url: `${BASE}/matches${sep}api_key=${API_KEY}&league=premier-league&page=1` },
  ];

  for (const ep of tryEndpoints) {
    try {
      const data = await jsonFetch(ep.url);
      console.log(`  ✅ ${ep.label} — returned data`);
      const xgHits = deepFindKeys(data, ['xg', 'xa', 'expected_goal', 'expected_assist']);
      if (Object.keys(xgHits).length) {
        for (const [path, val] of Object.entries(xgHits)) console.log(`     xG field: ${path} = ${JSON.stringify(val)}`);
      }
      // Show first 500 chars of response
      console.log(`     Preview: ${JSON.stringify(data).slice(0, 500)}\n`);
    } catch (e) {
      console.log(`  ❌ ${ep.label} — ${e.message}\n`);
    }
  }

  console.log('\n  If all endpoints failed, check iSports documentation for');
  console.log('  the correct base URL and auth pattern for your trial tier.');
  console.log('  Their docs: https://www.isportsapi.com/en/documentation');
}

// ── run ──────────────────────────────────────────────────────────────────
console.log(`\n  xG Provider Probe — ${PROVIDER.toUpperCase()}`);
console.log(`  ${new Date().toISOString()}\n`);

try {
  if (PROVIDER === 'thestatsapi') await probeTheStatsAPI();
  else await probeISports();
  printSection('DONE');
  console.log('  Review the output above. The key questions:');
  console.log('  1. Does the player stats response include xG / xA per season?');
  console.log('  2. Does match-level data include team xG?');
  console.log('  3. Is the data shape clean enough to merge into your enrichment pipeline?');
  console.log('  If yes to all three, this provider can fill the gap.\n');
} catch (e) {
  console.error(`\nFatal error: ${e.message}`);
  process.exit(1);
}
