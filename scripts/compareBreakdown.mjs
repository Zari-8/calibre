// scripts/compareBreakdown.mjs — READ-ONLY. For a list of player names, shows
// the raw underlying stats AND the calibreRating() breakdown side by side —
// not just the final number — so it's visible exactly which lever is moving
// (or not moving) a given player's rating. Also prints every raw
// position-text field positionBucket() reads, so a forward mislabeled as a
// midfielder (wrong weight set entirely) shows up immediately.
//
// Run (one line, no quotes):
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//   NAMES="gavi,bellingham,joão neves,lewandowski" node scripts/compareBreakdown.mjs

import { createClient } from '@supabase/supabase-js';
import { calibreRating, positionBucket, productionComponents, qFlat } from '../src/services/calibreRating.js';

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!URL || !KEY) {
  console.error('Missing credentials. Run it like this (one line, no quotes):');
  console.error('  SUPABASE_URL=your_url SUPABASE_SERVICE_ROLE_KEY=your_service_key NAMES="gavi,bellingham" node scripts/compareBreakdown.mjs');
  process.exit(1);
}
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const NAMES = (process.env.NAMES || 'gavi,bellingham,joão neves,lewandowski')
  .split(',').map((s) => s.trim()).filter(Boolean);

const COMPONENT_LABELS = {
  ATT: ['goalScore', 'create', 'carry'],
  DEF: ['defend', 'build', 'prog', 'att'],
  MID: ['progress', 'create', 'goal', 'carry', 'defend'],
};

function fmt(v, w) { return String(v == null ? '—' : v).padEnd(w); }
function n2(v) { return v == null ? '—' : Math.round(v * 100) / 100; }

async function findRows(name) {
  // Short/common names (e.g. "gavi") collide with many unrelated substring
  // matches (Gaviria, Gavilán...) in a 401k-row table. Order by minutes
  // DESCENDING server-side before limiting, so real, high-evidence rows sort
  // to the top of the candidate pool instead of being buried behind dozens of
  // empty/duplicate rows that happen to come first in id order.
  const { data, error } = await sb
    .from('players')
    .select('*')
    .or('hidden.is.null,hidden.eq.false')
    .ilike('name', `%${name}%`)
    .order('minutes', { ascending: false, nullsFirst: false })
    .limit(10);
  if (error) { console.error(`Fetch failed for "${name}":`, error.message); return []; }
  return data || [];
}

function pickBest(rows) {
  return [...rows].sort((a, b) =>
    (Number(b.minutes) || 0) - (Number(a.minutes) || 0) ||
    (Number(b.api_average_rating) || 0) - (Number(a.api_average_rating) || 0) ||
    (Number(b.rating) || 0) - (Number(a.rating) || 0)
  )[0];
}

async function main() {
  console.log('BREAKDOWN COMPARE — read-only, nothing written.\n');
  const results = [];

  for (const name of NAMES) {
    const rows = await findRows(name);
    if (!rows.length) { console.log(`✗ "${name}": no match found`); continue; }
    const row = pickBest(rows);
    if (rows.length > 1) console.log(`  (note: ${rows.length} rows matched "${name}" — using id=${row.id}, the one with the most evidence)`);
    const res = calibreRating(row);
    const bucket = positionBucket(row);
    results.push({ name: row.name, row, res, bucket });
  }

  for (const { name, row, res, bucket } of results) {
    console.log(`\n══════════════════════════ ${name} ══════════════════════════`);
    console.log(`  position fields → position:"${row.position || ''}" archetype:"${row.archetype || ''}" pos:"${row.pos || ''}" primary_role:"${row.primary_role || ''}" raw_position:"${row.raw_position || ''}"  =>  BUCKET: ${bucket}`);
    console.log(`  age:${row.age ?? '—'}  league_id:${row.league_id ?? '—'}  team:${row.club || row.team || '—'}  minutes:${row.minutes ?? '—'}  stats_minutes:${row.stats_minutes ?? '—'}  appearances:${row.appearances ?? '—'}`);
    console.log(`  goals:${row.goals ?? '—'}  assists:${row.assists ?? '—'}  apiR:${row.api_average_rating ?? '—'} -> q:${n2(qFlat(Number(row.api_average_rating)))}`);
    console.log(`  passes:${row.passes ?? '—'}  pass_accuracy:${row.pass_accuracy ?? '—'}  key_passes:${row.key_passes ?? '—'}  tackles:${row.tackles ?? '—'}  interceptions:${row.interceptions ?? '—'}  duels_won:${row.duels_won ?? '—'}  shots:${row.shots ?? '—'}`);
    console.log(`  v8.2 advanced → shot_accuracy:${row.shot_accuracy ?? '—'}  big_chances_created:${row.big_chances_created ?? '—'}  ground_duel_win_pct:${row.ground_duel_win_pct ?? '—'}  aerial_duel_win_pct:${row.aerial_duel_win_pct ?? '—'}  dribble_success_pct:${row.dribble_success_pct ?? '—'}  final_third_passes:${row.final_third_passes ?? '—'}  xg:${row.xg ?? '—'}  xa:${row.xa ?? '—'}`);
    if (bucket === 'GK') {
      console.log(`  GK shot-stopping → saves:${row.saves ?? '—'}  goals_conceded:${row.goals_conceded ?? '—'}  penalty_saved:${row.penalty_saved ?? '—'}`);
    }
    console.log(`  competition_splits: ${row.competition_splits ? 'present' : 'none'}${res.blend ? `  | blend base:${res.blend.base} overlay:${res.blend.overlay} weight:${res.blend.overlayWeight}` : ''}`);

    if (bucket !== 'GK' && res.production != null) {
      const c = productionComponents(row, bucket);
      const labels = COMPONENT_LABELS[bucket] || [];
      console.log(`  production components (${bucket}, pre-splits-blend, illustrative):`);
      c.vals.forEach((v, i) => console.log(`    ${fmt(labels[i] || `v${i}`, 12)} = ${n2(v)}   (weight ${c.w[i]})`));
      console.log(`    ev (has passing evidence): ${c.ev}`);
    }

    console.log(`  → production:${res.production ?? '—'}  core:${res.core ?? '—'}  leagueStrength:${res.leagueStrength ?? '—'}  confidence:${res.confidence}`);
    console.log(`  → breakdown: Performance:${res.breakdown?.Performance ?? '—'} Consistency:${res.breakdown?.Consistency ?? '—'} Form:${res.breakdown?.Form ?? '—'} Impact:${res.breakdown?.Impact ?? '—'} Trajectory:${res.breakdown?.Trajectory ?? '—'}`);
    console.log(`  → STORED rating: ${row.rating ?? '—'}   COMPUTED rating (today's engine): ${res.rating ?? '—'}`);
  }

  console.log('\nDone. No rows were written.');
}

main().catch((e) => { console.error(e); process.exit(1); });
