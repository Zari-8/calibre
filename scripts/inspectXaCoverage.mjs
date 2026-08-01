// scripts/inspectXaCoverage.mjs — READ-ONLY. No writes.
//
// Before modeling a goalScore/create weight blend for creators (Yamal-type
// wide players), need to know whether xa/expected_assists is actually
// populated widely enough to matter. auditStatsFreshness.mjs flagged that
// xg/xa aren't reliably present on the base API-Football /players pull —
// they only arrive via a separate TheStatsAPI enrichment pass
// (enrichStatsAPI.mjs) that may not have run for every player. If xA
// coverage is thin, `create`'s assistSignal falls back to raw assists for
// most players, which undercounts a creator whose final ball is excellent
// even when a teammate misses the chance (exactly Yamal's profile).
//
// Run: node scripts/inspectXaCoverage.mjs
//      NAMES="Yamal,Salah,Vinícius" node scripts/inspectXaCoverage.mjs   (spot-check specific players)
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

async function run() {
  const NAMES = process.env.NAMES ? process.env.NAMES.split(',').map(s => s.trim()).filter(Boolean) : null;

  if (NAMES) {
    const { data, error } = await sb.from('players').select('*').or(NAMES.map(n => `name.ilike.%${n}%`).join(','));
    if (error) { console.error(error.message); process.exit(1); }
    for (const row of data ?? []) {
      if (!(row.minutes > 0) && !(row.appearances > 0)) continue;
      console.log('═'.repeat(60));
      console.log(`${row.name} (${row.team ?? '—'})  bucket=${positionBucket(row)}`);
      console.log(`  assists=${row.assists}  xa=${row.xa ?? '—'}  expected_assists=${row.expected_assists ?? '—'}`);
      console.log(`  key_passes=${row.key_passes ?? '—'}  xg=${row.xg ?? '—'}  npxg=${row.npxg ?? '—'}`);
    }
    console.log('═'.repeat(60));
    return;
  }

  console.log('Full-population xA coverage check (scored players only):\n');
  const rows = await fetchAllScored();
  const attRows = rows.filter(r => positionBucket(r) === 'ATT');
  const midRows = rows.filter(r => positionBucket(r) === 'MID');

  function coverage(pop, field1, field2) {
    const withData = pop.filter(r => (r[field1] != null && Number(r[field1]) > 0) || (r[field2] != null && Number(r[field2]) > 0));
    return { total: pop.length, withData: withData.length, pct: pop.length ? (withData.length / pop.length * 100).toFixed(1) : '0.0' };
  }

  const attXa = coverage(attRows, 'xa', 'expected_assists');
  const midXa = coverage(midRows, 'xa', 'expected_assists');
  const attKey = coverage(attRows, 'key_passes', 'key_passes');

  console.log(`ATT bucket: ${attRows.length} rows total`);
  console.log(`  xa/expected_assists populated: ${attXa.withData}/${attXa.total} (${attXa.pct}%)`);
  console.log(`  key_passes populated:          ${attKey.withData}/${attKey.total} (${attKey.pct}%)`);
  console.log(`MID bucket: ${midRows.length} rows total`);
  console.log(`  xa/expected_assists populated: ${midXa.withData}/${midXa.total} (${midXa.pct}%)`);
}

run().catch(e => { console.error('\nFatal:', e?.message ?? e); process.exit(1); });
