// scripts/scanHollowShells.mjs — READ-ONLY. Scans the whole players table for
// the "hollow TheStatsAPI-only row" fingerprint (league_id null, minutes null,
// api_average_rating null, stats_minutes > 0) and classifies each one:
//   - has a "good" sibling row (same normalized name) with real minutes/league_id
//     -> duplicate-row problem, candidate for merge/dedup
//   - no good sibling exists anywhere in the table
//     -> real enrichment gap, candidate for a fresh API-Football pass
//
// Nothing is written. Run:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/scanHollowShells.mjs

import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!URL || !KEY) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TRANSIENT = /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|network|socket|terminated|TypeError/i;
const PAGE = 1000;

const DIACRITICS_RE = new RegExp('[̀-ͯ]', 'g');
function normName(s) {
  return String(s || '')
    .normalize('NFD').replace(DIACRITICS_RE, '')
    .toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

async function fetchPage(off) {
  const MAX = 5;
  for (let attempt = 1; attempt <= MAX; attempt++) {
    const { data, error } = await sb
      .from('players')
      .select('id,name,position,league_id,api_player_id,statsapi_player_id,minutes,stats_minutes,appearances,goals,assists,api_average_rating,rating,stats_season,stats_updated_at')
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

function isHollow(r) {
  return !r.league_id && !r.api_average_rating && !(r.minutes > 0) && Number(r.stats_minutes) > 0;
}
function isGood(r) {
  return !!r.league_id && Number(r.minutes) > 0 && !!r.api_average_rating;
}

async function main() {
  console.log('Scanning players table (read-only)...\n');
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
  console.log(`\nTotal rows: ${all.length}\n`);

  const byName = new Map();
  for (const r of all) {
    const k = normName(r.name);
    if (!k) continue;
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k).push(r);
  }

  const hollow = all.filter(isHollow);
  const withSibling = [];
  const noSibling = [];

  for (const h of hollow) {
    const k = normName(h.name);
    const group = byName.get(k) || [];
    const goodSibling = group.find((r) => r.id !== h.id && isGood(r));
    if (goodSibling) withSibling.push({ hollow: h, good: goodSibling });
    else noSibling.push(h);
  }

  console.log('══════════ SUMMARY ══════════');
  console.log(`  total rows scanned:                 ${all.length}`);
  console.log(`  hollow TheStatsAPI-only rows:        ${hollow.length}`);
  console.log(`    • has a good sibling (dup problem): ${withSibling.length}`);
  console.log(`    • no good sibling (real gap):        ${noSibling.length}`);

  const goodCurrentlyLive = withSibling.filter(({ good }) => good.rating != null).length;

  console.log(`\n  of the ${withSibling.length} duplicate pairs, ${goodCurrentlyLive} good rows already have a stored rating`);
  console.log(`  (i.e. the correct number likely already exists somewhere — the hollow twin is the risk)`);

  console.log('\n────────── SAMPLE: duplicate pairs (up to 40, sorted by good.goals desc) ──────────');
  withSibling
    .sort((a, b) => (Number(b.good.goals) || 0) - (Number(a.good.goals) || 0))
    .slice(0, 40)
    .forEach(({ hollow: h, good: g }) => {
      console.log(`  ${String(h.name).padEnd(22)} hollow[${h.id.slice(0, 8)}] rating=${h.rating ?? '—'} g/a=${h.goals ?? 0}/${h.assists ?? 0}   good[${g.id.slice(0, 8)}] rating=${g.rating ?? '—'} g/a=${g.goals ?? 0}/${g.assists ?? 0} min=${g.minutes}`);
    });

  console.log('\n────────── SAMPLE: real gaps, no good row anywhere (up to 40, sorted by goals desc) ──────────');
  noSibling
    .sort((a, b) => (Number(b.goals) || 0) - (Number(a.goals) || 0))
    .slice(0, 40)
    .forEach((h) => {
      console.log(`  ${String(h.name).padEnd(22)} id[${h.id.slice(0, 8)}] rating=${h.rating ?? '—'} g/a=${h.goals ?? 0}/${h.assists ?? 0} stMin=${h.stats_minutes} apiId=${h.api_player_id} statsapiId=${h.statsapi_player_id}`);
    });

  console.log('\nDone. Nothing was written.');
}

main().catch((e) => { console.error(e); process.exit(1); });
