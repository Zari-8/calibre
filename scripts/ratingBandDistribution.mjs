// scripts/ratingBandDistribution.mjs — READ-ONLY. No writes.
//
// Sizes the "too many elite ratings" problem Zari caught via Aleix García
// (rated 91, calibreValue math implies a ~€150-200m player; real market reads
// -~€20m Transfermarkt/Sofascore, ~€42m SoFIFA). Counts players in each
// rating band under BOTH the CURRENTLY-LIVE engine (OLD, spine still buggy —
// what's actually in players.rating right now) and the working-tree engine
// (NEW, spine-fixed + calibrated + floored) side by side. The point isn't
// "did today's changes cause this" in isolation — it's whether the top end
// was already this hot before today, which changes what the fix should be:
//   - if OLD and NEW bands look similar -> pre-existing top-end miscalibration
//     (like the La Liga floor problem), independent of the spine fix, needs
//     its own anchor-based correction (e.g. tightening the raw>88 compression,
//     or the RATING_CALIBRATION_ANCHORS top segment, or the underlying
//     production formula's per-90 thresholds for progress/build components).
//   - if NEW is meaningfully hotter than OLD -> today's remap/floor pushed
//     scores up at the top too, separate from the ordering fix's intent.
//
// Run: node scripts/ratingBandDistribution.mjs
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

const PAGE = 500;

async function fetchAll() {
  const rows = [];
  let offset = 0;
  while (true) {
    const { data, error } = await sb
      .from('players')
      .select('*')
      .or('minutes.gt.0,appearances.gt.0,api_average_rating.gt.0')
      .order('id', { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) { console.error('Fetch failed:', error.message); process.exit(1); }
    if (!data || data.length === 0) break;
    rows.push(...data);
    offset += data.length;
    process.stdout.write(`\r  fetched ${rows.length} rows...`);
    if (data.length < PAGE) break;
  }
  process.stdout.write('\n');
  return rows;
}

function safe(fn, row) { try { return fn(row); } catch { return null; } }

const BANDS = [
  [95, 99, '95-99 (once-a-generation)'],
  [90, 94, '90-94 (global superstar)'],
  [87, 89, '87-89 (world class)'],
  [85, 86, '85-86 (elite starter)'],
  [80, 84, '80-84 (very good)'],
  [75, 79, '75-79 (solid starter)'],
  [70, 74, '70-74 (squad player)'],
  [0, 69, '<=69'],
];

function bandCounts(ratings) {
  const counts = BANDS.map(() => 0);
  for (const r of ratings) {
    if (!Number.isFinite(r)) continue;
    for (let i = 0; i < BANDS.length; i++) {
      if (r >= BANDS[i][0] && r <= BANDS[i][1]) { counts[i]++; break; }
    }
  }
  return counts;
}

async function run() {
  console.log('Rating band distribution — OLD (live) vs NEW (working tree). Read-only.\n');
  const rows = await fetchAll();

  const oldRatings = rows.map(r => safe(calibreRatingOLD, r)?.rating).filter(v => Number.isFinite(v));
  const newRatings = rows.map(r => safe(calibreRatingNEW, r)?.rating).filter(v => Number.isFinite(v));

  const oldCounts = bandCounts(oldRatings);
  const newCounts = bandCounts(newRatings);

  console.log(`Scored: OLD ${oldRatings.length} / NEW ${newRatings.length} (of ${rows.length} fetched)\n`);
  console.log(String('Band').padEnd(28) + String('OLD count').padEnd(12) + String('OLD %').padEnd(10) + String('NEW count').padEnd(12) + 'NEW %');
  for (let i = 0; i < BANDS.length; i++) {
    const label = BANDS[i][2];
    const oc = oldCounts[i], nc = newCounts[i];
    const op = ((oc / oldRatings.length) * 100).toFixed(2) + '%';
    const np = ((nc / newRatings.length) * 100).toFixed(2) + '%';
    console.log(label.padEnd(28) + String(oc).padEnd(12) + op.padEnd(10) + String(nc).padEnd(12) + np);
  }

  console.log('\n── Sanity reference ──');
  console.log('For scale: real-world football has roughly 15-25 players anyone would call a');
  console.log('"90+" global superstar at any given time, out of tens of thousands of pros.');
  console.log(`This DB has ${rows.length} scored rows. If 90-94 alone is more than ~0.1-0.2% of`);
  console.log('that (roughly 15-30 players), the top end is almost certainly too generous.');

  console.log('\n── Every player currently >=90 (NEW engine) ──');
  const elite = rows
    .map(r => ({ name: r.name, team: r.team, id: r.id, rating: safe(calibreRatingNEW, r)?.rating }))
    .filter(r => Number.isFinite(r.rating) && r.rating >= 90)
    .sort((a, b) => b.rating - a.rating);
  for (const p of elite) console.log(`  ${p.rating}  ${String(p.name).padEnd(24)} ${p.team ?? '—'}  id=${p.id}`);
  console.log(`\n  Total >=90: ${elite.length}`);
}

run().catch(e => { console.error('\nFatal:', e?.message ?? e); process.exit(1); });
