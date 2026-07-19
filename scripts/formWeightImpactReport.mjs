// scripts/formWeightImpactReport.mjs — READ-ONLY. No writes.
//
// WHY: calibreRating.js's Form component was computed with the exact same
// formula as Performance (clamp(core*sRaw,0,100), zero independent input),
// silently double-counting season production at 55% combined weight instead
// of the intended 35%. Fixed this session by dropping Form from the weighted
// blend and redistributing its 0.20 to Consistency/Impact/Trajectory
// (WEIGHTS: Performance .35, Consistency .29, Impact .22, Trajectory .14).
// Same discipline as the earlier spine() attempt: full-database dry run
// before anything touches the live players.rating column.
//
// NOTE: quick synthetic testing before this script showed the effect size is
// much smaller than the (reverted) spine() bug — often +/-0 to 2 points,
// because most players' Consistency/Impact/Trajectory already track fairly
// close to their Performance. This is a legitimate fix for a real
// duplication bug, but may NOT be the main driver of any specific player's
// "too high" rating (e.g. Y. Diomande, whose components were closely
// clustered in the quick test). Run this to see the real distribution.
//
// This compares:
//   OLD = scripts/_tmp_old2/calibreRating.OLD.js  (Form double-counted, current shipped logic)
//   NEW = src/services/calibreRating.js            (Form excluded from weighted sum, everything else identical)
//
// Run:
//   node scripts/formWeightImpactReport.mjs
// Optional: --full to print every changed player, not just top movers.
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { calibreRating as calibreRatingNEW } from '../src/services/calibreRating.js';
import { calibreRating as calibreRatingOLD } from './_tmp_old2/calibreRating.OLD.js';

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
  console.log('Form-weight-fix impact report — DRY RUN, no writes.\n');
  const rows = await fetchAll();
  console.log(`\nScoring ${rows.length} rows with OLD (Form double-counted) and NEW (Form excluded) logic...\n`);

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

  console.log('\n── Biggest drops ──');
  for (const d of drops.slice(0, FULL ? drops.length : 20)) {
    console.log(`  ${String(d.name).padEnd(24)} ${String(d.team ?? '—').padEnd(20)} age=${String(d.age ?? '—').padEnd(3)} ${d.bucket.padEnd(3)}  ${d.old} -> ${d.new}  (${d.delta})`);
  }

  console.log('\n── Biggest gains ──');
  for (const d of gains.slice(-1 * (FULL ? gains.length : 20)).reverse()) {
    console.log(`  ${String(d.name).padEnd(24)} ${String(d.team ?? '—').padEnd(20)} age=${String(d.age ?? '—').padEnd(3)} ${d.bucket.padEnd(3)}  ${d.old} -> ${d.new}  (+${d.delta})`);
  }

  const diomande = diffs.find(d => d.name === 'Y. Diomande');
  const diomandeRow = rows.find(r => r.name === 'Y. Diomande');
  console.log('\n── Y. Diomande specifically ──');
  if (diomande) {
    console.log(`  ${diomande.old} -> ${diomande.new}  (${diomande.delta > 0 ? '+' : ''}${diomande.delta})`);
  } else if (diomandeRow) {
    const r = safeCompute(calibreRatingNEW, diomandeRow);
    console.log(`  Unchanged: ${r?.rating}`);
  } else {
    console.log('  Not found in this fetch.');
  }

  console.log(`\nNothing written. If this distribution looks right:`);
  console.log(`  node scripts/computeRatings.mjs`);
  console.log(`writes the corrected ratings/ability scores live.`);
}

run().catch(e => { console.error('\nFatal:', e?.message ?? e); process.exit(1); });
