// ============================================================
// backtestDataPull.mjs — one-shot data pull for the System Fit v3 backtest
// ------------------------------------------------------------
// Run this LOCALLY (needs live Supabase network access, which the sandbox
// Claude runs in doesn't have — every field it reads is already in
// .env.local). Paste the full console output back into the chat.
//
// Pulls three things:
//   1. Coverage counts for derived_team_profiles / team_indices /
//      team_shot_profiles — the standing "is Phase 1 actually populated in
//      production" question from the System Fit audit.
//   2. Real completed ('done') transfers this season from the `transfers`
//      table, so the fit-engine backtest can use ACTUAL recorded deals
//      instead of hand-picked historical examples.
//   3. The arriving player's real per-90 stat fields for each of those
//      transfers (wherever enriched), so real computed traits can replace
//      the representative approximations used in the first backtest pass.
//
// USAGE:
//   cd ~/Desktop/calibre-github
//   node scripts/backtestDataPull.mjs
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const f of ['.env', '.env.local']) {
  const p = join(ROOT, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const [k, ...r] = t.split('=');
    process.env[k.trim()] ??= r.join('=').trim().replace(/^["']|["']$/g, '');
  }
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — check .env.local');
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  console.log('=== 1. Coverage counts (is Phase 1 actually populated?) ===');
  for (const table of ['derived_team_profiles', 'team_indices', 'team_shot_profiles']) {
    const { count, error } = await sb.from(table).select('*', { count: 'exact', head: true });
    console.log(`${table}: ${error ? 'ERROR ' + error.message : count + ' rows'}`);
  }
  const { count: aggCount, error: aggErr } = await sb
    .from('derived_team_profiles')
    .select('*', { count: 'exact', head: true })
    .eq('profile_source', 'aggregated');
  console.log(`derived_team_profiles with profile_source='aggregated' (real measured, not goals-proxy): ${aggErr ? 'ERROR ' + aggErr.message : aggCount}`);

  console.log('\n=== 2. Real completed transfers this season ===');
  const { data: transfers, error: tErr } = await sb
    .from('transfers')
    .select('*')
    .eq('published', true)
    .eq('season', '2026-27')
    .eq('status', 'done')
    .order('created_at', { ascending: false })
    .limit(30);
  if (tErr) console.error('transfers error:', tErr.message);
  console.log(`${transfers?.length ?? 0} completed transfers found.`);
  for (const t of (transfers || [])) {
    console.log(`  ${String(t.player_name || '?').padEnd(24)} ${String(t.from_club || '?').padEnd(18)} -> ${String(t.to_club || '?').padEnd(18)} fee €${t.fee_millions}m  api_player_id=${t.api_player_id}`);
  }

  console.log('\n=== 3. Real per-90 stats for those arriving players (if enriched) ===');
  const ids = [...new Set((transfers || []).map(t => t.api_player_id).filter(Boolean))];
  if (!ids.length) { console.log('No api_player_id values to look up — nothing more to pull.'); return; }
  const { data: players, error: pErr } = await sb
    .from('players')
    .select('*')
    .in('api_player_id', ids);
  if (pErr) { console.error('players error:', pErr.message); return; }
  console.log(`${players?.length ?? 0} of ${ids.length} arriving players found in the registry.\n`);
  for (const p of (players || [])) {
    console.log(JSON.stringify({
      name: p.name, team: p.team ?? p.club, position: p.position ?? p.pos, age: p.age,
      minutes: p.minutes ?? p.stats_minutes,
      passes: p.passes, pass_accuracy: p.pass_accuracy,
      key_passes: p.key_passes ?? p.keyPasses,
      dribbles_success: p.dribbles_success ?? p.dribbles ?? p.dribbles_attempts,
      tackles: p.tackles, interceptions: p.interceptions,
      duels_won: p.duels_won ?? p.duelsWon,
      shots: p.shots ?? p.shots_total,
      goals: p.goals, assists: p.assists,
      api_average_rating: p.api_average_rating,
      api_team_id: p.api_team_id,
    }));
  }
}

main().catch(e => { console.error(e); process.exit(1); });
