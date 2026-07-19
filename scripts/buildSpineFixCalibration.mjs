// scripts/buildSpineFixCalibration.mjs — READ-ONLY. No writes.
//
// WHY: spine() is now fixed for real (positional weights, no sort — see
// src/services/calibreRating.js v8.7 comment). Fixing it alone is NOT safe
// to ship — an earlier attempt at the identical fix showed it's
// mathematically guaranteed (rearrangement inequality) to only ever lower
// scores, because the whole 1-99 scale was calibrated against ratings that
// already included the bug's inflation. That attempt dropped 10,111/13,883
// players and sent a real Girona starter to 47.
//
// THE FIX THIS TIME: build an empirical percentile mapping — the exact same
// technique the engine already uses for qFlat()/Q_ANCHORS (mapping raw
// api_average_rating onto a calibrated internal scale via percentile
// anchors) — from the CURRENTLY-LIVE distribution (OLD = spine still
// buggy, i.e. exactly what's in players.rating right now) to the
// spine-fixed-but-uncalibrated distribution (NEW = fixed spine, same curve,
// no remap yet). The output anchor table, pasted into calibreRating.js as
// RATING_CALIBRATION_ANCHORS, remaps NEW's raw scale back onto OLD's real
// shape — so the overall distribution (how many 90s, how many 50s) stays
// where it is today, and only players' RELATIVE ordering changes to reflect
// correct position-weighted scoring instead of the magnitude-sorted bug.
//
// This is a monotonic transform: it cannot invert anyone's rank-order
// relative to other NEW scores, it only rescales NEW onto OLD's histogram.
//
// Run:
//   node scripts/buildSpineFixCalibration.mjs
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

const PAGE = 1000;

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

function safeCompute(fn, row) {
  try { return fn(row); } catch { return null; }
}

// Percentile of a SORTED ascending array using linear interpolation (same
// convention as Q_ANCHORS' own p10/p50/p90/p99 anchors).
function percentile(sortedArr, p) {
  if (!sortedArr.length) return null;
  const idx = (p / 100) * (sortedArr.length - 1);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  if (lo === hi) return sortedArr[lo];
  const t = idx - lo;
  return sortedArr[lo] + t * (sortedArr[hi] - sortedArr[lo]);
}

function buildAnchors(oldVals, newVals, points) {
  const oldSorted = [...oldVals].sort((a, b) => a - b);
  const newSorted = [...newVals].sort((a, b) => a - b);
  return points.map(p => [
    Number(percentile(newSorted, p).toFixed(2)), // NEW raw value at this percentile
    Number(percentile(oldSorted, p).toFixed(2)), // OLD (live) value at the SAME percentile
  ]);
}

async function run() {
  console.log('Building spine-fix calibration anchors — DRY RUN, read-only.\n');
  const rows = await fetchAll();
  console.log(`\nScoring ${rows.length} rows with OLD (live, spine-bugged) and NEW (spine-fixed, uncalibrated)...\n`);

  const ratingPairs = []; // [oldRating, newRating]
  const abilityPairs = []; // [oldAbility, newAbility]

  for (const row of rows) {
    const oldRes = safeCompute(calibreRatingOLD, row);
    const newRes = safeCompute(calibreRatingNEW, row);
    const oldR = oldRes?.rating, newR = newRes?.rating;
    const oldA = oldRes?.ability, newA = newRes?.ability;
    if (oldR != null && newR != null) ratingPairs.push([oldR, newR]);
    if (oldA != null && newA != null) abilityPairs.push([oldA, newA]);
  }

  console.log(`Rating pairs: ${ratingPairs.length}   Ability pairs: ${abilityPairs.length}\n`);

  // Fine-grained anchors: every 2nd percentile, plus the extremes densely
  // sampled (elite tier is where compression matters most).
  const points = [0, 1, 2, 5];
  for (let p = 10; p <= 90; p += 5) points.push(p);
  points.push(95, 97, 98, 99, 99.5, 100);

  const ratingAnchors = buildAnchors(ratingPairs.map(p => p[0]), ratingPairs.map(p => p[1]), points);
  const abilityAnchors = buildAnchors(abilityPairs.map(p => p[0]), abilityPairs.map(p => p[1]), points);

  console.log('── RATING_CALIBRATION_ANCHORS (paste into calibreRating.js) ──');
  console.log('// [NEW raw (spine-fixed, uncalibrated), OLD live value at same percentile]');
  console.log(JSON.stringify(ratingAnchors));

  console.log('\n── ABILITY_CALIBRATION_ANCHORS (paste into calibreRating.js) ──');
  console.log(JSON.stringify(abilityAnchors));

  // Sanity: monotonicity check — percentile anchors should be non-decreasing
  // in both columns. If not, something's off (small-sample noise at extreme
  // percentiles, most likely) and the anchor table needs manual smoothing
  // before use.
  function checkMonotonic(anchors, label) {
    let ok = true;
    for (let i = 1; i < anchors.length; i++) {
      if (anchors[i][0] < anchors[i - 1][0] || anchors[i][1] < anchors[i - 1][1]) {
        console.log(`  ⚠ ${label} non-monotonic at index ${i}: ${JSON.stringify(anchors[i - 1])} -> ${JSON.stringify(anchors[i])}`);
        ok = false;
      }
    }
    if (ok) console.log(`  ${label}: monotonic, looks clean.`);
  }
  console.log('\n── Sanity checks ──');
  checkMonotonic(ratingAnchors, 'RATING_CALIBRATION_ANCHORS');
  checkMonotonic(abilityAnchors, 'ABILITY_CALIBRATION_ANCHORS');

  console.log('\nNothing written. Paste both anchor arrays back — next step is wiring them into');
  console.log('calibreRating.js as a remapCalibrated() function (same pattern as qFlat/Q_ANCHORS),');
  console.log('then a full dry-run impact report before anything goes live.');
}

run().catch(e => { console.error('\nFatal:', e?.message ?? e); process.exit(1); });
