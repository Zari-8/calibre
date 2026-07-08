// scripts/listRealGapPlayers.mjs — READ-ONLY. Reproduces the "real gap"
// bucket from scanHollowShells.mjs (hollow TheStatsAPI-only row, no good
// sibling anywhere) and prints a ready-to-use TARGET_UUIDS list for
// enrichPlayerStats.mjs, plus nationality coverage (RESOLVE_IDS needs it).

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
  return String(s || '').normalize('NFD').replace(DIACRITICS_RE, '')
    .toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

async function fetchPage(off) {
  const MAX = 5;
  for (let attempt = 1; attempt <= MAX; attempt++) {
    const { data, error } = await sb
      .from('players')
      .select('id,name,nationality,age,league_id,api_player_id,statsapi_player_id,minutes,stats_minutes,appearances,goals,assists,api_average_rating,rating')
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

function isHollow(r) { return !r.league_id && !r.api_average_rating && !(r.minutes > 0) && Number(r.stats_minutes) > 0; }
function isGood(r) { return !!r.league_id && Number(r.minutes) > 0 && !!r.api_average_rating; }

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
  console.log(`\nTotal rows: ${all.length}`);

  const byName = new Map();
  for (const r of all) {
    const k = normName(r.name);
    if (!k) continue;
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k).push(r);
  }

  const noSibling = all.filter(isHollow).filter((h) => {
    const group = byName.get(normName(h.name)) || [];
    return !group.some((r) => r.id !== h.id && isGood(r));
  });

  const hasNationality = noSibling.filter((r) => normName(r.nationality)).length;
  const hasApiId = noSibling.filter((r) => Number(r.api_player_id) > 0).length;

  console.log(`\n══════════ REAL-GAP PLAYERS: ${noSibling.length} ══════════`);
  console.log(`  have a stored nationality (RESOLVE_IDS can attempt a name match): ${hasNationality}`);
  console.log(`  have a non-null api_player_id (initial ladder walk will run):     ${hasApiId}`);
  console.log(`  have NEITHER (name-search will run blind, likely no match):       ${noSibling.length - hasNationality}`);

  const uuidList = noSibling.map((r) => r.id).join(',');
  console.log(`\nTARGET_UUIDS list (${noSibling.length} ids) written to real-gap-uuids.txt`);

  const fs = await import('fs');
  fs.writeFileSync(new URL('../real-gap-uuids.txt', import.meta.url), uuidList);

  console.log('\nSample without nationality (up to 25 — these will only get help from a fresh manual PLAYER_IDS lookup, not RESOLVE_IDS):');
  noSibling.filter((r) => !normName(r.nationality)).slice(0, 25)
    .forEach((r) => console.log(`  ${String(r.name).padEnd(24)} id=${r.id} apiId=${r.api_player_id ?? '—'}`));
}

main().catch((e) => { console.error(e); process.exit(1); });
