// scripts/fetchWcLeaders.mjs
// ─────────────────────────────────────────────────────────────────────────
// Calibre — live World Cup data feed. Two jobs, one run:
//
//   1) wc_leaders — who is actually performing (top scorers + assisters, with
//      apps/minutes/match-rating). Players arrive WITH their api_player_id, so
//      this drops straight into the portrait/profile plumbing (also fixes the
//      "awaiting data" cases that name-matching used to miss).
//
//   2) wc_teams  — which national teams are still in vs eliminated, derived from
//      the tournament fixture list. Drives the watchlist "Eliminated" badge so a
//      pick like Güler is honestly tagged once his team goes home.
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

// ── 1) LEADERS ────────────────────────────────────────────────────────────
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

async function syncLeaders() {
  const scorers = await api('players/topscorers');
  const assisters = await api('players/topassists');
  console.log(`  top scorers: ${scorers.length}  |  top assisters: ${assisters.length}`);

  const map = new Map();
  const merge = (entry) => {
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
  };
  scorers.forEach(merge);
  assisters.forEach(merge);

  const rows = [...map.values()];
  if (!rows.length) {
    console.log('  no leaders returned (season may not be live in your plan, or try WC_SEASON / WC_LEAGUE_ID overrides)');
    return [];
  }
  const { error } = await sb.from('wc_leaders').upsert(rows, { onConflict: 'api_player_id,season' });
  if (error) { console.error('  wc_leaders upsert failed:', error.message); return rows; }
  rows.sort((a, b) => (b.goals - a.goals) || (b.assists - a.assists));
  console.log(`  upserted ${rows.length} leaders. Top: ${rows.slice(0, 3).map(r => `${r.name} ${r.goals}G`).join(', ')}`);
  return rows;
}

// ── 2) TEAM PROGRESS (eliminated vs in) ─────────────────────────────────────
const FINISHED = new Set(['FT', 'AET', 'PEN', 'AWD', 'WO']);
const LIVE     = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'SUSP', 'INT', 'LIVE']);
const PENDING  = new Set(['NS', 'TBD', 'PST']);

async function syncTeams() {
  const fixtures = await api('fixtures');
  console.log(`  fixtures: ${fixtures.length}`);
  if (!fixtures.length) {
    console.log('  no fixtures returned — skipping wc_teams (elimination badges stay off)');
    return;
  }

  // Collect every team and their fixtures.
  const teams = new Map(); // id -> { id, name, pending, live, finished:[{date, round, won}] }
  const note = (side, fx) => {
    const t = fx.teams[side];
    if (!t || !t.id) return;
    if (!teams.has(t.id)) teams.set(t.id, { id: t.id, name: t.name, pending: false, live: false, finished: [] });
    const rec = teams.get(t.id);
    const short = fx.fixture?.status?.short;
    if (PENDING.has(short)) rec.pending = true;
    else if (LIVE.has(short)) rec.live = true;
    else if (FINISHED.has(short)) {
      rec.finished.push({ date: fx.fixture?.date || '', round: fx.league?.round || '', won: t.winner === true });
    }
  };
  for (const fx of fixtures) { note('home', fx); note('away', fx); }

  const rows = [...teams.values()].map(t => {
    let eliminated = false;
    let lastRound = null;
    if (!t.pending && !t.live && t.finished.length) {
      const last = t.finished.slice().sort((a, b) => new Date(b.date) - new Date(a.date))[0];
      lastRound = last.round;
      const wonFinal = /final/i.test(last.round) && !/semi|quarter|3rd|third/i.test(last.round) && last.won;
      // No future or live match left, and they didn't win the final → out.
      eliminated = !wonFinal;
    }
    return {
      team_id: t.id,
      season: String(SEASON),
      team_name: t.name,
      eliminated,
      last_round: lastRound,
      updated_at: new Date().toISOString(),
    };
  });

  const { error } = await sb.from('wc_teams').upsert(rows, { onConflict: 'team_id,season' });
  if (error) { console.error('  wc_teams upsert failed:', error.message); return; }
  const out = rows.filter(r => r.eliminated).map(r => r.team_name);
  console.log(`  upserted ${rows.length} teams. Eliminated (${out.length}): ${out.join(', ') || 'none yet'}`);
}

async function run() {
  console.log(`Calibre WC feed — league ${LEAGUE}, season ${SEASON}`);
  console.log('Leaders:');   await syncLeaders();
  console.log('Teams:');     await syncTeams();
  console.log('Done.');
}

run().catch((e) => { console.error(e); process.exit(1); });
