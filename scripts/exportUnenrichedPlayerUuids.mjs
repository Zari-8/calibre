// scripts/exportUnenrichedPlayerUuids.mjs — READ-ONLY. No writes.
//
// exportScoredPlayerUuids.mjs exports the FULL scored population (~15,177
// rows) once. run_enrichment_loop.sh has been targeting that same static
// list on every single attempt with FORCE=1, which means every attempt
// reprocesses EVERY row -- including the ones already fully enriched days
// ago. Confirmed 2026-07-26: R. Calafiori succeeded with the IDENTICAL
// result on 2026-07-21, 23, 24, and 26 -- four real API calls spent
// re-confirming data we already had, while the ~6,982 rows that actually
// still need work waited their turn.
//
// This exports ONLY the players within the scored population who do NOT yet
// have a real stats_season -- i.e. the ones that still genuinely need an
// API call. Re-run this fresh before each attempt (not just once) so the
// target list keeps shrinking as real progress lands, instead of dragging
// the full 15,177 along for the entire multi-day sweep.
//
// v2 — 2026-07-27: found the SAME redundancy bug on the empty side. A row
// with a GENUINE "checked 3 seasons, no minutes" result also has
// stats_season IS NULL forever (there's no separate "confirmed empty,
// leave it alone" marker) -- so this export couldn't tell "genuinely
// settled, don't recheck" apart from "never actually verified yet." On the
// very first minutes of the 2026-07-27 run, 197 real (non-quota-failure)
// empty confirmations landed, and would have been immediately eligible to
// be re-targeted again on the NEXT attempt, wasting quota re-confirming an
// answer we'd just gotten -- same pattern as Calafiori, just on the empty
// side. Fix: exclude rows touched within the last RECHECK_COOLDOWN_HOURS,
// even if stats_season is null. Genuinely stale/never-checked rows (the
// pre-2026-07-22 quota-bug leftovers) still get swept up since their
// stats_updated_at is old; only rows just confirmed in a recent pass get a
// grace period before being reconsidered.
//
// Run: node scripts/exportUnenrichedPlayerUuids.mjs > unenriched_player_uuids.txt
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
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

const PAGE = 1000;
// Grace period before a just-confirmed-empty row becomes eligible to be
// re-targeted again. Filtered in JS (not in the SQL .or()) to avoid stacking
// a second .or() group on top of the existing SCORED_FILTER one, which
// PostgREST/supabase-js doesn't reliably combine as two independent ANDed
// OR-groups.
const RECHECK_COOLDOWN_HOURS = Number(process.env.RECHECK_COOLDOWN_HOURS || 20);
const cooldownCutoffMs = Date.now() - RECHECK_COOLDOWN_HOURS * 3600 * 1000;

async function run() {
  const ids = [];
  let skippedRecent = 0;
  let offset = 0;
  while (true) {
    const { data, error } = await sb
      .from('players')
      .select('id, stats_updated_at')
      .not('api_player_id', 'is', null).gt('api_player_id', 0)
      .or('minutes.gt.0,appearances.gt.0,api_average_rating.gt.0') // same scored-population filter as exportScoredPlayerUuids.mjs
      .is('stats_season', null)                                     // only rows still missing real data
      .order('id', { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) { console.error('Fetch failed:', error.message); process.exit(1); }
    if (!data || data.length === 0) break;
    for (const r of data) {
      const touchedMs = r.stats_updated_at ? new Date(r.stats_updated_at).getTime() : 0;
      if (touchedMs > cooldownCutoffMs) { skippedRecent++; continue; } // just confirmed empty recently -- grace period, don't recheck yet
      ids.push(r.id);
    }
    offset += data.length;
    process.stderr.write(`\r  fetched ${offset} rows, ${ids.length} eligible, ${skippedRecent} in cooldown...`);
    if (data.length < PAGE) break;
  }
  process.stderr.write(`\ndone — ${ids.length} still-unenriched UUIDs eligible now (${skippedRecent} excluded, confirmed empty within the last ${RECHECK_COOLDOWN_HOURS}h).\n`);
  console.log(ids.join('\n'));
}

run().catch(e => { console.error('\nFatal:', e?.message ?? e); process.exit(1); });
