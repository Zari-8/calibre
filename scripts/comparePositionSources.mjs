// scripts/comparePositionSources.mjs — READ-ONLY. Once enrichPlayerStats.mjs
// and enrichStatsAPI.mjs have run and populated api_position / statsapi_position,
// this shows how those two independent, real per-match sources agree or
// disagree with each other AND with whatever is already stored in
// position/pos/primary_role/raw_position — before anything gets overwritten.
//
// Run (one line, no quotes):
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/comparePositionSources.mjs

import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!URL || !KEY) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TRANSIENT = /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|network|socket|terminated|TypeError/i;
const PAGE = 1000;

function bucketOf(word) {
  const t = String(word || '').toLowerCase();
  if (/goalkeeper|keeper/.test(t)) return 'GK';
  if (/defender|back/.test(t)) return 'DEF';
  if (/forward|striker|attack/.test(t)) return 'ATT';
  if (t) return 'MID';
  return null;
}

async function fetchPage(off) {
  const MAX = 5;
  for (let attempt = 1; attempt <= MAX; attempt++) {
    const { data, error } = await sb
      .from('players')
      .select('id,name,position,pos,primary_role,raw_position,api_position,statsapi_position,statsapi_position_counts,minutes,rating')
      .or('api_position.not.is.null,statsapi_position.not.is.null')
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

function fmt(v, w) { return String(v == null ? '—' : v).padEnd(w); }

async function main() {
  console.log('POSITION SOURCE COMPARISON — read-only.\n');
  const all = [];
  let offset = 0;
  while (true) {
    const data = await fetchPage(offset);
    if (!data || data.length === 0) break;
    all.push(...data);
    offset += data.length;
    if (data.length < PAGE) break;
  }
  console.log(`Rows with at least one new-source position: ${all.length}\n`);

  let bothPresent = 0, agree = 0, disagree = 0, storedDisagreesWithBoth = 0;
  const disagreements = [];

  for (const r of all) {
    const storedBucket = bucketOf(r.raw_position || r.primary_role || r.position || r.pos);
    const apiBucket = bucketOf(r.api_position);
    const statsapiBucket = bucketOf(r.statsapi_position);

    if (apiBucket && statsapiBucket) {
      bothPresent++;
      if (apiBucket === statsapiBucket) agree++; else disagree++;
      if (storedBucket && apiBucket === statsapiBucket && storedBucket !== apiBucket) {
        storedDisagreesWithBoth++;
        disagreements.push({ name: r.name, stored: storedBucket, api: apiBucket, statsapi: statsapiBucket, counts: r.statsapi_position_counts });
      }
    }
  }

  console.log('══════════ SUMMARY (rows with BOTH api_position and statsapi_position) ══════════');
  console.log(`  both present:                          ${bothPresent}`);
  console.log(`  api_position === statsapi_position:     ${agree}`);
  console.log(`  disagree with each other:                ${disagree}`);
  console.log(`  BOTH agree but disagree with the STORED position (the interesting ones): ${storedDisagreesWithBoth}`);

  console.log('\n────────── stored-position looks wrong (both new sources agree, differ from stored) ──────────');
  disagreements.slice(0, 40).forEach((d) => {
    console.log(`  ${fmt(d.name, 24)} stored:${fmt(d.stored, 6)} api+statsapi agree:${fmt(d.api, 6)} counts:${JSON.stringify(d.counts)}`);
  });

  console.log('\nDone. No rows were written.');
}

main().catch((e) => { console.error(e); process.exit(1); });
