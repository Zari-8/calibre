// scripts/rebuildCalibrationAnchors.mjs — READ-ONLY. No writes.
//
// The original RATING_CALIBRATION_ANCHORS/ABILITY_CALIBRATION_ANCHORS were
// built (buildSpineFixCalibration.mjs) purely to counteract spine()'s
// mechanical score-lowering effect (rearrangement inequality guarantees
// fixing the sort-based bug can only ever reduce scores) by remapping the
// corrected-but-uncalibrated distribution back onto the OLD (live) shape.
// That was appropriate THEN because OLD's shape wasn't the thing being
// fixed — spine()'s ORDERING was.
//
// Tonight's later changes (GK apiR-reliance fix, DEF defend ceiling-rarity
// fix, MID progress/create/goal weight rebalance, Performance weight
// 0.35->0.45 + softer top-end compression) are DIFFERENT in kind: they're
// deliberate corrections to the TOP of the distribution itself, found by
// tracing exactly why Aleix García/Bruno/both Romeros were landing at
// 90-91 alongside genuine superstars. Forcing the new top percentiles back
// onto OLD's shape (which is CONFIRMED too generous — ratingBandDistribution.mjs
// showed OLD already had 3 players >=90, this DB has ~13,000 scored rows,
// nowhere near the ~0.1-0.2% real-world rate) would undo tonight's work.
//
// So this measures calibreRatingUncalibrated(row) (the pre-remap raw score,
// NOT calibreRating(row) which would circularly run through the OLD/stale
// anchors) against OLD (truly-live) at matching percentiles for the BULK of
// the distribution (0-90th), where tonight's changes shouldn't have shifted
// much and OLD's shape is still a reasonable target — but reports the top
// (90-100th) separately, UNANCHORED to OLD, so a human can look at where the
// corrected formula naturally lands the true elite tier before deciding the
// final anchor points there (rather than blindly re-inflating it to match a
// shape we just spent the night proving is wrong).
//
// Run: node scripts/rebuildCalibrationAnchors.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { calibreRatingUncalibrated as calibreRatingNEW } from '../src/services/calibreRating.js';
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

function safeCompute(fn, row) { try { return fn(row); } catch { return null; } }

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
    Number(percentile(newSorted, p).toFixed(2)),
    Number(percentile(oldSorted, p).toFixed(2)),
  ]);
}

async function run() {
  console.log('Rebuilding calibration anchors post-Performance-weight fix — DRY RUN, read-only.\n');
  const rows = await fetchAll();
  console.log(`\nScoring ${rows.length} rows with OLD (live) and NEW-UNCALIBRATED (all v8.8 fixes, no remap yet)...\n`);

  const ratingPairs = [], abilityPairs = [];
  for (const row of rows) {
    const oldRes = safeCompute(calibreRatingOLD, row);
    const newRes = safeCompute(calibreRatingNEW, row);
    const oldR = oldRes?.rating, newR = newRes?.rating ?? newRes?.computed;
    const oldA = oldRes?.ability, newA = newRes?.ability;
    if (oldR != null && newR != null) ratingPairs.push([oldR, newR]);
    if (oldA != null && newA != null) abilityPairs.push([oldA, newA]);
  }
  console.log(`Rating pairs: ${ratingPairs.length}   Ability pairs: ${abilityPairs.length}\n`);

  const bulkPoints = [0, 1, 2, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90];
  const tailPoints = [91, 92, 93, 94, 95, 96, 97, 98, 99, 99.5, 100];

  const ratingBulk = buildAnchors(ratingPairs.map(p => p[0]), ratingPairs.map(p => p[1]), bulkPoints);
  const abilityBulk = buildAnchors(abilityPairs.map(p => p[0]), abilityPairs.map(p => p[1]), bulkPoints);

  console.log('── BULK anchors (0th-90th percentile, NEW-uncalibrated -> OLD-live, safe to reuse as before) ──');
  console.log('RATING:', JSON.stringify(ratingBulk));
  console.log('ABILITY:', JSON.stringify(abilityBulk));

  console.log('\n── TOP TAIL (91st-100th) — NEW-uncalibrated raw value at each percentile, OLD shown for reference ONLY, NOT to be blindly copied ──');
  console.log(String('Percentile').padEnd(12) + String('NEW raw (rating)').padEnd(20) + String('OLD live (rating, reference only)').padEnd(36) + String('NEW raw (ability)').padEnd(20) + 'OLD live (ability, reference only)');
  const ratingTail = buildAnchors(ratingPairs.map(p => p[0]), ratingPairs.map(p => p[1]), tailPoints);
  const abilityTail = buildAnchors(abilityPairs.map(p => p[0]), abilityPairs.map(p => p[1]), tailPoints);
  for (let i = 0; i < tailPoints.length; i++) {
    console.log(`p${tailPoints[i]}`.padEnd(12) + String(ratingTail[i][0]).padEnd(20) + String(ratingTail[i][1]).padEnd(36) + String(abilityTail[i][0]).padEnd(20) + String(abilityTail[i][1]));
  }

  console.log('\n── Named reference players (NEW-uncalibrated raw, for sanity-checking the tail anchors) ──');
  const NAMES = ['H. Kane', 'Kylian Mbappé', 'Aleix García', 'D. Szoboszlai', 'Bruno Fernandes', 'C. Romero', 'Carlos Romero'];
  for (const nm of NAMES) {
    const matches = rows.filter(r => String(r.name).toLowerCase().includes(nm.toLowerCase().split(' ').pop().toLowerCase()));
    for (const r of matches.slice(0, 3)) {
      const res = safeCompute(calibreRatingNEW, r);
      if (res?.rating != null) console.log(`  ${r.name} (${r.team ?? '—'})  raw=${res.rating}  ability_raw=${res.ability}`);
    }
  }

  console.log('\nNothing written. Paste the BULK anchors + a chosen TOP TAIL back for the final anchor table.');
}

run().catch(e => { console.error('\nFatal:', e?.message ?? e); process.exit(1); });
