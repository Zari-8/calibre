// scripts/inspectNameCollisions.mjs — READ-ONLY. Dumps every row matching a
// name (all of them, hidden included) with the fields needed to tell apart
// (a) two different real people who share a surname (e.g. Jude vs Jobe
// Bellingham), from (b) duplicate/hollow rows of the SAME person (e.g. the
// "R. Lewandowski" / "Robert Lewandowski" split seen in compareBreakdown).
//
// Run (one line, no quotes):
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... NAMES="bellingham,lewandowski" node scripts/inspectNameCollisions.mjs

import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!URL || !KEY) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const NAMES = (process.env.NAMES || 'bellingham,lewandowski')
  .split(',').map((s) => s.trim()).filter(Boolean);

function fmt(v, w) { return String(v == null ? '—' : v).padEnd(w); }

async function main() {
  console.log('NAME COLLISION INSPECTOR — read-only, includes hidden rows.\n');
  for (const name of NAMES) {
    const { data, error } = await sb
      .from('players')
      .select('id, name, team, club, age, nationality, league_id, api_player_id, statsapi_player_id, position, minutes, stats_minutes, appearances, goals, assists, api_average_rating, rating, hidden')
      .ilike('name', `%${name}%`)
      .order('minutes', { ascending: false, nullsFirst: false })
      .limit(20);
    if (error) { console.error(`Fetch failed for "${name}":`, error.message); continue; }

    console.log(`\n══════════ "${name}" — ${data.length} row(s) ══════════`);
    console.log(['name', 'team', 'age', 'nat', 'pos', 'min', 'apps', 'g/a', 'apiR', 'rating', 'apiId', 'statsapiId', 'hidden'].map((h) => fmt(h, 12)).join(''));
    for (const r of data) {
      console.log([
        r.name, r.club || r.team, r.age, r.nationality, r.position,
        r.minutes, r.appearances, `${r.goals ?? 0}/${r.assists ?? 0}`,
        r.api_average_rating, r.rating, r.api_player_id, r.statsapi_player_id, r.hidden ? 'yes' : '—',
      ].map((v) => fmt(v, 12)).join(''));
    }
  }
  console.log('\nDone.');
}

main().catch((e) => { console.error(e); process.exit(1); });
