/**
 * clearHiddenDuplicateStatsapiIds.mjs
 *
 * Root cause of Lewandowski's stale xg=3.5 (vs a real ~14 this season):
 *
 *   1. reconcileNames.mjs's OLD matching logic (blind exact-ilike + limit(1))
 *      once wrote a full TheStatsAPI season enrichment — including the
 *      correct xg — onto a hollow decoy row (api_player_id 147229, "Robert
 *      Lewandowski", no team) instead of the real, visible Barcelona row
 *      (api_player_id 521, stored abbreviated as "R. Lewandowski").
 *   2. fixDuplicateIdentities.mjs (2026-07-10) merged the decoy's stats onto
 *      the real row, but its STATSAPI_FIELDS list did NOT include xg / npxg
 *      / xa / xg_per_90 / expected_goals / etc — so every OTHER stat moved
 *      over, but xg was left behind on the (now hidden) decoy.
 *   3. That merge DID copy statsapi_player_id onto the real row 521 — so
 *      today BOTH row 521 (visible) and row 147229 (hidden) share the same
 *      statsapi_player_id. enrichStatsAPI.mjs's findPlayer() looks up by
 *      statsapi_player_id with `.limit(1)` and no explicit order — so
 *      simply re-running enrichStatsAPI.mjs now is a coin flip between
 *      correctly overwriting row 521 and re-writing the decoy again.
 *
 * This script removes that ambiguity, once, for every duplicate group (not
 * just Lewandowski's) surfaced by mergeDuplicateStatsapiIds.mjs: for each
 * statsapi_player_id shared by 2+ rows, it keeps the id on whichever row
 * mergeDuplicateStatsapiIds.mjs would treat as primary (not hidden, then
 * highest minutes) and NULLS OUT statsapi_player_id on every other
 * (already-hidden) row in the group. Those rows stay hidden and keep all
 * their other data — only the join key that future enrichment scripts key
 * off of is cleared, so a future run can never land on the wrong twin again.
 *
 * After running this live, re-run enrichStatsAPI.mjs for the affected
 * competition(s) to recompute xg directly from live data onto the correct
 * row (Lewandowski: LaLiga / comp_8814).
 *
 * Read-only by default. Run:
 *   node scripts/clearHiddenDuplicateStatsapiIds.mjs
 * Then to write:
 *   DRY_RUN=0 node scripts/clearHiddenDuplicateStatsapiIds.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const f of ['.env', '.env.local']) {
  const p = join(ROOT, f);
  if (!existsSync(p)) continue;
  for (const l of readFileSync(p, 'utf8').split('\n')) {
    const m = l.match(/^([^#=]+)=(.*)/);
    if (m) process.env[m[1].trim()] ??= m[2].trim().replace(/^["']|["']$/g, '');
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.env.DRY_RUN !== '0';

if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

async function fetchAllWithStatsapiId() {
  const all = [];
  let from = 0;
  const PAGE = 1000;
  for (;;) {
    const { data, error } = await sb
      .from('players')
      .select('id, name, team, hidden, minutes, api_player_id, statsapi_player_id, xg')
      .not('statsapi_player_id', 'is', null)
      .range(from, from + PAGE - 1);
    if (error) { console.error('Fetch error:', error.message); process.exit(1); }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

// Same primary-selection rule as mergeDuplicateStatsapiIds.mjs: not-hidden
// beats hidden, then higher minutes, then presence of api_player_id.
function pickPrimary(rows) {
  return [...rows].sort((a, b) => {
    const hiddenDiff = (a.hidden ? 1 : 0) - (b.hidden ? 1 : 0);
    if (hiddenDiff !== 0) return hiddenDiff;
    const minDiff = (b.minutes || 0) - (a.minutes || 0);
    if (minDiff !== 0) return minDiff;
    const apiDiff = (b.api_player_id ? 1 : 0) - (a.api_player_id ? 1 : 0);
    if (apiDiff !== 0) return apiDiff;
    return 0;
  })[0];
}

async function main() {
  console.log(DRY_RUN ? 'DRY RUN — no writes.\n' : 'LIVE RUN.\n');

  const rows = await fetchAllWithStatsapiId();
  console.log(`Fetched ${rows.length} rows with a statsapi_player_id.`);

  const groups = new Map();
  for (const r of rows) {
    const k = r.statsapi_player_id;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  const dupGroups = [...groups.values()].filter(g => g.length > 1);
  console.log(`${dupGroups.length} statsapi_player_id groups with 2+ rows sharing one.\n`);

  let cleared = 0, errors = 0, skipped = 0;

  for (const group of dupGroups) {
    const primary = pickPrimary(group);
    const losers = group.filter(r => r.id !== primary.id);
    // Only touch losers that are actually hidden — a non-hidden loser means
    // this group has two LIVE cards sharing an id, which is a different,
    // more urgent bug (run mergeDuplicateStatsapiIds.mjs for that case).
    const hiddenLosers = losers.filter(l => l.hidden);
    if (!hiddenLosers.length) { skipped++; continue; }

    console.log(`"${primary.name}" (statsapi=${primary.statsapi_player_id}, xg=${primary.xg ?? 'null'}):`);
    console.log(`  keep id=${primary.id} "${primary.name}" (${primary.team || 'no team'}, ${primary.minutes || 0}min)`);
    for (const l of hiddenLosers) {
      console.log(`  clear statsapi_player_id on hidden id=${l.id} "${l.name}" (xg=${l.xg ?? 'null'})`);
    }

    if (!DRY_RUN) {
      for (const l of hiddenLosers) {
        const { error } = await sb.from('players').update({ statsapi_player_id: null }).eq('id', l.id);
        if (error) { console.log(`  ERROR clearing id=${l.id}: ${error.message}`); errors++; }
        else cleared++;
      }
    } else {
      cleared += hiddenLosers.length;
    }
    console.log('');
  }

  console.log('── Summary ──');
  console.log(`Duplicate groups found        : ${dupGroups.length}`);
  console.log(`Groups skipped (no hidden twin): ${skipped}`);
  console.log(`Hidden rows ${DRY_RUN ? 'that would be' : ''} cleared${DRY_RUN ? '' : '     '} : ${cleared}`);
  console.log(`Errors                        : ${errors}`);
  console.log(DRY_RUN ? '\nDRY RUN complete. Re-run with DRY_RUN=0 to write.' : '\nDone. Now re-run enrichStatsAPI.mjs per-competition to refresh xg onto the correct rows.');
}

main().catch(e => { console.error(e); process.exit(1); });
