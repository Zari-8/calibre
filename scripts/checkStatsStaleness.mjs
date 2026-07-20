// scripts/checkStatsStaleness.mjs — READ-ONLY. No writes, no external calls.
//
// D. Seimen's api_average_rating (7.85 stored) doesn't match a fresh
// minutes-weighted recompute from the SAME raw API-Football data (7.33) —
// see inspectRawApiRating.mjs. That's not a formula bug, it's staleness:
// the stored figure was seemingly computed earlier in the season (when a
// small hot sample carried more weight) and never refreshed as his real
// season accumulated. This checks how widespread that risk is by looking at
// stats_updated_at across every scored player — old timestamps relative to
// how far into the season we are (today: mid-season 2025/26 European
// campaigns) are the players most likely carrying an early-season snapshot
// instead of a current one.
//
// Run: node scripts/checkStatsStaleness.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

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
      .select('id,name,team,api_average_rating,stats_updated_at,minutes,appearances')
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

async function run() {
  console.log('Stats staleness check — read-only.\n');
  const rows = await fetchAll();

  const withTs = rows.filter(r => r.stats_updated_at);
  const withoutTs = rows.length - withTs.length;
  console.log(`Rows: ${rows.length}   With stats_updated_at: ${withTs.length}   Missing it entirely: ${withoutTs}\n`);

  const now = Date.now();
  const buckets = [
    ['< 7 days', 0, 7],
    ['7-30 days', 7, 30],
    ['30-60 days', 30, 60],
    ['60-90 days', 60, 90],
    ['90-180 days', 90, 180],
    ['180+ days', 180, Infinity],
  ];
  const counts = buckets.map(() => 0);
  for (const r of withTs) {
    const ageDays = (now - new Date(r.stats_updated_at).getTime()) / 86400000;
    for (let i = 0; i < buckets.length; i++) {
      if (ageDays >= buckets[i][1] && ageDays < buckets[i][2]) { counts[i]++; break; }
    }
  }
  console.log('── Age of stats_updated_at ──');
  for (let i = 0; i < buckets.length; i++) {
    console.log(`  ${buckets[i][0].padEnd(12)} ${counts[i]}  (${((counts[i]/withTs.length)*100).toFixed(1)}%)`);
  }

  console.log('\n── Oldest 20 (most likely to be carrying an early-season / stale snapshot) ──');
  const sorted = [...withTs].sort((a, b) => new Date(a.stats_updated_at) - new Date(b.stats_updated_at));
  for (const r of sorted.slice(0, 20)) {
    console.log(`  ${String(r.name).padEnd(24)} ${String(r.team ?? '—').padEnd(20)} apiR=${r.api_average_rating ?? '—'}  minutes=${r.minutes ?? '—'}  updated=${r.stats_updated_at}`);
  }
}

run().catch(e => { console.error('\nFatal:', e?.message ?? e); process.exit(1); });
