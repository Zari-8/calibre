// scripts/clearHollowShellRatings.mjs
// One-time cleanup. Finds every row matching the hollow-shell fingerprint
// (league_id null, api_average_rating null, minutes null, stats_minutes>0)
// that currently has a non-null players.rating, and sets that rating to
// null. It does NOT touch any other column and does NOT delete any rows —
// this only removes numbers we now know are wrong.
//
// Run DRY_RUN=1 first to see exactly what would change:
//   DRY_RUN=1 SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/clearHollowShellRatings.mjs
// Then live:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/clearHollowShellRatings.mjs

import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!URL || !KEY) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const sb = createClient(URL, KEY, { auth: { persistSession: false } });
const DRY_RUN = process.env.DRY_RUN === '1';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TRANSIENT = /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|network|socket|terminated|TypeError/i;
const PAGE = 1000;

async function fetchPage(off) {
  const MAX = 5;
  for (let attempt = 1; attempt <= MAX; attempt++) {
    const { data, error } = await sb
      .from('players')
      .select('id,name,league_id,minutes,stats_minutes,api_average_rating,rating')
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

async function main() {
  console.log(DRY_RUN ? 'DRY RUN — no rows will be written.\n' : 'LIVE — clearing wrong ratings.\n');
  const toClear = [];
  let offset = 0;
  while (true) {
    const data = await fetchPage(offset);
    if (!data || data.length === 0) break;
    for (const r of data) {
      if (isHollow(r) && r.rating != null) toClear.push(r);
    }
    offset += data.length;
    process.stdout.write(`  scanned ${offset}  |  found ${toClear.length} to clear\r`);
    if (data.length < PAGE) break;
  }
  console.log(`\n\nRows with a wrong stored rating on a hollow shell: ${toClear.length}`);

  if (DRY_RUN) {
    console.log('\nSample (up to 40):');
    toClear.slice(0, 40).forEach((r) => console.log(`  ${String(r.name).padEnd(24)} id=${r.id} rating ${r.rating} -> null`));
    console.log('\nDRY RUN complete. Re-run without DRY_RUN=1 to actually clear these.');
    return;
  }

  let cleared = 0, failed = 0;
  for (const r of toClear) {
    const { error } = await sb.from('players').update({ rating: null }).eq('id', r.id);
    if (error) { failed++; if (failed <= 10) console.error(`  ✗ ${r.name} (${r.id}): ${error.message}`); }
    else cleared++;
    if ((cleared + failed) % 100 === 0) process.stdout.write(`  cleared ${cleared} / failed ${failed}\r`);
  }
  console.log(`\n\nDone. cleared=${cleared} failed=${failed}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
