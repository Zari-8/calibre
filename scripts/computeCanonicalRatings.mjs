// scripts/computeCanonicalRatings.mjs
// ─────────────────────────────────────────────────────────────────────────
// Calibre — CANONICAL rating backfill (one rating per player, everywhere).
//
// WHY: computeRatings.mjs scores each ROW independently, so a player with an
// enriched row AND a thin duplicate gets two different stored ratings (Haaland
// 90 on the full row, 81 on the shell). Every surface PREFERS the stored
// players.rating, so the badge flips purely because the rows store different
// numbers.
//
// THE FIX: compute calibreRating() ONCE on the most-enriched ("canonical") row
// of each api_player_id, then write that one value to EVERY row of that player.
// Whichever row a surface grabs, the stored rating is identical. No frontend
// change.
//
// WHY THIS VERSION: the players table is huge (~322k rows). Pulling select('*')
// across all of them in one long stream terminated the connection mid-run
// ("TypeError: terminated"). This version is built for that scale:
//   • A cheap LIGHT scan (id, api_player_id, rating only) to see every row.
//   • The heavy compute runs only on EVIDENCE rows (minutes/apps/api rating),
//     a much smaller set.
//   • Writes go out ONE bulk call per player — update(...).eq('api_player_id')
//     fixes all of a player's rows (including thin shells) in a single request.
//   • Every fetch is wrapped in retry-with-backoff, so a transient drop just
//     retries that page instead of killing the whole run.
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

const PAGE = 500;          // smaller pages -> faster, lighter requests that don't time out
const WRITE_CONCURRENCY = 12;
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Retry wrapper — the "terminated" failure is a transient network drop, not a
// real error. Retry the same page with backoff instead of aborting the run.
async function withRetry(fn, label, tries = 6) {
  let delay = 600;
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const msg = (e && e.message) ? e.message : String(e);
      if (attempt === tries) {
        console.error(`\n  ${label} failed after ${tries} attempts: ${msg}`);
        throw e;
      }
      process.stdout.write(`\n  ${label} hiccup (${msg}) — retry ${attempt}/${tries - 1} in ${delay}ms\n`);
      await sleep(delay);
      delay = Math.min(delay * 2, 8000);
    }
  }
}

// Most-enriched row wins: real competition splits >> api rating >> has age >> appearances/minutes.
function evidenceScore(r) {
  const splits = r.competition_splits && typeof r.competition_splits === 'object'
    && Object.keys(r.competition_splits).length ? 1 : 0;

  // Prefer rows enriched by TheStatsAPI, because the new rating engine can now
  // use xG, xA, shot quality, passes, touches, duels and defensive actions.
  const hasStatsApi =
    r.statsapi_enriched_at ||
    r.statsapi_player_id ||
    r.xg != null ||
    r.xa != null ||
    r.npxg != null ||
    r.total_passes != null ||
    r.touches != null ||
    r.tackles != null ||
    r.interceptions != null ||
    r.clearances != null;

  return splits * 1e6
    + (hasStatsApi ? 8e5 : 0)
    + (num(r.api_average_rating) > 0 ? 5e4 : 0)
    + (r.age ? 2e4 : 0)
    + num(r.appearances) * 100
    + num(r.minutes)
    + num(r.stats_minutes);
}

// Paginated fetch with retry. `filter` is an optional PostgREST .or() string.
async function fetchAllPaged(select, filter, label) {
  const rows = [];
  let offset = 0;
  while (true) {
    const data = await withRetry(async () => {
      let q = sb.from('players').select(select).order('id', { ascending: true }).range(offset, offset + PAGE - 1);
      if (filter) q = q.or(filter);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return data;
    }, `${label} @${offset}`);

    if (!data || data.length === 0) break;
    rows.push(...data);
    offset += data.length;
    process.stdout.write(`\r  ${label}: ${rows.length} rows...`);
    if (data.length < PAGE) break;
    await sleep(40); // breathe between pages
  }
  process.stdout.write('\n');
  return rows;
}

async function run() {
  console.log(`Canonical rating backfill — ${COMMIT ? 'COMMIT (writing)' : 'DRY RUN (no writes)'}\n`);

  // ── 1. LIGHT scan: every row, three columns. Tiny payload, sees the shells. ──
  const light = await fetchAllPaged('id, api_player_id, rating', null, 'light scan');

  // api_player_id -> [{ id, rating }]   (rows with no api id are singletons)
  const byApi = new Map();
  const orphanIds = [];
  for (const r of light) {
    if (r.api_player_id != null) {
      const k = r.api_player_id;
      if (!byApi.has(k)) byApi.set(k, []);
      byApi.get(k).push({ id: r.id, rating: r.rating != null ? Number(r.rating) : null });
    } else {
      orphanIds.push({ id: r.id, rating: r.rating != null ? Number(r.rating) : null });
    }
  }

  // ── 2. EVIDENCE rows only: the smaller set worth scoring. Full columns. ──
  const evidence = await fetchAllPaged(
    '*',
    'minutes.gt.0,appearances.gt.0,api_average_rating.gt.0,stats_minutes.gt.0,statsapi_enriched_at.not.is.null,xg.not.is.null,xa.not.is.null,total_passes.not.is.null,touches.not.is.null',
    'evidence'
  );

  // Best evidence row per api id -> canonical rating.
  const bestByApi = new Map();
  const orphanRows = [];
  for (const r of evidence) {
    if (r.api_player_id != null) {
      const cur = bestByApi.get(r.api_player_id);
      if (!cur || evidenceScore(r) > evidenceScore(cur)) bestByApi.set(r.api_player_id, r);
    } else {
      orphanRows.push(r);
    }
  }

  const canonicalByApi = new Map();
  for (const [api, row] of bestByApi) {
    const res = calibreRating(row);
    if (res && res.rating != null) canonicalByApi.set(api, Math.round(res.rating));
  }
  const canonicalByOrphanId = new Map();
  for (const row of orphanRows) {
    const res = calibreRating(row);
    if (res && res.rating != null) canonicalByOrphanId.set(row.id, Math.round(res.rating));
  }

  // ── 3. Plan: which players need a write, and report the visible disagreements. ──
  let players = 0, multi = 0, divergent = 0, noEvidence = 0;
  let bulkWrites = 0, orphanWrites = 0, rowsTouched = 0;
  const apiPlan = [];   // { api, rating }
  const orphanPlan = []; // { id, rating }
  const samples = [];

  for (const [api, group] of byApi) {
    players++;
    if (group.length > 1) multi++;
    const rating = canonicalByApi.get(api);
    if (rating == null) { noEvidence++; continue; } // no evidence anywhere -> leave as-is

    const distinct = [...new Set(group.map(g => g.rating).filter(v => v != null))];
    if (distinct.length > 1) {
      divergent++;
      if (samples.length < 40) {
        const best = bestByApi.get(api);
        samples.push({
          name: (best && (best.full_name || best.name)) || '?',
          api, rows: group.length,
          was: distinct.sort((a, b) => a - b), now: rating,
        });
      }
    }
    const needs = group.some(g => g.rating !== rating); // any row (incl. null shell) off the canonical
    if (needs) {
      apiPlan.push({ api, rating });
      bulkWrites++;
      rowsTouched += group.length;
    }
  }

  for (const o of orphanIds) {
    const rating = canonicalByOrphanId.get(o.id);
    if (rating == null) continue;
    if (o.rating !== rating) { orphanPlan.push({ id: o.id, rating }); orphanWrites++; rowsTouched++; }
  }

  console.log(`\nDistinct players (api_player_id):        ${players}`);
  console.log(`  with multiple rows:                   ${multi}`);
  console.log(`  with DIVERGENT stored ratings (bug):  ${divergent}`);
  console.log(`  with no evidence row (left as-is):    ${noEvidence}`);
  console.log(`\nPlayers needing a write:                 ${bulkWrites}  (one bulk call each)`);
  console.log(`Orphan rows (no api id) needing write:   ${orphanWrites}`);
  console.log(`Total rows that will change:             ${rowsTouched}`);

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

  // ── 4. Commit: one bulk update per player (fixes every row incl. shells). ──
  console.log(`\nWriting canonical ratings...`);
  let done = 0, failed = 0;
  const total = apiPlan.length + orphanPlan.length;

  async function writeApi(p) {
    try {
      await withRetry(async () => {
        const { error } = await sb.from('players').update({ rating: p.rating }).eq('api_player_id', p.api);
        if (error) throw new Error(error.message);
      }, `write api=${p.api}`);
      done++;
    } catch { failed++; }
  }
  async function writeOrphan(p) {
    try {
      await withRetry(async () => {
        const { error } = await sb.from('players').update({ rating: p.rating }).eq('id', p.id);
        if (error) throw new Error(error.message);
      }, `write id=${p.id}`);
      done++;
    } catch { failed++; }
  }

  for (let i = 0; i < apiPlan.length; i += WRITE_CONCURRENCY) {
    await Promise.all(apiPlan.slice(i, i + WRITE_CONCURRENCY).map(writeApi));
    process.stdout.write(`\r  written ${done}/${total}...`);
  }
  for (let i = 0; i < orphanPlan.length; i += WRITE_CONCURRENCY) {
    await Promise.all(orphanPlan.slice(i, i + WRITE_CONCURRENCY).map(writeOrphan));
    process.stdout.write(`\r  written ${done}/${total}...`);
  }
  process.stdout.write('\n');
  console.log(`\nDone. players/orphans written ${done}, failed ${failed}.`);
  console.log(`Refresh the site — the same player now reads one rating everywhere.`);
}

run().catch(e => { console.error('\nFatal:', e && e.message ? e.message : e); process.exit(1); });
