// scripts/apiRByBucket.mjs — READ-ONLY. No writes.
//
// Tests a specific hypothesis about the GK over-rating Zari just caught
// ("top 4 GKs... looks more like a game rating than season rating"): the
// engine's qFlat()/Q_ANCHORS was built from api_average_rating across the
// WHOLE population (assessApiRatingDistribution.mjs, ~10,245 rows, no
// position split mentioned) — but two things stack badly for keepers
// specifically:
//   1. GK production falls back to production = q*0.9 + buildNudge for the
//      67% of GK rows with no saves/goals_conceded on record (confirmed via
//      gkRatingCheck.mjs) — i.e. 90% of their score IS q, vs outfield
//      players where q is only a 24% blend on top of independent per-90
//      production stats. A bad/hot apiR has ~4x the leverage on a GK's
//      score that it has on an outfield player's.
//   2. If goalkeepers' api_average_rating runs on a structurally different
//      (probably higher — clean-sheet bonus effects, fewer rated actions
//      per match, small-sample keepers at weak schedules) distribution than
//      outfield players', then the SAME Q_ANCHORS (calibrated mostly off
//      the outfield-heavy population) over-credits GK apiR relative to
//      where it actually sits in the GK-only population.
//
// This prints percentile comparisons of raw api_average_rating for GK vs
// non-GK, so we know whether to build a GK-specific qFlat() or whether the
// real fix is just capping the fallback's reliance on q.
//
// Run: node scripts/apiRByBucket.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { positionBucket } from '../src/services/calibreRating.js';

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
      .gt('api_average_rating', 0)
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

function pct(arr, p) {
  const s = [...arr].sort((a, b) => a - b);
  if (!s.length) return null;
  const idx = Math.round((p / 100) * (s.length - 1));
  return s[idx];
}

async function run() {
  console.log('api_average_rating distribution by bucket — read-only.\n');
  const rows = await fetchAll();

  const gk = [], outfield = [];
  for (const r of rows) {
    const bucket = positionBucket(r);
    const apiR = Number(r.api_average_rating);
    if (!Number.isFinite(apiR)) continue;
    (bucket === 'GK' ? gk : outfield).push(apiR);
  }

  console.log(`GK rows: ${gk.length}   Outfield rows: ${outfield.length}\n`);
  console.log(String('Percentile').padEnd(12) + String('GK apiR').padEnd(12) + 'Outfield apiR');
  for (const p of [1, 10, 25, 50, 75, 90, 95, 99, 100]) {
    console.log(`p${p}`.padEnd(12) + String(pct(gk, p) ?? '—').padEnd(12) + String(pct(outfield, p) ?? '—'));
  }

  const gkMean = gk.reduce((a, b) => a + b, 0) / gk.length;
  const ofMean = outfield.reduce((a, b) => a + b, 0) / outfield.length;
  console.log(`\nMean: GK ${gkMean.toFixed(3)}   Outfield ${ofMean.toFixed(3)}   Diff ${(gkMean - ofMean).toFixed(3)}`);

  console.log('\n── Top 15 GK apiR values on record ──');
  const gkRows = rows.filter(r => positionBucket(r) === 'GK' && Number(r.api_average_rating) > 0)
    .sort((a, b) => Number(b.api_average_rating) - Number(a.api_average_rating));
  for (const r of gkRows.slice(0, 15)) {
    console.log(`  ${r.api_average_rating}  ${String(r.name).padEnd(22)} ${r.team ?? '—'}  minutes=${r.minutes ?? '—'}`);
  }
}

run().catch(e => { console.error('\nFatal:', e?.message ?? e); process.exit(1); });
