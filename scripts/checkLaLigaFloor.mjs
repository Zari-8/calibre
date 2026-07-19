// scripts/checkLaLigaFloor.mjs — READ-ONLY.
// Tests a specific claim: no player with real minutes at a La Liga club
// should rate at "academy/Segunda" level (~50 or below). Shows every La
// Liga player with meaningful minutes (default 900+, ~half a season),
// sorted ascending by rating, under BOTH the currently-live engine and the
// spine-fixed+calibrated one — so we can see whether low ratings for real
// La Liga players are a pre-existing issue or something today's fix
// introduces or worsens.
//
// Usage:
//   node scripts/checkLaLigaFloor.mjs
//   MIN_MINUTES=1350 node scripts/checkLaLigaFloor.mjs
//   LEAGUE_ID=39 node scripts/checkLaLigaFloor.mjs   (39=Premier League, 78=Bundesliga, 135=Serie A, 61=Ligue 1)
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { calibreRating as calibreRatingNEW } from '../src/services/calibreRating.js';
import { calibreRating as calibreRatingOLD } from './_tmp_calib/calibreRating.OLD.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const f of ['.env', '.env.local']) {
  const p = join(ROOT, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [key, ...rest] = trimmed.split('=');
    process.env[key.trim()] ??= rest.join('=').trim().replace(/^["']|["']$/g, '');
  }
}

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!URL || !KEY) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const MIN_MINUTES = Number(process.env.MIN_MINUTES || 900);
const LEAGUE_ID = Number(process.env.LEAGUE_ID || 140); // default La Liga
const LEAGUE_NAMES = { 140: 'La Liga', 39: 'Premier League', 78: 'Bundesliga', 135: 'Serie A', 61: 'Ligue 1' };

async function run() {
  const { data, error } = await sb
    .from('players')
    .select('*')
    .eq('league_id', LEAGUE_ID)
    .gte('minutes', MIN_MINUTES)
    .order('minutes', { ascending: false });
  if (error) { console.error('Fetch failed:', error.message); process.exit(1); }
  if (!data?.length) { console.log(`No league_id=${LEAGUE_ID} rows with that minutes threshold.`); return; }

  console.log(`${LEAGUE_NAMES[LEAGUE_ID] || `league_id=${LEAGUE_ID}`} players with ${MIN_MINUTES}+ minutes: ${data.length}\n`);

  const rows = data.map(r => {
    const oldRes = calibreRatingOLD(r);
    const newRes = calibreRatingNEW(r);
    return { name: r.name, team: r.team, minutes: r.minutes, storedLive: r.rating, oldCompute: oldRes?.rating, newCompute: newRes?.rating };
  }).sort((a, b) => (a.newCompute ?? 999) - (b.newCompute ?? 999));

  console.log(String('Name').padEnd(24) + String('Team').padEnd(20) + String('Mins').padEnd(6) + String('Stored(live)').padEnd(14) + String('OLD-recompute').padEnd(15) + 'NEW(spine-fixed)');
  for (const r of rows) {
    console.log(
      String(r.name).padEnd(24) + String(r.team ?? '—').padEnd(20) + String(r.minutes ?? '—').padEnd(6) +
      String(r.storedLive ?? '—').padEnd(14) + String(r.oldCompute ?? '—').padEnd(15) + String(r.newCompute ?? '—')
    );
  }

  const under50Old = rows.filter(r => (r.oldCompute ?? 999) <= 50).length;
  const under50New = rows.filter(r => (r.newCompute ?? 999) <= 50).length;
  const under60Old = rows.filter(r => (r.oldCompute ?? 999) <= 60).length;
  const under60New = rows.filter(r => (r.newCompute ?? 999) <= 60).length;

  console.log(`\n── Summary (${MIN_MINUTES}+ min La Liga players) ──`);
  console.log(`  Rated <=50 today (OLD/live):        ${under50Old} / ${rows.length}`);
  console.log(`  Rated <=50 under spine fix (NEW):    ${under50New} / ${rows.length}`);
  console.log(`  Rated <=60 today (OLD/live):         ${under60Old} / ${rows.length}`);
  console.log(`  Rated <=60 under spine fix (NEW):     ${under60New} / ${rows.length}`);
}

run().catch(e => { console.error(e); process.exit(1); });
