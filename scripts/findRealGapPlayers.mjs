/**
 * findRealGapPlayers.mjs — READ-ONLY.
 * The original "573 real-gap players" task predates the context available
 * this session — no script or saved query defines it, and the DB has
 * changed enormously since (position overlay, duplicate merges, GK fields,
 * discipline/penalty fields, xG shape, archetype redesign). Rebuilding that
 * exact number from memory isn't reliable, so this redefines it fresh:
 *
 *   "real gap player" = has real playing evidence (minutes > 0 or
 *   appearances > 0) but is missing at least one CORE field the rating
 *   engine actually scores on: pass_accuracy, api_average_rating, or (for
 *   outfielders) tackles/interceptions/duels_won.
 *
 * Writes the matching player ids to scripts/output/gap_players.txt (one per
 * line) instead of dumping them to the terminal — enrichPlayerStats.mjs now
 * accepts TARGET_UUIDS_FILE=<path> to consume that file directly, so this
 * chains into a single follow-up command with no manual copy/paste.
 *
 * Run:
 *   node scripts/findRealGapPlayers.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
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
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const PAGE = 1000;

async function fetchAll() {
  const all = [];
  let from = 0;
  for (;;) {
    const { data, error } = await sb
      .from('players')
      .select('id,name,team,league_id,minutes,appearances,pass_accuracy,api_average_rating,tackles,interceptions,duels_won,position,pos,primary_role,hidden')
      .or('hidden.is.null,hidden.eq.false')
      .or('minutes.gt.0,appearances.gt.0')
      .range(from, from + PAGE - 1);
    if (error) { console.error('Fetch error:', error.message); process.exit(1); }
    if (!data?.length) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

function isGoalkeeper(p) {
  const t = `${p.position || ''} ${p.pos || ''} ${p.primary_role || ''}`.toLowerCase();
  return /goalkeeper|keeper|\bgk\b/.test(t);
}

async function main() {
  console.log('Scanning for real-gap players (read-only)...\n');
  const all = await fetchAll();
  console.log(`Players with real minutes/appearances evidence: ${all.length}`);

  const gaps = all.filter((p) => {
    if (p.api_average_rating == null) return true;
    if (p.pass_accuracy == null) return true;
    if (!isGoalkeeper(p) && (p.tackles == null || p.interceptions == null || p.duels_won == null)) return true;
    return false;
  });

  console.log(`Real-gap players (missing a core scored field): ${gaps.length}\n`);

  const byLeague = new Map();
  for (const p of gaps) {
    const key = p.league_id ?? 'unknown';
    byLeague.set(key, (byLeague.get(key) || 0) + 1);
  }
  console.log('By league_id (top 20):');
  [...byLeague.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)
    .forEach(([lid, n]) => console.log(`  league_id ${String(lid).padEnd(8)} ${n}`));

  const ids = gaps.map((p) => p.id);
  const outDir = join(ROOT, 'scripts', 'output');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'gap_players.txt');
  writeFileSync(outPath, ids.join('\n') + '\n', 'utf8');

  console.log(`\nWrote ${ids.length} player ids to: ${outPath}`);
  console.log('\nNext step — feed this straight into enrichPlayerStats.mjs, no pasting:');
  console.log(`  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... API_FOOTBALL_KEY=... \\`);
  console.log(`  FORCE=1 TARGET_UUIDS_FILE=${outPath} \\`);
  console.log(`  node scripts/enrichPlayerStats.mjs`);
  console.log('\n(add DRY_RUN=1 to preview first; MAX_PLAYERS auto-sizes to the full file)');

  console.log('\nDone.');
}

main().catch((e) => { console.error(e); process.exit(1); });
