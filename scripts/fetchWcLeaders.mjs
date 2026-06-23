// scripts/fetchWcLeaders.mjs
// ─────────────────────────────────────────────────────────────────────────
// Calibre — live World Cup leaders.
//
// Pulls who is actually performing at the World Cup (top scorers + top
// assisters, with apps/minutes/match-rating) from API-Football and upserts them
// into the wc_leaders Supabase table. The World Cup page reads that table, so
// the "who's lighting up the tournament" section reflects reality instead of a
// pre-tournament prediction array.
//
// Players arrive WITH their api_player_id, so this also sidesteps the name-
// mapping problem that leaves players like Bouaddi on "awaiting data".
//
// Run (one line, no quotes):
//   API_FOOTBALL_KEY=your_key SUPABASE_URL=your_url SUPABASE_SERVICE_ROLE_KEY=your_service_key node scripts/fetchWcLeaders.mjs
//
// Optional overrides if the defaults return nothing:
//   WC_LEAGUE_ID=1   (API-Football World Cup league id)
//   WC_SEASON=2026   (finals season)
// ─────────────────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js';

const KEY  = process.env.API_FOOTBALL_KEY;
const URL  = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SKEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const LEAGUE = process.env.WC_LEAGUE_ID || '1';
const SEASON = process.env.WC_SEASON || '2026';

if (!KEY || !URL || !SKEY) {
  console.error('Missing credentials. Run it like this (one line, no quotes):');
  console.error('  API_FOOTBALL_KEY=your_key SUPABASE_URL=your_url SUPABASE_SERVICE_ROLE_KEY=your_service_key node scripts/fetchWcLeaders.mjs');
  process.exit(1);
}

const sb = createClient(URL, SKEY, { auth: { persistSession: false } });

async function api(endpoint) {
  const url = `https://v3.football.api-sports.io/${endpoint}?league=${LEAGUE}&season=${SEASON}`;
  const res = await fetch(url, { headers: { 'x-apisports-key': KEY } });
  const json = await res.json();
  if (json.errors && Object.keys(json.errors).length) {
    console.error('  API said:', JSON.stringify(json.errors));
  }
  return json.response || [];
}

function rowFrom(entry) {
  const p = entry.player || {};
  const st = (entry.statistics && entry.statistics[0]) || {};
  const games = st.games || {};
  const goals = st.goals || {};
  return {
    api_player_id: p.id,
    season: String(SEASON),
    name: p.name || null,
    team: (st.team && st.team.name) || null,
    nationality: p.nationality || null,
    position: games.position || null,
    goals: goals.total || 0,
    assists: goals.assists || 0,
    appearances: games.appearences || 0,   // API-Football's own spelling
    minutes: games.minutes || 0,
    rating: games.rating ? Number(games.rating) : null,
    photo: p.photo || (p.id ? `https://media.api-sports.io/football/players/${p.id}.png` : null),
    updated_at: new Date().toISOString(),
  };
}

const map = new Map();
function merge(entry) {
  const r = rowFrom(entry);
  if (!r.api_player_id) return;
  const cur = map.get(r.api_player_id);
  if (!cur) { map.set(r.api_player_id, r); return; }
  cur.goals = Math.max(cur.goals, r.goals);
  cur.assists = Math.max(cur.assists, r.assists);
  cur.appearances = Math.max(cur.appearances, r.appearances);
  cur.minutes = Math.max(cur.minutes, r.minutes);
  cur.rating = cur.rating ?? r.rating;
  cur.team = cur.team || r.team;
  cur.position = cur.position || r.position;
}

async function run() {
  console.log(`Fetching World Cup leaders (league ${LEAGUE}, season ${SEASON})...`);
  const scorers = await api('players/topscorers');
  const assisters = await api('players/topassists');
  console.log(`  top scorers: ${scorers.length}  |  top assisters: ${assisters.length}`);
  scorers.forEach(merge);
  assisters.forEach(merge);

  const rows = [...map.values()];
  if (!rows.length) {
    console.log('\nNo leaders returned. Likely causes:');
    console.log('  - the 2026 World Cup season is not yet live / not in your API plan');
    console.log('  - the league id or season differs — try WC_LEAGUE_ID / WC_SEASON overrides');
    process.exit(0);
  }

  const { error } = await sb.from('wc_leaders').upsert(rows, { onConflict: 'api_player_id,season' });
  if (error) { console.error('Upsert failed:', error.message); process.exit(1); }

  rows.sort((a, b) => (b.goals - a.goals) || (b.assists - a.assists));
  console.log(`\nUpserted ${rows.length} leaders. Top of the table:`);
  rows.slice(0, 8).forEach(r => console.log(`  ${r.name} (${r.team}) — ${r.goals}G ${r.assists}A, ${r.appearances} apps, rating ${r.rating ?? '—'}`));
}

run().catch((e) => { console.error(e); process.exit(1); });
