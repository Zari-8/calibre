// scripts/recomputeArchetypes.mjs — recomputes every rated player's archetype
// using the real trait-based engine (src/services/playerTraits.js's
// deriveArchetype) and overwrites the stored `archetype` column.
//
// Why this is needed: the current stored archetype values weren't written by
// anything in this repo (both import scripts explicitly skip the column) —
// best guess is a one-time bulk import that used a coarse position-only
// lookup (any midfielder -> "Controller", any forward -> "Inside Forward"),
// not anything player-specific. deriveArchetype() actually looks at each
// player's real event stats, but every UI consumer does
// `player.archetype || deriveArchetype(player)`, so it never got a chance to
// run. This script runs it for real and writes the result back.
//
// Safe-by-default: DRY_RUN=1 (the default) previews every change and writes
// nothing. Pass DRY_RUN=0 to actually write.
//
// Run (one line, no quotes):
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/recomputeArchetypes.mjs
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... DRY_RUN=0 node scripts/recomputeArchetypes.mjs
// Optional:
//   WATCH="haaland,rashford,lewandowski,gavi"   comma-separated name substrings to always print

import { createClient } from '@supabase/supabase-js';
import { deriveArchetype } from '../src/services/playerTraits.js';

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!URL || !KEY) {
  console.error('Missing credentials. Run it like this (one line, no quotes):');
  console.error('  SUPABASE_URL=your_url SUPABASE_SERVICE_ROLE_KEY=your_service_key node scripts/recomputeArchetypes.mjs');
  process.exit(1);
}
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const DRY_RUN = process.env.DRY_RUN !== '0'; // safe-by-default
const WATCH = (process.env.WATCH || 'haaland,rashford,lewandowski,gavi,bellingham,neves')
  .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TRANSIENT = /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|network|socket|terminated|TypeError/i;
const PAGE = 1000;

async function fetchPage(off) {
  const MAX = 5;
  for (let attempt = 1; attempt <= MAX; attempt++) {
    const { data, error } = await sb
      .from('players')
      .select('*')
      .or('hidden.is.null,hidden.eq.false')
      .or('minutes.gt.0,appearances.gt.0,api_average_rating.gt.0')
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

// Per-row update had no retry at all — a transient "TypeError: fetch failed"
// on any single write just got logged and permanently skipped for that run,
// which is exactly what caused two consecutive live runs to bail out with a
// growing failed-count instead of powering through a network hiccup. Same
// TRANSIENT/backoff pattern as fetchPage() above.
async function updateWithRetry(id, archetype) {
  const MAX = 5;
  for (let attempt = 1; attempt <= MAX; attempt++) {
    const { error } = await sb.from('players').update({ archetype }).eq('id', id);
    if (!error) return null;
    const transient = TRANSIENT.test(String(error.message || error));
    if (!transient || attempt === MAX) return error;
    await sleep(500 * attempt);
  }
}

async function main() {
  console.log(DRY_RUN ? 'DRY RUN — no rows will be written.\n' : 'LIVE RUN — writing archetype column.\n');

  let offset = 0, scanned = 0, changed = 0, unchanged = 0, failed = 0;
  const watched = [];
  const changeCounts = new Map(); // "old -> new" tally

  while (true) {
    const data = await fetchPage(offset);
    if (!data || data.length === 0) break;

    for (const row of data) {
      scanned++;
      let next;
      try { next = deriveArchetype(row) || null; }
      catch (e) { failed++; console.warn(`✗ ${row.name}: ${e.message}`); continue; }

      const cur = row.archetype || null;
      const isWatched = WATCH.some((w) => String(row.name || '').toLowerCase().includes(w));

      if (cur === next) {
        unchanged++;
        if (isWatched) watched.push({ name: row.name, cur, next, note: 'unchanged' });
        continue;
      }

      changed++;
      const key = `${cur ?? '—'} -> ${next ?? '—'}`;
      changeCounts.set(key, (changeCounts.get(key) || 0) + 1);
      if (isWatched) watched.push({ name: row.name, cur, next, note: 'CHANGED' });

      if (!DRY_RUN) {
        const error = await updateWithRetry(row.id, next);
        if (error) { failed++; console.warn(`✗ update failed for ${row.name}: ${error.message}`); }
      }
    }

    offset += data.length;
    console.log(`  scanned ${scanned}  |  changed ${changed}  |  unchanged ${unchanged}  |  failed ${failed}`);
    if (data.length < PAGE) break;
  }

  console.log('\n══════════ SUMMARY ══════════');
  console.log(`  scanned:   ${scanned}`);
  console.log(`  changed:   ${changed}`);
  console.log(`  unchanged: ${unchanged}`);
  console.log(`  failed:    ${failed}`);

  console.log('\n────────── most common relabels ──────────');
  [...changeCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)
    .forEach(([k, n]) => console.log(`  ${String(n).padStart(5)}x  ${k}`));

  console.log('\n────────── WATCH LIST ──────────');
  if (watched.length) {
    watched.forEach((w) => console.log(`  ${String(w.name).padEnd(24)} ${String(w.cur ?? '—').padEnd(24)} -> ${String(w.next ?? '—').padEnd(24)} ${w.note}`));
  } else {
    console.log('  (no rows matched WATCH)');
  }

  console.log(DRY_RUN ? '\nDRY RUN complete. No rows were written.\nIf this looks right: DRY_RUN=0 node scripts/recomputeArchetypes.mjs' : '\nDone. Rows written.');
}

main().catch((e) => { console.error(e); process.exit(1); });
