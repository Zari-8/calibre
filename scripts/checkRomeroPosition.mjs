// ============================================================
// checkRomeroPosition.mjs — resolveRating() classified Cristian Romero
// (Tottenham CB) as bucket 'MID', not 'DEF', which explains the inflated
// 90/89 rating (MID's weights reward passing/creation at 78% combined vs
// DEF's 66% defend weight). positionBucket() in calibreRating.js builds its
// classification text from player.role/position/pos/primary_role/
// raw_position and falls through to 'MID' by default if none of those match
// a GK/DEF/ATT pattern. Neither of the last two backtest scripts selected
// those position fields at all, so this checks what's actually in them.
//
// Run this LOCALLY (sandbox has no live network egress to Supabase).
// USAGE:
//   cd ~/Desktop/calibre-github
//   node scripts/checkRomeroPosition.mjs
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

const { positionBucket } = await import('../src/services/calibreRating.js');

async function main() {
  const { data, error } = await sb
    .from('players')
    .select('name, full_name, team, club, position, pos, primary_role, raw_position, archetype')
    .or('name.ilike.%romero%,full_name.ilike.%romero%')
    .or('team.ilike.%tottenham%,club.ilike.%tottenham%')
    .order('minutes', { ascending: false, nullsFirst: false })
    .limit(1);
  if (error) { console.error('query error:', error.message); return; }
  if (!data || !data.length) { console.log('NOT FOUND'); return; }
  const row = data[0];
  console.log('RAW ROW:', JSON.stringify(row, null, 2));
  console.log('\npositionBucket(row) ->', positionBucket(row));

  // Also sample the wider pool: how many rated players fall through to MID
  // by default because they have NO usable position text at all — tells us
  // if this is a one-off gap or a broader coverage problem.
  const { data: pool, error: e2 } = await sb
    .from('players')
    .select('position, pos, primary_role, raw_position')
    .not('rating', 'is', null)
    .limit(2000);
  if (e2) { console.log('pool query error:', e2.message); return; }
  const blank = pool.filter(r => !(r.position || r.pos || r.primary_role || r.raw_position));
  console.log(`\nOf ${pool.length} sampled rated players, ${blank.length} (${(blank.length / pool.length * 100).toFixed(1)}%) have NO position text in any of position/pos/primary_role/raw_position — these all silently default to bucket 'MID' regardless of their real position.`);
}

main();
