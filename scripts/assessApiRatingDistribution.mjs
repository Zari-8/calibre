// scripts/assessApiRatingDistribution.mjs — READ-ONLY. Pulls the distribution
// of api_average_rating across rated players so qFlat() can be recalibrated
// against real data instead of a guess. Also reports the current qFlat(x)
// output at each percentile so the compression is visible directly.

import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!URL || !KEY) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TRANSIENT = /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|network|socket|terminated|TypeError/i;
const PAGE = 1000;

function qFlat(apiR) { return apiR > 0 ? Math.max(0, Math.min(100, 42 + (apiR - 6.9) * 25)) : 46; }

async function fetchPage(off) {
  const MAX = 5;
  for (let attempt = 1; attempt <= MAX; attempt++) {
    const { data, error } = await sb
      .from('players')
      .select('id,name,minutes,api_average_rating,rating')
      .not('rating', 'is', null)
      .not('api_average_rating', 'is', null)
      .gt('api_average_rating', 0)
      .order('id', { ascending: true })
      .range(off, off + PAGE - 1);
    if (!error) return data;
    const transient = TRANSIENT.test(String(error.message || error));
    if (!transient || attempt === MAX) { console.error('Fetch failed:', error.message || error); process.exit(1); }
    const wait = 1000 * attempt;
    console.warn(`  ↻ page @${off}: ${error.message || error} — retry ${attempt}/${MAX - 1} in ${wait}ms`);
    await sleep(wait);
  }
}

function pct(sorted, p) {
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

async function main() {
  console.log('Scanning rated players with api_average_rating (read-only)...\n');
  const all = [];
  let offset = 0;
  while (true) {
    const data = await fetchPage(offset);
    if (!data || data.length === 0) break;
    all.push(...data);
    offset += data.length;
    process.stdout.write(`  loaded ${all.length}\r`);
    if (data.length < PAGE) break;
  }
  console.log(`\nTotal: ${all.length}`);

  const vals = all.map((r) => Number(r.api_average_rating)).filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  const mean = vals.reduce((s, v) => s + v, 0) / vals.length;

  console.log('\n══════════ api_average_rating DISTRIBUTION ══════════');
  console.log(`  n:        ${vals.length}`);
  console.log(`  mean:     ${mean.toFixed(3)}`);
  console.log(`  min:      ${vals[0].toFixed(2)}`);
  console.log(`  p10:      ${pct(vals, 10).toFixed(2)}   -> current qFlat = ${qFlat(pct(vals, 10)).toFixed(1)}`);
  console.log(`  p25:      ${pct(vals, 25).toFixed(2)}   -> current qFlat = ${qFlat(pct(vals, 25)).toFixed(1)}`);
  console.log(`  p50:      ${pct(vals, 50).toFixed(2)}   -> current qFlat = ${qFlat(pct(vals, 50)).toFixed(1)}`);
  console.log(`  p75:      ${pct(vals, 75).toFixed(2)}   -> current qFlat = ${qFlat(pct(vals, 75)).toFixed(1)}`);
  console.log(`  p90:      ${pct(vals, 90).toFixed(2)}   -> current qFlat = ${qFlat(pct(vals, 90)).toFixed(1)}`);
  console.log(`  p95:      ${pct(vals, 95).toFixed(2)}   -> current qFlat = ${qFlat(pct(vals, 95)).toFixed(1)}`);
  console.log(`  p99:      ${pct(vals, 99).toFixed(2)}   -> current qFlat = ${qFlat(pct(vals, 99)).toFixed(1)}`);
  console.log(`  max:      ${vals[vals.length - 1].toFixed(2)}   -> current qFlat = ${qFlat(vals[vals.length - 1]).toFixed(1)}`);

  console.log('\n────────── Top 20 by api_average_rating (min >= 900) ──────────');
  all.filter((r) => Number(r.minutes) >= 900)
    .sort((a, b) => Number(b.api_average_rating) - Number(a.api_average_rating))
    .slice(0, 20)
    .forEach((r) => console.log(`  ${String(r.name).padEnd(22)} apiR=${r.api_average_rating}  min=${r.minutes}  rating=${r.rating}  qFlat=${qFlat(Number(r.api_average_rating)).toFixed(1)}`));

  console.log('\nDone.');
}

main().catch((e) => { console.error(e); process.exit(1); });
