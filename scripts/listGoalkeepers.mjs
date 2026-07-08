// scripts/listGoalkeepers.mjs — READ-ONLY. Finds every goalkeeper row that
// has a usable api_player_id (so enrichPlayerStats.mjs can actually look them
// up) and writes their internal UUIDs to gk-uuids.txt for use as TARGET_UUIDS
// — the re-enrichment pass that will populate the new saves/goals_conceded
// fields (see supabase/migrations/20260709_gk_shotstopping_fields.sql).
//
// Run (one line, no quotes):
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/listGoalkeepers.mjs

import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!URL || !KEY) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TRANSIENT = /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|network|socket|terminated|TypeError/i;
const PAGE = 1000;

function isGk(p) {
  const text = `${p.position||''} ${p.archetype||''} ${p.pos||''} ${p.primary_role||''} ${p.raw_position||''}`.toLowerCase();
  return /(goalkeeper|keeper|\bgk\b)/.test(text);
}

async function fetchPage(off) {
  const MAX = 5;
  for (let attempt = 1; attempt <= MAX; attempt++) {
    const { data, error } = await sb
      .from('players')
      .select('id,name,position,pos,archetype,primary_role,raw_position,api_player_id,league_id,minutes,rating,saves,goals_conceded')
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

async function main() {
  console.log('Scanning rated/ratable players for goalkeepers (read-only)...\n');
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
  console.log(`\nTotal scanned: ${all.length}`);

  const gks = all.filter(isGk);
  const withApiId = gks.filter((r) => Number(r.api_player_id) > 0);
  const alreadyHasSaveData = gks.filter((r) => r.saves != null || r.goals_conceded != null);

  console.log(`\n══════════ GOALKEEPERS: ${gks.length} ══════════`);
  console.log(`  have a usable api_player_id (enrichPlayerStats.mjs can target them): ${withApiId.length}`);
  console.log(`  already have saves/goals_conceded populated:                          ${alreadyHasSaveData.length}`);
  console.log(`  need re-enrichment to pick up the new fields:                         ${withApiId.length - alreadyHasSaveData.length}`);

  const targets = withApiId.filter((r) => r.saves == null && r.goals_conceded == null);
  const uuidList = targets.map((r) => r.id).join(',');
  const fs = await import('fs');
  fs.writeFileSync(new URL('../gk-uuids.txt', import.meta.url), uuidList);
  console.log(`\nTARGET_UUIDS list (${targets.length} ids) written to gk-uuids.txt`);

  console.log('\nSample without api_player_id (up to 20 — these need PLAYER_IDS or a manual lookup):');
  gks.filter((r) => !(Number(r.api_player_id) > 0)).slice(0, 20)
    .forEach((r) => console.log(`  ${String(r.name).padEnd(24)} id=${r.id}`));
}

main().catch((e) => { console.error(e); process.exit(1); });
