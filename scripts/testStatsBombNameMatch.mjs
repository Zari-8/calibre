// scripts/testStatsBombNameMatch.mjs — READ-ONLY. No writes.
//
// Proof-of-concept: can we reliably match StatsBomb open-data player names
// against our own players table by name alone? StatsBomb has no overlap
// with our api_player_id (API-Football's numbering), so any future use of
// their open data (historical calibration, event-level detail for specific
// matches) depends entirely on name-based reconciliation working.
//
// Test set: real lineup data pulled from Bayer Leverkusen vs Union Berlin,
// Bundesliga 2023/2024 (match_id 3895292, Leverkusen's title-winning
// season) -- https://github.com/hudl/open-data. Chosen because it's the
// MOST RECENT domestic-league match in the open-data repo, giving the best
// chance these players are still active and in our current scored
// population, unlike most of the repo's older historical seasons.
//
// Uses StatsBomb's player_nickname where present (the common public name,
// e.g. "Victor Boniface") and falls back to the full legal player_name
// otherwise (e.g. "Lucas Tousart" has no nickname).
//
// Run: node scripts/testStatsBombNameMatch.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

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

// [StatsBomb name to search, team it played for in this match] — using
// player_nickname where StatsBomb provides one, else player_name.
const TEST_PLAYERS = [
  ['Lucas Tousart', 'Union Berlin'],
  ['Robin Gosens', 'Union Berlin'],
  ['Robin Knoche', 'Union Berlin'],
  ['Kevin Vogt', 'Union Berlin'],
  ['Diogo Leite', 'Union Berlin'],
  ['Christopher Trimmel', 'Union Berlin'],
  ['Rani Khedira', 'Union Berlin'],
  ['Frederik Rønnow', 'Union Berlin'],
  ['Danilho Doekhi', 'Union Berlin'],
  ['Paul Jaeckel', 'Union Berlin'],
  ['Alex Král', 'Union Berlin'],
  ['Chris Bedia', 'Union Berlin'],
  ['Brenden Aaronson', 'Union Berlin'],
  ['Mikkel Kaufmann', 'Union Berlin'],
  ['Josip Juranović', 'Union Berlin'],
  ['Yorbe Vertessen', 'Union Berlin'],
  ['András Schäfer', 'Union Berlin'],
  ['Aïssa Laïdouni', 'Union Berlin'],
  ['Benedict Hollerbach', 'Union Berlin'],
  ['Granit Xhaka', 'Bayer Leverkusen'],
  ['Patrik Schick', 'Bayer Leverkusen'],
  ['Jonathan Tah', 'Bayer Leverkusen'],
  ['Lukáš Hrádecký', 'Bayer Leverkusen'],
  ['Jonas Hofmann', 'Bayer Leverkusen'],
  ['Robert Andrich', 'Bayer Leverkusen'],
  ['Álex Grimaldo', 'Bayer Leverkusen'],
  ['Borja Iglesias', 'Bayer Leverkusen'],
  ['Odilon Kossonou', 'Bayer Leverkusen'],
  ['Adam Hložek', 'Bayer Leverkusen'],
  ['Exequiel Palacios', 'Bayer Leverkusen'],
  ['Edmond Tapsoba', 'Bayer Leverkusen'],
  ['Victor Boniface', 'Bayer Leverkusen'],
  ['Jeremie Frimpong', 'Bayer Leverkusen'],
  ['Amine Adli', 'Bayer Leverkusen'],
  ['Piero Hincapié', 'Bayer Leverkusen'],
  ['Florian Wirtz', 'Bayer Leverkusen'],
  ['Nathan Tella', 'Bayer Leverkusen'],
  ['Matěj Kovář', 'Bayer Leverkusen'],
  ['Josip Stanišić', 'Bayer Leverkusen'],
];

function normName(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

async function run() {
  console.log(`Testing ${TEST_PLAYERS.length} real StatsBomb names against our players table...\n`);
  let matched = 0, ambiguous = 0, noMatch = 0;

  for (const [sbName, sbTeam] of TEST_PLAYERS) {
    // v2 — two bugs in the original version, both making real matches look
    // like failures:
    // (1) Our DB stores names abbreviated ("F. Wirtz", not "Florian Wirtz"),
    //     so requiring the FULL normalized name to match threw genuine hits
    //     (Trimmel, Xhaka, Wirtz, Andrich, Schick, Tapsoba, Boniface,
    //     Aaronson, Hollerbach, Khedira, Rønnow, Doekhi...) into "ambiguous."
    //     Now matches on first-initial + surname instead, which is what our
    //     own registry format actually supports.
    // (2) The SQL search term was accent-STRIPPED ("Hložek" -> "hlozek"),
    //     but Postgres ILIKE isn't accent-insensitive -- searching for the
    //     stripped form can't find a row that still has the accented
    //     character, producing false "no match" results (Hložek, Hrádecký,
    //     Juranović, Hincapié all have this exact problem). Now tries the
    //     RAW surname first, falling back to the stripped version only if
    //     that finds nothing.
    const rawSurname = sbName.trim().split(/\s+/).pop();
    const strippedSurname = normName(sbName).split(' ').pop();

    let { data, error } = await sb.from('players')
      .select('name, team, league_id, api_player_id')
      .ilike('name', `%${rawSurname}%`).limit(8);
    if (error) { console.error(`  ${sbName}: query failed (${error.message})`); continue; }
    if ((!data || data.length === 0) && strippedSurname !== normName(rawSurname)) {
      ({ data, error } = await sb.from('players')
        .select('name, team, league_id, api_player_id')
        .ilike('name', `%${strippedSurname}%`).limit(8));
      if (error) { console.error(`  ${sbName}: query failed (${error.message})`); continue; }
    }

    if (!data || data.length === 0) {
      console.log(`✗ NO MATCH   "${sbName}" (${sbTeam})`);
      noMatch++;
      continue;
    }

    const wantTok = normName(sbName).split(' ');
    const wantSurname = wantTok[wantTok.length - 1];
    const wantInit = (wantTok[0] || '')[0] || '';
    const scored = data.map(r => {
      const ct = normName(r.name).split(' ');
      const surOk = ct[ct.length - 1] === wantSurname;
      const initOk = !wantInit || (ct[0] || '')[0] === wantInit;
      const teamOk = sbTeam && r.team && normName(r.team) === normName(sbTeam);
      return { ...r, surOk, initOk, teamOk };
    });
    const best = scored.find(r => r.surOk && r.initOk && r.teamOk)
      || scored.find(r => r.surOk && r.initOk);

    if (best) {
      console.log(`✓ MATCH      "${sbName}" -> "${best.name}" (${best.team ?? '—'}, league_id=${best.league_id ?? '—'}, api_player_id=${best.api_player_id ?? '—'})${best.teamOk ? ' [team-confirmed]' : ''}`);
      matched++;
    } else {
      console.log(`? AMBIGUOUS  "${sbName}" (${sbTeam}) -- ${data.length} surname-only candidate(s), none with a matching initial: ${data.map(r => `"${r.name}" (${r.team ?? '—'})`).join(', ')}`);
      ambiguous++;
    }
  }

  console.log(`\n── Summary ──`);
  console.log(`Exact name match:        ${matched}/${TEST_PLAYERS.length}`);
  console.log(`Ambiguous (needs review): ${ambiguous}/${TEST_PLAYERS.length}`);
  console.log(`No match at all:         ${noMatch}/${TEST_PLAYERS.length}`);
}

run().catch(e => { console.error('\nFatal:', e?.message ?? e); process.exit(1); });
