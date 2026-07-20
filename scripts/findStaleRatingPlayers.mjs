// scripts/findStaleRatingPlayers.mjs — READ-ONLY, Supabase only, no external
// API calls. Flags players whose stored api_average_rating looks like the
// Rashford bug: a single big-friendly/cameo match rating that never got
// properly minutes-weighted against a real competitive season, rather than
// a genuine excellent-season average.
//
// Why a rating-value threshold instead of a stats_updated_at cutoff: this
// session found TWO different write paths that touch a player's row without
// keeping fields consistent —
//   1. enrich-api-football-player-profiles.mjs computes api_average_rating
//      as a flat UNWEIGHTED mean across ALL statistics entries (friendlies
//      included), so one big-rated cameo skews it hard for low-minutes
//      players.
//   2. repairBaseStats.mjs (used to restore fields TheStatsAPI enrichment
//      clobbered) overwrites minutes/goals/assists/etc. by summing ALL
//      entries with NO isCompetitive() friendly-exclusion filter at all —
//      and never touches api_average_rating, so a row can end up with
//      "repaired" minutes sitting next to a stale, unrelated rating value.
// A timestamp cutoff can't tell these apart reliably since either path can
// touch a row at any time. A flat rating ceiling can: the current
// (non-stale) population's real p99 is ~7.6 (assessApiRatingDistribution.mjs),
// so anything meaningfully above that is worth a second look regardless of
// when it was last written.
//
// Output: scripts/output/stale_rating_players.txt — one uuid per line, same
// format enrichPlayerStats.mjs's TARGET_UUIDS_FILE already reads, so the fix
// is just:
//   FORCE=1 TARGET_UUIDS_FILE=scripts/output/stale_rating_players.txt node scripts/enrichPlayerStats.mjs
// enrichPlayerStats.mjs's leagueLine() already does the correct competitive-
// only, minutes-weighted computation (verified against Rashford's raw
// API-Football data this session) — this script only finds who needs it.

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

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
if (!URL || !KEY) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

// p99 of the real distribution is ~7.6 (assessApiRatingDistribution.mjs,
// n=10,981). 8.2 gives a small buffer above that before flagging.
const RATING_CEILING = Number(process.env.RATING_CEILING || 8.2);
const PAGE = 1000;

const TRANSIENT = /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|network|socket|terminated/i;
async function fetchPage(off) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const { data, error } = await sb
      .from('players')
      .select('id,name,team,minutes,stats_minutes,appearances,api_average_rating,rating,stats_updated_at,hidden')
      .not('api_average_rating', 'is', null)
      .gt('api_average_rating', RATING_CEILING)
      .order('id', { ascending: true })
      .range(off, off + PAGE - 1);
    if (!error) return data;
    const transient = TRANSIENT.test(String(error.message || error));
    if (!transient || attempt === 5) { console.error('Fetch failed:', error.message || error); process.exit(1); }
    const wait = 1000 * attempt;
    console.warn(`  ↻ page @${off}: ${error.message || error} — retry ${attempt}/4 in ${wait}ms`);
    await new Promise((r) => setTimeout(r, wait));
  }
}

async function main() {
  console.log(`Scanning for api_average_rating > ${RATING_CEILING} (read-only)...\n`);
  const all = [];
  let offset = 0;
  while (true) {
    const data = await fetchPage(offset);
    if (!data || data.length === 0) break;
    all.push(...data);
    offset += data.length;
    if (data.length < PAGE) break;
  }

  const visible = all.filter((r) => !r.hidden);
  console.log(`Found ${all.length} row(s) above ${RATING_CEILING} (${visible.length} not hidden).\n`);

  visible.sort((a, b) => Number(b.api_average_rating) - Number(a.api_average_rating));
  for (const r of visible) {
    console.log(
      `  ${String(r.name).padEnd(24)} team=${String(r.team ?? '—').padEnd(18)} ` +
      `apiR=${r.api_average_rating}  min=${r.minutes ?? '—'}  rating=${r.rating ?? '—'}  ` +
      `updated=${r.stats_updated_at ? r.stats_updated_at.slice(0, 10) : '—'}`
    );
  }

  const outDir = join(ROOT, 'scripts', 'output');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'stale_rating_players.txt');
  writeFileSync(outPath, visible.map((r) => r.id).join('\n') + (visible.length ? '\n' : ''));
  console.log(`\nWrote ${visible.length} id(s) to ${outPath}`);
  console.log('\nTo refresh them with the correct (competitive-only, minutes-weighted) logic:');
  console.log('  DRY_RUN=1 FORCE=1 TARGET_UUIDS_FILE=scripts/output/stale_rating_players.txt node scripts/enrichPlayerStats.mjs');
  console.log('then drop DRY_RUN=1 once the preview looks right.');
}

main().catch((e) => { console.error(e); process.exit(1); });
