// ============================================================
// checkDuelCoverage.mjs — the engine already HAS a context-aware fix for
// the raw-tackle-volume problem: duelQualityScore() in calibreRating.js
// blends duel WIN-RATE (60%) with volume (40%) whenever ground_duel_win_pct/
// aerial_duel_win_pct (TheStatsAPI) or duels_total (API-Football's
// duels.total, sibling of duels.won which the engine already reads) is
// available — win-rate is inherently workload-normalized in a way raw
// counts aren't: a CB forced into more duels by a deep-defending team
// doesn't get penalized for a lower RATE unless they're actually losing
// more of them.
//
// The backtest set (Van Dijk, Cubarsí, Romero, etc.) all fell through to
// the crude raw-count fallback (rawDuelUnclamped), meaning duelQualityScore
// returned null for every one of them. This checks whether that's because
// ground_duel_win_pct/aerial_duel_win_pct/duels_total simply aren't
// populated for these rows — a data coverage gap, not a formula gap.
//
// Run this LOCALLY (sandbox has no live network egress to Supabase).
// USAGE:
//   cd ~/Desktop/calibre-github
//   node scripts/checkDuelCoverage.mjs
// Paste the FULL console output back into the chat.
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
if (!url || !key) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const sb = createClient(url, key, { auth: { persistSession: false } });

const TARGETS = [
  { search: 'cubars', team: null, label: 'Pau Cubarsí' },
  { search: 'stones', team: null, label: 'John Stones' },
  { search: 'gvardiol', team: null, label: 'Josko Gvardiol' },
  { search: 'van dijk', team: 'liverpool', label: 'Virgil van Dijk' },
  { search: 'saliba', team: 'arsenal', label: 'William Saliba' },
  { search: 'marquinhos', team: 'paris', label: 'Marquinhos' },
  { search: 'romero', team: 'tottenham', label: 'Cristian Romero' },
];

// Also check coverage across the WHOLE DEF pool, not just these 7 — tells us
// if this is fixable broadly or would only help a handful of enriched stars.
async function poolCoverage() {
  const { data, error } = await sb
    .from('players')
    .select('duels_total, ground_duel_win_pct, aerial_duel_win_pct, position, pos')
    .or('position.ilike.%defen%,pos.ilike.%defen%,position.ilike.%cb%,pos.eq.CB')
    .not('rating', 'is', null)
    .limit(500);
  if (error) { console.log('pool query error:', error.message); return; }
  const n = data.length;
  const hasDuelsTotal = data.filter(r => r.duels_total != null).length;
  const hasGroundPct = data.filter(r => r.ground_duel_win_pct != null).length;
  const hasAerialPct = data.filter(r => r.aerial_duel_win_pct != null).length;
  console.log(`\nDEF pool coverage (n=${n} rated defenders sampled):`);
  console.log(`  duels_total populated:         ${hasDuelsTotal}/${n} (${(hasDuelsTotal/n*100).toFixed(1)}%)`);
  console.log(`  ground_duel_win_pct populated: ${hasGroundPct}/${n} (${(hasGroundPct/n*100).toFixed(1)}%)`);
  console.log(`  aerial_duel_win_pct populated: ${hasAerialPct}/${n} (${(hasAerialPct/n*100).toFixed(1)}%)`);
}

async function main() {
  for (const t of TARGETS) {
    let q = sb
      .from('players')
      .select('name, team, club, minutes, duels_won, duels_total, ground_duel_win_pct, aerial_duel_win_pct')
      .or(`name.ilike.%${t.search}%,full_name.ilike.%${t.search}%`);
    if (t.team) q = q.or(`team.ilike.%${t.team}%,club.ilike.%${t.team}%`);
    const { data, error } = await q.order('minutes', { ascending: false, nullsFirst: false }).limit(1);

    console.log('─'.repeat(70));
    console.log(t.label);
    if (error) { console.log('  query error:', error.message); continue; }
    if (!data || !data.length) { console.log(`  NOT FOUND`); continue; }
    const row = data[0];
    console.log(`  ${row.name} (${row.team || row.club})`);
    console.log(`  duels_won=${row.duels_won}  duels_total=${row.duels_total}  ground_duel_win_pct=${row.ground_duel_win_pct}  aerial_duel_win_pct=${row.aerial_duel_win_pct}`);
  }

  await poolCoverage();
}

main();
