// ============================================================
// backtestDataPull2.mjs — follow-up probe after backtestDataPull.mjs came
// back with 0 completed transfers.
// ------------------------------------------------------------
// 1. Loose look at the `transfers` table with no status/season filter, so
//    we can see what's actually in there (maybe the filter combo just
//    didn't match anything, not that the table is empty).
// 2. Look up several real, well-known players by name in the `players`
//    registry (regardless of current club) — if any of these are
//    enriched, it gives real per-90 stats to replace the hand-approximated
//    traits used in the first backtest pass.
//
// USAGE:
//   cd ~/Desktop/calibre-github
//   node scripts/backtestDataPull2.mjs
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

async function main() {
  console.log('=== 1. transfers table — no filters, most recent 20 ===');
  const { data: all, error: allErr } = await sb
    .from('transfers')
    .select('player_name,from_club,to_club,fee_millions,status,season,published,created_at')
    .order('created_at', { ascending: false })
    .limit(20);
  if (allErr) console.error('error:', allErr.message);
  console.log(`${all?.length ?? 0} rows total (any status/season/published value).`);
  for (const t of (all || [])) {
    console.log(`  status=${String(t.status).padEnd(8)} season=${String(t.season).padEnd(10)} published=${String(t.published).padEnd(5)}  ${t.player_name} : ${t.from_club} -> ${t.to_club}  €${t.fee_millions}m`);
  }
  const { count: totalCount } = await sb.from('transfers').select('*', { count: 'exact', head: true });
  console.log(`\nTotal rows in transfers table (any filter): ${totalCount}`);

  console.log('\n=== 2. Registry lookup for backtest players (by name, any club) ===');
  const NAMES = ['Higuain', 'Higuaín', 'Lukaku', 'Haaland', 'Rice', 'Coutinho', 'Griezmann', 'Isco'];
  for (const n of NAMES) {
    const { data, error } = await sb.from('players').select('*').ilike('name', `%${n}%`).limit(3);
    if (error) { console.log(`${n}: ERROR ${error.message}`); continue; }
    if (!data?.length) { console.log(`${n}: not found`); continue; }
    for (const p of data) {
      console.log(`${n} -> MATCH: ${JSON.stringify({
        name: p.name, team: p.team ?? p.club, position: p.position ?? p.pos, age: p.age,
        minutes: p.minutes ?? p.stats_minutes, passes: p.passes, pass_accuracy: p.pass_accuracy,
        tackles: p.tackles, interceptions: p.interceptions, shots: p.shots ?? p.shots_total,
        goals: p.goals, assists: p.assists, api_average_rating: p.api_average_rating,
      })}`);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
