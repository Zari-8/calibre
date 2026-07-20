// scripts/computeRatings.mjs
// ─────────────────────────────────────────────────────────────────────────
// Calibre — canonical rating backfill.
//
// THE FIX: every surface currently recomputes calibreRating() live because
// players.rating is null. Different surfaces feed the engine different stat
// shapes, so the same player shows different numbers (modal 63 vs transfer 67).
//
// This script computes calibreRating() ONCE per real players row using the SAME
// engine the app ships, and writes the result to players.rating. After this,
// the modal and the transfer hero both read that one stored value — they can no
// longer disagree.
//
// It is idempotent: re-running only updates rows whose number actually changed.
// Rows with no evidence (the thin duplicate shells) score null and are skipped,
// so they never get a misleading stored rating.
//
// v2 — dual-score split. players.rating alone conflated "how good is this
// player" with "how much did he play this season" (Consistency/Impact fold
// selection/minutes into the same number as production quality). Real case:
// Ansu Fati, 11 goals in 1086 minutes at Monaco — Season score 73 vs Ability
// 80, because Availability (39) reflects a 40% start-rate, not his skill.
// Now also writes ability_rating (production+quality only, decoupled from
// selection) and availability_score (the season-workload/reliability signal
// that used to be silently baked into rating) — see
// supabase/migrations/20260713_ability_and_availability_scores.sql.
//
// Run:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/computeRatings.mjs
// ─────────────────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { calibreRating } from '../src/services/calibreRating.js';

// Load SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from .env / .env.local in the
// repo root if present — same loader every other script in this session uses.
// This script never had it, which is why it demanded credentials be typed
// inline even though .env.local already has them.
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

if (!URL || !KEY) {
  console.error('Missing credentials. Run it like this (one line, no quotes):');
  console.error('  SUPABASE_URL=your_url SUPABASE_SERVICE_ROLE_KEY=your_service_key node scripts/computeRatings.mjs');
  console.error('\nThe service_role key is in Supabase dashboard -> Project Settings -> API -> service_role (secret).');
  process.exit(1);
}

const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const PAGE = 400;         // rows fetched per page (was 1000 — smaller pages after a statement-timeout ship attempt)
const CONCURRENCY = 20;   // parallel updates
let offset = 0, scored = 0, updated = 0, skipped = 0, failed = 0;

async function processRow(row) {
  const res = calibreRating(row);
  const rating = res && res.rating != null ? Math.round(res.rating) : null;
  if (rating == null) { skipped++; return; }      // no evidence (thin shell) -> leave null
  scored++;

  const ability = res.ability != null ? Math.round(res.ability) : null;
  const availability = res.availability != null ? Math.round(res.availability) : null;

  const changed = Number(row.rating) !== rating
    || Number(row.ability_rating) !== ability
    || Number(row.availability_score) !== availability;
  if (!changed) return;                            // already correct -> no write

  const { error } = await sb.from('players')
    .update({ rating, ability_rating: ability, availability_score: availability })
    .eq('id', row.id);
  if (error) { failed++; if (failed <= 10) console.error('  update failed for', row.id, '-', error.message); }
  else updated++;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Postgres statement-timeout errors ("canceling statement due to statement
// timeout") were falling through this regex entirely, so a single slow page
// (select('*') on 1000 rows incl. the competition_splits JSON blob) killed
// the whole run instantly instead of retrying — this is exactly what
// happened on the v8.7 ship attempt. Treated as transient now, same as the
// network errors; PAGE also dropped 1000->400 below so pages are cheaper to
// re-fetch and less likely to time out in the first place.
const TRANSIENT = /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|network|socket|terminated|TypeError|statement timeout|canceling statement/i;

async function fetchPage(off) {
  const MAX = 5;
  for (let attempt = 1; attempt <= MAX; attempt++) {
    const { data, error } = await sb
      .from('players')
      .select('*')
      .or('minutes.gt.0,appearances.gt.0,api_average_rating.gt.0') // only rows worth scoring
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
  console.log('Computing canonical ratings from the live engine...\n');
  while (true) {
    const data = await fetchPage(offset);
    if (!data || data.length === 0) break;

    for (let i = 0; i < data.length; i += CONCURRENCY) {
      await Promise.all(data.slice(i, i + CONCURRENCY).map(processRow));
    }

    offset += data.length;
    console.log(`  processed ${offset}  |  scored ${scored}  |  updated ${updated}  |  skipped ${skipped}  |  failed ${failed}`);
    if (data.length < PAGE) break;
  }
  console.log(`\nDone.`);
  console.log(`  scored:  ${scored}`);
  console.log(`  updated: ${updated}`);
  console.log(`  skipped (no evidence): ${skipped}`);
  console.log(`  failed:  ${failed}`);
  console.log(`\nNow run the profiles-sync SQL, then refresh the site.`);
}

run().catch((e) => { console.error(e); process.exit(1); });
