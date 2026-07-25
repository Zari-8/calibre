// ============================================================
// backtestDefTerritorial.mjs — round 2 of the DEF weighting investigation.
// Round 1 (backtestDefWeights.mjs) showed a real problem: a low-passing,
// high-tackle-volume CB at a side that defends a lot (weak possession
// share) can out-rate a genuinely elite, dominant-possession CB (Van Dijk)
// purely on raw tackle/interception COUNT, with no adjustment for how much
// defensive workload their team puts on them in the first place.
//
// territorialIndex() already exists in calibreRating.js (opp_half_passes /
// (opp_half_passes + own_half_passes) — how much of a player's involvement
// happens in the attacking half) and already adjusts `build`, but is never
// applied to `defend`. This pulls opp_half_passes/own_half_passes for the
// same player set (plus two more, name-collision-proofed with a team
// filter this time) so we can see (a) whether the data is actually
// populated for these rows, and (b) whether territorial share correlates
// with the defend-inflation problem the way the theory predicts.
//
// Run this LOCALLY (sandbox has no live network egress to Supabase).
// USAGE:
//   cd ~/Desktop/calibre-github
//   node scripts/backtestDefTerritorial.mjs
// Paste the FULL console output back into the chat.
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const f of ['.env', '.env.local']) {
  const p = join(ROOT, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const [k, ...r] = t.split('=');
    process.env[k.trim()] ??= r.join('=').trim().replace(/^["']|["']$/g, '');
  }
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const sb = createClient(url, key, { auth: { persistSession: false } });

const { productionComponents } = await import('../src/services/calibreRating.js');

const RAW_FIELDS = [
  'name', 'full_name', 'team', 'club', 'league_id',
  'minutes', 'appearances',
  'passes', 'pass_accuracy', 'tackles', 'interceptions', 'duels_won', 'clearances',
  'opp_half_passes', 'own_half_passes',
];

// territorialIndex(), inlined from calibreRating.js — trivial pure function,
// not exported there, not worth modifying the source file just to expose it
// for a one-off diagnostic script.
function territorialIndex(player) {
  const opp = player.opp_half_passes;
  const own = player.own_half_passes;
  if (opp == null || own == null || opp + own === 0) return null;
  const share = opp / (opp + own);
  return Math.max(0, Math.min(100, share * 100));
}

// Team filters added for Romero/Rüdiger this round — round 1's plain
// surname search hit unrelated players sharing those surnames and never
// actually found either of the intended targets.
const TARGETS = [
  { search: 'cubars', team: null, label: 'Pau Cubarsí (Barcelona)' },
  { search: 'stones', team: null, label: 'John Stones (Man City)' },
  { search: 'gvardiol', team: null, label: 'Josko Gvardiol (Man City)' },
  { search: 'van dijk', team: 'liverpool', label: 'Virgil van Dijk (Liverpool)' },
  { search: 'saliba', team: 'arsenal', label: 'William Saliba (Arsenal)' },
  { search: 'marquinhos', team: 'paris', label: 'Marquinhos (PSG)' },
  { search: 'romero', team: 'tottenham', label: 'Cristian Romero (Tottenham)' },
  { search: 'rudiger', team: 'madrid', label: 'Antonio Rüdiger (Real Madrid) — may miss diacritic spelling' },
];

async function main() {
  for (const t of TARGETS) {
    let q = sb
      .from('players')
      .select(RAW_FIELDS.join(','))
      .or(`name.ilike.%${t.search}%,full_name.ilike.%${t.search}%`);
    if (t.team) q = q.or(`team.ilike.%${t.team}%,club.ilike.%${t.team}%`);
    const { data, error } = await q.order('minutes', { ascending: false, nullsFirst: false }).limit(2);

    console.log('═'.repeat(78));
    console.log(t.label);
    if (error) { console.log('  query error:', error.message); continue; }
    if (!data || !data.length) { console.log(`  NOT FOUND for search "${t.search}"${t.team ? ` + team "${t.team}"` : ''}.`); continue; }

    for (const row of data) {
      const comp = productionComponents(row, 'DEF');
      const [defend] = comp.vals;
      const terr = territorialIndex(row);
      console.log(`\n  ${row.name}  (${row.team || row.club}, ${row.minutes} mins / ${row.appearances} apps)`);
      console.log(`    tackles=${row.tackles} interceptions=${row.interceptions} duels_won=${row.duels_won} clearances=${row.clearances}`);
      console.log(`    opp_half_passes=${row.opp_half_passes}  own_half_passes=${row.own_half_passes}  territorialIndex=${terr}`);
      console.log(`    defend (uncorrected)=${defend?.toFixed(1)}`);
    }
  }
}

main();
