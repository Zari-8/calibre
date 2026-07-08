// scripts/computeRatingsDryRun.mjs
// ─────────────────────────────────────────────────────────────────────────
// Calibre — re-rating DRY RUN (read-only).
//
// This is the safe preview of what `computeRatings.mjs` WOULD do. It runs the
// exact same fetch and the exact same shipping engine (calibreRating), but it
// NEVER writes: there is deliberately no .update()/.upsert() anywhere in this
// file, so it cannot change a single row. Use it to see who moves — and by how
// much — BEFORE you run the real pass.
//
// It answers the question we care about: now that players carry the new
// statsapi_* enrichment, do the ratings the engine already consumes (duel %,
// dribbles, etc.) actually shift — and in which direction — for the players you
// flagged (Gavi, João Neves) and for everyone else.
//
// Output:
//   • headline counts (scored / would-change / newly-rated / unchanged)
//   • delta distribution (how many move by >=1, >=3, >=5)
//   • the biggest upward and downward movers
//   • a WATCH list you can set (defaults to Gavi / João Neves)
//
// Run (one line, no quotes):
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/computeRatingsDryRun.mjs
// Optional:
//   TOP=40         how many movers to print each way (default 30)
//   WATCH="gavi,joão neves,joao neves,pedri"   comma-separated name substrings
// ─────────────────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js';
import { calibreRating } from '../src/services/calibreRating.js';

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!URL || !KEY) {
  console.error('Missing credentials. Run it like this (one line, no quotes):');
  console.error('  SUPABASE_URL=your_url SUPABASE_SERVICE_ROLE_KEY=your_service_key node scripts/computeRatingsDryRun.mjs');
  process.exit(1);
}

const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const PAGE = 1000;
const TOP = Number(process.env.TOP || 30);
const WATCH = (process.env.WATCH || 'gavi,joão neves,joao neves,neves')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

let offset = 0;
let scored = 0, skipped = 0, newlyRated = 0, unchanged = 0, changed = 0;
const buckets = { d1: 0, d3: 0, d5: 0 };            // |delta| >= 1 / 3 / 5 (re-rated rows only)
const movers = [];                                   // { id, name, position, minutes, current, next, delta }
const newborns = [];                                 // null -> number
const watched = [];                                  // rows matching WATCH

function fmt(v, w) { return String(v == null ? '—' : v).padEnd(w); }

function record(row) {
  const res = calibreRating(row);
  const next = res && res.rating != null ? Math.round(res.rating) : null;

  const nameL = String(row.name || '').toLowerCase();
  const isWatched = WATCH.some(w => nameL.includes(w));

  if (next == null) {
    skipped++;
    if (isWatched) watched.push({ name: row.name, current: row.rating, next: null, delta: null, note: 'no evidence (would stay null)' });
    return;
  }
  scored++;

  const cur = row.rating == null ? null : Number(row.rating);
  if (cur == null) {
    newlyRated++;
    const entry = { id: row.id, name: row.name, position: row.position, minutes: row.minutes, current: null, next, delta: null };
    newborns.push(entry);
    if (isWatched) watched.push({ ...entry, note: 'newly rated (was null)' });
    return;
  }

  const delta = next - cur;
  const entry = { id: row.id, name: row.name, position: row.position, minutes: row.minutes, current: cur, next, delta };
  if (isWatched) watched.push({ ...entry, note: 're-rated' });

  if (delta === 0) { unchanged++; return; }
  changed++;
  const a = Math.abs(delta);
  if (a >= 1) buckets.d1++;
  if (a >= 3) buckets.d3++;
  if (a >= 5) buckets.d5++;
  movers.push(entry);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TRANSIENT = /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|network|socket|terminated|TypeError/i;

async function fetchPage(off) {
  const MAX = 5;
  for (let attempt = 1; attempt <= MAX; attempt++) {
    const { data, error } = await sb
      .from('players')
      .select('*')
      .or('minutes.gt.0,appearances.gt.0,api_average_rating.gt.0') // identical to computeRatings.mjs
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

async function run() {
  console.log('RE-RATING DRY RUN — read-only, nothing will be written.\n');
  while (true) {
    const data = await fetchPage(offset);
    if (!data || data.length === 0) break;

    for (const row of data) record(row);

    offset += data.length;
    console.log(`  processed ${offset}  |  scored ${scored}  |  would-change ${changed}  |  newly-rated ${newlyRated}  |  skipped ${skipped}`);
    if (data.length < PAGE) break;
  }

  const up = movers.filter(m => m.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, TOP);
  const down = movers.filter(m => m.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, TOP);
  const absMean = movers.length ? (movers.reduce((s, m) => s + Math.abs(m.delta), 0) / movers.length) : 0;

  console.log('\n══════════ SUMMARY ══════════');
  console.log(`  scored (have a real rating):      ${scored}`);
  console.log(`  would CHANGE:                     ${changed}`);
  console.log(`     • move up:                     ${movers.filter(m => m.delta > 0).length}`);
  console.log(`     • move down:                   ${movers.filter(m => m.delta < 0).length}`);
  console.log(`  newly rated (null -> number):     ${newlyRated}`);
  console.log(`  unchanged:                        ${unchanged}`);
  console.log(`  skipped (no evidence, stay null): ${skipped}`);
  console.log(`  mean |delta| among movers:        ${absMean.toFixed(2)}`);
  console.log(`  movers by size:  >=1: ${buckets.d1}   >=3: ${buckets.d3}   >=5: ${buckets.d5}`);

  const line = m => `  ${fmt(m.name, 24)} ${fmt(m.position, 6)} min ${fmt(m.minutes, 6)}  ${fmt(m.current, 4)} -> ${fmt(m.next, 4)}  (${m.delta > 0 ? '+' : ''}${m.delta})`;

  console.log(`\n────────── BIGGEST RISERS (top ${TOP}) ──────────`);
  if (up.length) up.forEach(m => console.log(line(m))); else console.log('  (none)');

  console.log(`\n────────── BIGGEST FALLERS (top ${TOP}) ──────────`);
  if (down.length) down.forEach(m => console.log(line(m))); else console.log('  (none)');

  console.log(`\n────────── WATCH LIST ──────────`);
  if (watched.length) {
    for (const w of watched) {
      const d = w.delta == null ? '' : `  (${w.delta > 0 ? '+' : ''}${w.delta})`;
      console.log(`  ${fmt(w.name, 24)} ${fmt(w.current, 4)} -> ${fmt(w.next, 4)}${d}   ${w.note}`);
    }
  } else {
    console.log('  (no rows matched WATCH — check the names/spelling; try WATCH="pablo gavi,neves")');
  }

  console.log('\nDRY RUN complete. No rows were written.');
  console.log('If this looks right, the live pass is:  node scripts/computeRatings.mjs');
}

run().catch((e) => { console.error(e); process.exit(1); });
