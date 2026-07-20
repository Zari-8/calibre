// scripts/inspectContinentalMistag.mjs — READ-ONLY. No writes, no API calls.
//
// Following up on sampleTeamsByLeagueId.mjs: league_id=13 (Copa Libertadores)
// and league_id=12 (CAF Champions League) are continental CLUB CUPS, not
// domestic leagues — but ~1,380 players in the scored population have one of
// these as their stored players.league_id. Two very different bugs could
// produce that symptom, and they need very different fixes:
//
//   (A) The player has a full, properly-enriched season on record —
//       competition_splits.base/overlay already separate domestic vs
//       continental correctly — and ONLY the flat players.league_id column
//       (a separate, older field) is mistagged. Fix: just correct that one
//       column to the player's real domestic league_id. Cheap, targeted,
//       like the Paderborn fix.
//
//   (B) The player was bulk-imported via import-api-football-players.mjs
//       with --league 13/12 directly (i.e. someone imported "Copa
//       Libertadores" as if it were a standalone domestic league register),
//       so EVERY stat on the row — minutes, goals, api_average_rating, the
//       lot — is that player's Libertadores/CAF CL cameo only, not their
//       real full domestic season. No competition_splits at all. Fix: needs
//       a full re-enrichment (enrichPlayerStats.mjs) to pull in their real
//       season across every competition, not a one-column patch.
//
// This prints minutes/apps/rating and whether competition_splits exists for
// a sample under each id, so we know which bug (or mix of both) we're
// actually dealing with before proposing a fix.
//
// Run: node scripts/inspectContinentalMistag.mjs
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

const IDS = (process.env.IDS ? process.env.IDS.split(',').map(Number) : [13, 12, 949]);
const SAMPLE = Number(process.env.SAMPLE || 15);

async function run() {
  console.log('Continental-mistag diagnostic — read-only, no API calls.\n');
  for (const id of IDS) {
    const { data, error } = await sb
      .from('players')
      .select('name, team, minutes, appearances, goals, assists, api_average_rating, rating, competition_splits, stats_updated_at, stats_season')
      .eq('league_id', id)
      .order('minutes', { ascending: false, nullsFirst: false })
      .limit(SAMPLE);
    if (error) { console.log(`league_id=${id}: query failed (${error.message})`); continue; }

    const withSplits = (data ?? []).filter(r => r.competition_splits && (r.competition_splits.base || r.competition_splits.overlay));
    console.log(`── league_id=${id} — top ${data?.length ?? 0} by minutes ──`);
    console.log(`   ${withSplits.length}/${data?.length ?? 0} of these have competition_splits populated (base or overlay).`);
    for (const r of data ?? []) {
      const splitsTag = r.competition_splits ? (r.competition_splits.base || r.competition_splits.overlay ? 'splits:yes' : 'splits:empty-obj') : 'splits:null';
      console.log(`   ${(r.name ?? '—').padEnd(24)} ${(r.team ?? '—').padEnd(22)} min=${String(r.minutes ?? '—').padEnd(6)} apps=${String(r.appearances ?? '—').padEnd(4)} g=${String(r.goals ?? '—').padEnd(3)} a=${String(r.assists ?? '—').padEnd(3)} apiR=${String(r.api_average_rating ?? '—').padEnd(5)} rating=${String(r.rating ?? '—').padEnd(4)} season=${r.stats_season ?? '—'} ${splitsTag}`);
    }
    console.log('');
  }
}

run().catch(e => { console.error('\nFatal:', e?.message ?? e); process.exit(1); });
