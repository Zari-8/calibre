// scripts/computeCanonicalRatings.mjs
// ─────────────────────────────────────────────────────────────────────────
// Calibre — CANONICAL rating backfill (one rating per player, everywhere).
//
// WHY: computeRatings.mjs scores each ROW independently, so a player with an
// enriched row AND a thin duplicate gets two different stored ratings (Haaland
// 90 on the full row, 81 on the shell). Every surface already PREFERS the
// stored players.rating — the modal uses `storedRating ?? liveCalc`, the
// transfer hero uses `dbPlayer.rating || calibreRating(...)` — so the badge only
// flips because the two rows store different numbers.
//
// THE FIX: group rows by api_player_id, compute calibreRating() ONCE on the
// most-enriched ("canonical") row of each group, and write that single value to
// EVERY row of that player. Whichever row a surface grabs, the stored rating is
// now identical — it can no longer disagree with itself. No frontend change.
//
// SAFE BY DEFAULT: dry run. It prints the players whose rows currently DISAGREE
// (the visible bug cases) and what each collapses to, and writes nothing.
// Add --commit to actually write.
//
// Run (inspect first, one line, no quotes):
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/computeCanonicalRatings.mjs
// Then, once the dry-run looks right:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/computeCanonicalRatings.mjs --commit
// ─────────────────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js';
import { calibreRating } from '../src/services/calibreRating.js';

const COMMIT = process.argv.includes('--commit');
const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!URL || !KEY) {
  console.error('Missing credentials. Run it like this (one line, no quotes):');
  console.error('  SUPABASE_URL=your_url SUPABASE_SERVICE_ROLE_KEY=your_service_key node scripts/computeCanonicalRatings.mjs');
  console.error('\nThe service_role key is in Supabase dashboard -> Project Settings -> API -> service_role (secret).');
  process.exit(1);
}

const sb = createClient(URL, KEY, { auth: { persistSession: false } });
const PAGE = 1000;
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

// Most-enriched row wins: real competition splits >> api rating >> has age >> appearances/minutes.
function evidenceScore(r) {
  const splits = r.competition_splits && typeof r.competition_splits === 'object'
    && Object.keys(r.competition_splits).length ? 1 : 0;
  return splits * 1e6
    + (num(r.api_average_rating) > 0 ? 5e4 : 0)
    + (r.age ? 2e4 : 0)
    + num(r.appearances) * 100
    + num(r.minutes)
    + num(r.stats_minutes) * 0.1;
}

async function fetchAll() {
  const rows = [];
  let offset = 0;
  while (true) {
    const { data, error } = await sb
      .from('players').select('*')
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
  console.log(`Canonical rating backfill — ${COMMIT ? 'COMMIT (writing)' : 'DRY RUN (no writes)'}\n`);
  const rows = await fetchAll();

  // Group by api_player_id; rows with no api id are their own singleton group.
  const groups = new Map();
  for (const r of rows) {
    const key = r.api_player_id != null ? `id:${r.api_player_id}` : `row:${r.id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }

  let players = 0, multi = 0, divergent = 0, willWrite = 0, skipped = 0;
  const plan = [];
  const samples = [];

  for (const [, grp] of groups) {
    players++;
    const canonical = grp.reduce((best, r) => evidenceScore(r) > evidenceScore(best) ? r : best, grp[0]);
    const res = calibreRating(canonical);
    const rating = res && res.rating != null ? Math.round(res.rating) : null;
    if (rating == null) { skipped++; continue; }     // no evidence anywhere -> leave as-is

    const current = grp.map(r => (r.rating != null ? Number(r.rating) : null));
    const distinct = [...new Set(current.filter(v => v != null))];
    if (grp.length > 1) multi++;
    if (distinct.length > 1) {
      divergent++;
      if (samples.length < 40) samples.push({
        name: canonical.full_name || canonical.name || '?',
        api: canonical.api_player_id, rows: grp.length,
        was: distinct.sort((a, b) => a - b), now: rating,
      });
    }
    const toFix = grp.filter(r => Number(r.rating) !== rating).map(r => r.id);
    if (toFix.length) { willWrite += toFix.length; plan.push({ ids: toFix, rating }); }
  }

  console.log(`\nGroups (players):                       ${players}`);
  console.log(`  with multiple rows:                   ${multi}`);
  console.log(`  with DIVERGENT stored ratings (bug):  ${divergent}`);
  console.log(`  rows that will be rewritten:          ${willWrite}`);
  console.log(`  groups skipped (no evidence):         ${skipped}`);

  if (samples.length) {
    console.log(`\nPlayers whose rows currently disagree (sample):`);
    for (const d of samples) {
      console.log(`  ${String(d.name).slice(0, 26).padEnd(27)} api=${String(d.api).padEnd(8)} rows=${d.rows}  was [${d.was.join(', ')}]  ->  ${d.now}`);
    }
  }

  if (!COMMIT) {
    console.log(`\nDRY RUN complete — nothing written. Re-run with --commit to apply.`);
    return;
  }

  console.log(`\nWriting canonical ratings...`);
  const writes = [];
  for (const p of plan) for (const id of p.ids) writes.push({ id, rating: p.rating });
  let updated = 0, failed = 0;
  const C = 20;
  for (let i = 0; i < writes.length; i += C) {
    await Promise.all(writes.slice(i, i + C).map(async w => {
      const { error } = await sb.from('players').update({ rating: w.rating }).eq('id', w.id);
      if (error) { failed++; if (failed <= 10) console.error('  update failed', w.id, error.message); }
      else updated++;
    }));
    process.stdout.write(`\r  updated ${updated}/${writes.length}...`);
  }
  process.stdout.write('\n');
  console.log(`\nDone. updated ${updated}, failed ${failed}.`);
  console.log(`Refresh the site — the same player now reads one rating everywhere.`);
}

run().catch(e => { console.error(e); process.exit(1); });
