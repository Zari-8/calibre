// scripts/hideDuplicateHollowShells.mjs
// Sets players.hidden = true on hollow TheStatsAPI-only rows that have a
// correctly-enriched sibling (same normalized name) — the exact "duplicate
// pair" bucket from scanHollowShells.mjs. Rows with NO good sibling (the
// real-gap bucket — Bellingham, Lewandowski, etc.) are left untouched and
// stay visible, since they're the only row for that player.
//
// REQUIRES: supabase/migrations/20260708_players_hidden_flag.sql run first
// (adds the `hidden` column). This script will error clearly if it hasn't.
//
// Run DRY_RUN=1 first:
//   DRY_RUN=1 SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/hideDuplicateHollowShells.mjs
// Then live:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/hideDuplicateHollowShells.mjs

import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!URL || !KEY) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const sb = createClient(URL, KEY, { auth: { persistSession: false } });
const DRY_RUN = process.env.DRY_RUN === '1';

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
      .select('id,name,league_id,minutes,stats_minutes,api_average_rating,rating,hidden')
      .order('id', { ascending: true })
      .range(off, off + PAGE - 1);
    if (!error) return data;
    if (/column .*hidden.* does not exist/i.test(String(error.message))) {
      console.error('\nThe `hidden` column does not exist yet. Run supabase/migrations/20260708_players_hidden_flag.sql in the Supabase SQL editor first, then re-run this script.');
      process.exit(1);
    }
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
  console.log(DRY_RUN ? 'DRY RUN — no rows will be written.\n' : 'LIVE — hiding duplicate hollow shells.\n');
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

  const toHide = [];
  for (const h of all.filter(isHollow)) {
    if (h.hidden) continue; // already hidden
    const group = byName.get(normName(h.name)) || [];
    const goodSibling = group.find((r) => r.id !== h.id && isGood(r));
    if (goodSibling) toHide.push({ hollow: h, good: goodSibling });
  }

  console.log(`\nHollow rows to hide (have a good sibling, not already hidden): ${toHide.length}`);
  console.log('\nSample (up to 30):');
  toHide.slice(0, 30).forEach(({ hollow: h, good: g }) =>
    console.log(`  ${String(h.name).padEnd(24)} hide[${h.id.slice(0, 8)}]  keep-visible[${g.id.slice(0, 8)}] rating=${g.rating}`));

  if (DRY_RUN) {
    console.log('\nDRY RUN complete. Re-run without DRY_RUN=1 to actually set hidden=true on these.');
    return;
  }

  let hidden = 0, failed = 0;
  for (const { hollow: h } of toHide) {
    const { error } = await sb.from('players').update({ hidden: true }).eq('id', h.id);
    if (error) { failed++; if (failed <= 10) console.error(`  ✗ ${h.name} (${h.id}): ${error.message}`); }
    else hidden++;
    if ((hidden + failed) % 50 === 0) process.stdout.write(`  hidden ${hidden} / failed ${failed}\r`);
  }
  console.log(`\n\nDone. hidden=${hidden} failed=${failed}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
