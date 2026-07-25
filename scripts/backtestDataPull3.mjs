// ============================================================
// backtestDataPull3.mjs — bigger real-data pull for the DEF/FB/DM/MID/WIDE
// backtest. The first pass (backtestDataPull2.mjs) only checked 8 hand-picked
// names and the narrow transfers filter came back empty — this widens both:
//
//   1. ALL transfers rows (any season/status/published value, up to 300),
//      classified into DEF/FB/DM/MID/WIDE/ATT/GK by position text, so we can
//      see how many real completed deals exist per bucket instead of
//      guessing from a synthetic sample of ~2 per bucket.
//   2. A curated list of ~40 well-documented real players spanning all five
//      buckets (mix of recent transfers AND known tenure/role changes, since
//      "real known outcome" doesn't require a transfer — Van Dijk's peak
//      case, Casemiro's decline, Cancelo's system-out-of-favour swing, etc.
//      are just as much real-world evidence as a transfer fee).
//   3. For every match found (in either 1 or 2) with a real api_player_id,
//      pull the real per-90 stat fields from the players registry.
//
// Run this LOCALLY (sandbox has no live network egress to Supabase).
// USAGE:
//   cd ~/Desktop/calibre-github
//   node scripts/backtestDataPull3.mjs
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

function bucketOf(pos = '') {
  const t = String(pos).toLowerCase();
  if (/(gk|keeper|goal)/.test(t)) return 'GK';
  if (/(cb|centre.?back|center.?back|central def)/.test(t)) return 'DEF';
  if (/(\blb\b|\brb\b|wing.?back|full.?back|\bfb\b|left.?back|right.?back|lwb|rwb)/.test(t)) return 'FB';
  if (/(\bdm\b|cdm|defensive mid|anchor|regista|holding)/.test(t)) return 'DM';
  if (/(\blw\b|\brw\b|wing|wide|inside forward)/.test(t)) return 'WIDE';
  if (/(\bst\b|\bcf\b|striker|forward|\bfw\b|\bfwd\b|attacker|poacher|\bss\b)/.test(t)) return 'ATT';
  if (/(\bam\b|\bcm\b|midfield|playmaker|creator|box.?to.?box)/.test(t)) return 'MID';
  return 'MID';
}

function printPlayerRow(p) {
  console.log(JSON.stringify({
    name: p.name || p.full_name, team: p.team ?? p.club, position: p.position ?? p.pos, age: p.age,
    minutes: p.minutes ?? p.stats_minutes,
    passes: p.passes, pass_accuracy: p.pass_accuracy,
    key_passes: p.key_passes ?? p.keyPasses,
    dribbles_success: p.dribbles_success ?? p.dribbles, dribbles_attempts: p.dribbles_attempts,
    tackles: p.tackles, interceptions: p.interceptions,
    duels_won: p.duels_won ?? p.duelsWon, duels_total: p.duels_total,
    aerials_won: p.aerials_won, clearances: p.clearances, blocks: p.blocks,
    shots: p.shots ?? p.shots_total,
    goals: p.goals, assists: p.assists,
    api_average_rating: p.api_average_rating,
    api_player_id: p.api_player_id, api_team_id: p.api_team_id,
  }));
}

async function main() {
  console.log('=== 1. ALL transfers rows (any filter), bucketed by position ===');
  const { data: all, error: allErr } = await sb
    .from('transfers')
    .select('player_name,from_club,to_club,position,position_label,fee_millions,status,season,published,api_player_id,created_at')
    .order('created_at', { ascending: false })
    .limit(300);
  if (allErr) console.error('error:', allErr.message);
  const rows = all || [];
  console.log(`${rows.length} total transfer rows pulled.`);
  const byBucket = {};
  for (const t of rows) {
    const b = bucketOf(t.position_label || t.position || '');
    (byBucket[b] ??= []).push(t);
  }
  for (const b of ['DEF', 'FB', 'DM', 'MID', 'WIDE', 'ATT', 'GK']) {
    const list = byBucket[b] || [];
    console.log(`\n-- ${b}: ${list.length} rows --`);
    for (const t of list.slice(0, 25)) {
      console.log(`  status=${String(t.status).padEnd(8)} ${String(t.player_name).padEnd(24)} ${String(t.from_club || '?').padEnd(18)} -> ${String(t.to_club || '?').padEnd(18)} €${t.fee_millions}m api_player_id=${t.api_player_id}`);
    }
  }

  console.log('\n=== 2. Curated real-player lookup (mix of transfers + known tenures), by bucket ===');
  const CURATED = {
    DEF: ['Van Dijk', 'Kim Min-jae', 'Marquinhos', 'Araujo', 'Ake', 'Konate', 'Timber', 'Bremer', 'Kimpembe', 'Gabriel Magalhaes'],
    FB: ['Cancelo', 'Alaba', 'Theo Hernandez', 'Davies', 'Alexander-Arnold', 'Wan-Bissaka', 'Reece James', 'Hakimi'],
    DM: ['Rodri', 'Casemiro', 'Kante', 'Tchouameni', 'Fabinho', 'Kimmich', 'Rice', 'Fernandinho'],
    MID: ['De Bruyne', 'Bellingham', 'Pedri', 'Gavi', 'Modric', 'Kroos', 'Valverde'],
    WIDE: ['Salah', 'Saka', 'Doku', 'Nico Williams', 'Sane', 'Grealish', 'Dembele'],
  };
  for (const [bucket, names] of Object.entries(CURATED)) {
    console.log(`\n-- ${bucket} --`);
    for (const n of names) {
      const { data, error } = await sb.from('players').select('*').ilike('name', `%${n}%`).limit(2);
      if (error) { console.log(`${n}: ERROR ${error.message}`); continue; }
      if (!data?.length) { console.log(`${n}: not found`); continue; }
      for (const p of data) printPlayerRow(p);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
