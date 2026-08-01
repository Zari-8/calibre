// scripts/checkEnrichmentGaps.mjs — READ-ONLY. No writes.
//
// After the full-season enrichStatsAPI.mjs live sweep (6940 matches, 217496
// enriched, 331 update errors / 24 match errors clustered in 4 weeks:
// 2025-08-08→08-14, 2025-10-24→10-30, 2025-12-05→12-11, 2026-01-16→01-22),
// need to know how many players actually still have a gap versus how many
// self-healed. Self-heal logic: enrichStatsAPI writes each player's FULL
// season-to-date cumulative total (not a delta) every time they're touched,
// so a failed write in one week is superseded by any LATER successful write
// for that same player. Only players whose very last touch in the whole
// range also failed (or who NEVER wrote successfully even once) have a real
// gap. statsapi_enriched_at is stamped on every successful write, so:
//   - statsapi_enriched_at IS NULL + minutes/appearances > 0 → never wrote
//     successfully even once. Worst case, fully untouched by the sweep.
//   - statsapi_enriched_at IS SET but xg/xa are 0/null → wrote successfully
//     at some point, but that snapshot may predate matches they played
//     later (can't fully rule out from this alone, but combined with the
//     coverage-% swing vs. the pre-sweep baseline this tells us the real
//     scale).
//
// Run: node scripts/checkEnrichmentGaps.mjs
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

const PAGE = 1000;

async function fetchAllScored() {
  const rows = [];
  let offset = 0;
  while (true) {
    const { data, error } = await sb.from('players').select('*')
      .or('minutes.gt.0,appearances.gt.0,api_average_rating.gt.0')
      .order('id', { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) { console.error('Fetch failed:', error.message); process.exit(1); }
    if (!data?.length) break;
    rows.push(...data);
    offset += data.length;
    process.stdout.write(`\r  fetched ${rows.length} rows...`);
    if (data.length < PAGE) break;
  }
  process.stdout.write('\n');
  return rows;
}

function coverage(pop, field1, field2) {
  const withData = pop.filter(r => (r[field1] != null && Number(r[field1]) > 0) || (r[field2] != null && Number(r[field2]) > 0));
  return { total: pop.length, withData: withData.length, pct: pop.length ? (withData.length / pop.length * 100).toFixed(1) : '0.0' };
}

async function run() {
  console.log('Post-sweep enrichment gap check (scored players only):\n');
  const rows = await fetchAllScored();

  const neverEnriched = rows.filter(r => !r.statsapi_enriched_at);
  const everEnriched = rows.filter(r => r.statsapi_enriched_at);

  console.log(`Total scored players: ${rows.length}`);
  console.log(`  statsapi_enriched_at SET (touched by sweep at least once): ${everEnriched.length} (${(everEnriched.length / rows.length * 100).toFixed(1)}%)`);
  console.log(`  statsapi_enriched_at NULL (never wrote successfully):      ${neverEnriched.length} (${(neverEnriched.length / rows.length * 100).toFixed(1)}%)`);

  // Regulars (meaningful minutes) who were NEVER touched at all — the
  // genuinely worst-case group, most worth a targeted look.
  const neverEnrichedRegulars = neverEnriched
    .filter(r => (r.minutes || 0) >= 450) // ~5 full matches
    .sort((a, b) => (b.minutes || 0) - (a.minutes || 0));

  console.log(`\n  Of those never-enriched, played 450+ minutes (real regulars): ${neverEnrichedRegulars.length}`);
  if (neverEnrichedRegulars.length) {
    console.log('  Top 20 by minutes:');
    for (const r of neverEnrichedRegulars.slice(0, 20)) {
      console.log(`    ${r.name} (${r.team ?? '—'}) — ${r.minutes} min, bucket=${positionBucket(r)}`);
    }
  }

  console.log('\n── xA/xG coverage now vs. pre-sweep baseline (31.8% ATT / 22.3% MID) ──');
  const attRows = rows.filter(r => positionBucket(r) === 'ATT');
  const midRows = rows.filter(r => positionBucket(r) === 'MID');
  const attXa = coverage(attRows, 'xa', 'expected_assists');
  const midXa = coverage(midRows, 'xa', 'expected_assists');
  console.log(`ATT bucket: ${attXa.withData}/${attXa.total} (${attXa.pct}%)`);
  console.log(`MID bucket: ${midXa.withData}/${midXa.total} (${midXa.pct}%)`);

  console.log('\n── enriched-but-zero-xG (wrote successfully, but xg/xa both 0 — could be legit or a stale early-season-only snapshot) ──');
  const enrichedZeroXg = everEnriched.filter(r => !(Number(r.xg) > 0) && !(Number(r.xa) > 0) && (r.minutes || 0) >= 450);
  console.log(`  Regulars (450+ min) with statsapi_enriched_at set but xg=0 and xa=0: ${enrichedZeroXg.length}`);
  if (enrichedZeroXg.length) {
    console.log('  Top 20 by minutes (check statsapi_enriched_at date — early = likely stale/incomplete):');
    for (const r of enrichedZeroXg.sort((a, b) => (b.minutes || 0) - (a.minutes || 0)).slice(0, 20)) {
      console.log(`    ${r.name} (${r.team ?? '—'}) — ${r.minutes} min, enriched_at=${r.statsapi_enriched_at}`);
    }
  }
}

run().catch(e => { console.error('\nFatal:', e?.message ?? e); process.exit(1); });
