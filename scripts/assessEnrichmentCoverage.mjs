// scripts/assessEnrichmentCoverage.mjs — READ-ONLY. For every player with a
// real rating (the population the rating engine actually scores), reports
// what fraction have each v8.2 "TheStatsAPI advanced" field populated, and
// cross-tabs by position bucket, so we know whether the engine under-uses
// these stats because of low data coverage or because of weighting choices.

import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!URL || !KEY) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TRANSIENT = /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|network|socket|terminated|TypeError/i;
const PAGE = 1000;

const FIELDS = [
  'shot_accuracy', 'big_chances_created', 'big_chances_missed',
  'ground_duel_win_pct', 'aerial_duel_win_pct',
  'opp_half_passes', 'own_half_passes', 'final_third_passes',
  'dribble_success_pct', 'successful_dribbles',
  'shot_quality',
  'xg', 'xa', 'npxg',
  'saves', 'goals_conceded',
  'competition_splits',
];

function positionBucket(p) {
  const text = `${p.position||''} ${p.archetype||''} ${p.pos||''} ${p.primary_role||''} ${p.raw_position||''}`.toLowerCase();
  if (/(goalkeeper|keeper|\bgk\b)/.test(text)) return 'GK';
  if (/(defender|centre.?back|center.?back|full.?back|wing.?back|\bcb\b|\brb\b|\blb\b|\bdef\b)/.test(text)) return 'DEF';
  if (/(striker|forward|winger|wide creator|wide forward|attack|poacher|fox|\bst\b|\brw\b|\blw\b|\bcf\b|\bfwd\b|\batt\b)/.test(text)) return 'ATT';
  return 'MID';
}

async function fetchPage(off) {
  const MAX = 5;
  for (let attempt = 1; attempt <= MAX; attempt++) {
    const { data, error } = await sb
      .from('players')
      .select(`id,name,position,pos,archetype,primary_role,raw_position,rating,minutes,${FIELDS.join(',')}`)
      .not('rating', 'is', null)
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

async function main() {
  console.log('Scanning rated players (read-only)...\n');
  const all = [];
  let offset = 0;
  while (true) {
    const data = await fetchPage(offset);
    if (!data || data.length === 0) break;
    all.push(...data);
    offset += data.length;
    process.stdout.write(`  loaded ${all.length}\r`);
    if (data.length < PAGE) break;
  }
  console.log(`\nTotal rated players: ${all.length}\n`);

  const buckets = { ALL: all, GK: [], DEF: [], MID: [], ATT: [] };
  for (const r of all) buckets[positionBucket(r)].push(r);

  console.log('══════════ FIELD COVERAGE (% of rated players with a non-null value) ══════════\n');
  const header = ['field', 'ALL', 'GK', 'DEF', 'MID', 'ATT'];
  console.log(header.map((h) => h.padEnd(24)).join(''));
  for (const f of FIELDS) {
    const row = [f];
    for (const key of ['ALL', 'GK', 'DEF', 'MID', 'ATT']) {
      const pool = buckets[key];
      const n = pool.length;
      const has = pool.filter((r) => r[f] != null && r[f] !== '').length;
      const pct = n ? ((has / n) * 100).toFixed(1) + '%' : '—';
      row.push(`${pct} (${has}/${n})`);
    }
    console.log(row.map((v) => String(v).padEnd(24)).join(''));
  }

  // How many players have ANY of the advanced signal fields (excluding xg/xa/npxg/splits)?
  const advancedOnly = ['shot_accuracy','big_chances_created','big_chances_missed','ground_duel_win_pct','aerial_duel_win_pct','dribble_success_pct','shot_quality'];
  const anyAdvanced = all.filter((r) => advancedOnly.some((f) => r[f] != null)).length;
  const anyXg = all.filter((r) => r.xg != null || r.xa != null || r.npxg != null).length;
  const hasSplits = all.filter((r) => r.competition_splits != null).length;

  console.log(`\n  players with AT LEAST ONE v8.2 advanced field populated: ${anyAdvanced} / ${all.length} (${((anyAdvanced/all.length)*100).toFixed(1)}%)`);
  console.log(`  players with xg/xa/npxg populated:                       ${anyXg} / ${all.length} (${((anyXg/all.length)*100).toFixed(1)}%)`);
  console.log(`  players with competition_splits populated:               ${hasSplits} / ${all.length} (${((hasSplits/all.length)*100).toFixed(1)}%)`);

  console.log('\nDone.');
}

main().catch((e) => { console.error(e); process.exit(1); });
