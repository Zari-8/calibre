// scripts/spineCalibratedImpactReport.mjs — READ-ONLY. No writes.
//
// Final validation pass for the spine() fix + calibration remap (v8.7).
// Compares the CURRENTLY-LIVE engine (spine still sorted/buggy — exactly
// what's in players.rating right now) against the spine-fixed AND
// calibrated engine (src/services/calibreRating.js as it stands in the
// working tree). Unlike the first, uncalibrated attempt at this fix (which
// dropped 10,111/13,883 players, average -6.1, sent Abel Ruiz to 47), this
// version should show a MIXED distribution — some up, some down, modest
// magnitudes — because the remap preserves the live scale's overall shape
// and only corrects relative ordering.
//
// Run:
//   node scripts/spineCalibratedImpactReport.mjs
// Optional: --full to print every changed player, not just top movers.
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

const FULL = process.argv.includes('--full') || process.env.FULL === '1';
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

async function run() {
  console.log('Spine-fix + calibration final impact report — DRY RUN, no writes.\n');
  const rows = await fetchAll();
  console.log(`\nScoring ${rows.length} rows with OLD (live) and NEW (spine-fixed, calibrated)...\n`);

  const diffs = [];
  let unchanged = 0, noEvidence = 0;

  for (const row of rows) {
    const oldRes = safeCompute(calibreRatingOLD, row);
    const newRes = safeCompute(calibreRatingNEW, row);
    const oldR = oldRes && oldRes.rating != null ? Math.round(oldRes.rating) : null;
    const newR = newRes && newRes.rating != null ? Math.round(newRes.rating) : null;
    if (oldR == null && newR == null) { noEvidence++; continue; }
    const delta = (newR ?? 0) - (oldR ?? 0);
    if (delta === 0) { unchanged++; continue; }
    diffs.push({
      id: row.id, name: row.name, team: row.team, age: row.age,
      bucket: newRes?.bucket ?? oldRes?.bucket,
      old: oldR, new: newR, delta,
    });
  }

  diffs.sort((a, b) => a.delta - b.delta);

  const gains = diffs.filter(d => d.delta > 0);
  const drops = diffs.filter(d => d.delta < 0);
  const avgGain = gains.length ? (gains.reduce((s, d) => s + d.delta, 0) / gains.length).toFixed(1) : '0';
  const avgDrop = drops.length ? (drops.reduce((s, d) => s + d.delta, 0) / drops.length).toFixed(1) : '0';
  const maxDrop = drops.length ? Math.min(...drops.map(d => d.delta)) : 0;
  const maxGain = gains.length ? Math.max(...gains.map(d => d.delta)) : 0;

  console.log('── Summary ──');
  console.log(`  Rows scored:        ${rows.length}`);
  console.log(`  No evidence:        ${noEvidence}`);
  console.log(`  Unchanged:          ${unchanged}`);
  console.log(`  Changed:            ${diffs.length}  (${gains.length} up, ${drops.length} down)`);
  console.log(`  Avg move when up:   +${avgGain}   (max +${maxGain})`);
  console.log(`  Avg move when down: ${avgDrop}   (max ${maxDrop})`);

  // Distribution shape check — this is the thing that broke last time.
  const oldRatings = rows.map(r => safeCompute(calibreRatingOLD, r)?.rating).filter(v => v != null);
  const newRatings = rows.map(r => safeCompute(calibreRatingNEW, r)?.rating).filter(v => v != null);
  function pct(arr, p) {
    const s = [...arr].sort((a, b) => a - b);
    const idx = Math.round((p / 100) * (s.length - 1));
    return s[idx];
  }
  console.log('\n── Distribution shape (should closely track between OLD and NEW) ──');
  for (const p of [1, 10, 25, 50, 75, 90, 99, 100]) {
    console.log(`  p${p}:  OLD ${pct(oldRatings, p)}   NEW ${pct(newRatings, p)}`);
  }

  console.log('\n── Biggest drops ──');
  for (const d of drops.slice(0, FULL ? drops.length : 20)) {
    console.log(`  ${String(d.name).padEnd(24)} ${String(d.team ?? '—').padEnd(20)} age=${String(d.age ?? '—').padEnd(3)} ${d.bucket.padEnd(3)}  ${d.old} -> ${d.new}  (${d.delta})`);
  }

  console.log('\n── Biggest gains ──');
  for (const d of gains.slice(-1 * (FULL ? gains.length : 20)).reverse()) {
    console.log(`  ${String(d.name).padEnd(24)} ${String(d.team ?? '—').padEnd(20)} age=${String(d.age ?? '—').padEnd(3)} ${d.bucket.padEnd(3)}  ${d.old} -> ${d.new}  (+${d.delta})`);
  }

  for (const watchName of ['Y. Diomande', 'R. Lewandowski', 'Ferran Torres']) {
    const d = diffs.find(x => x.name === watchName);
    const row = rows.find(x => x.name === watchName);
    console.log(`\n── ${watchName} ──`);
    if (d) console.log(`  ${d.old} -> ${d.new}  (${d.delta > 0 ? '+' : ''}${d.delta})`);
    else if (row) console.log(`  Unchanged: ${safeCompute(calibreRatingNEW, row)?.rating}`);
    else console.log('  Not found.');
  }

  console.log(`\nNothing written. If this distribution shape and the drops/gains look right:`);
  console.log(`  node scripts/computeRatings.mjs`);
  console.log(`writes it live.`);
}

run().catch(e => { console.error('\nFatal:', e?.message ?? e); process.exit(1); });
