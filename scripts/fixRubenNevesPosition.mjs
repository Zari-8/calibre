/**
 * fixRubenNevesPosition.mjs
 * Ruben Neves (Al-Hilal Saudi FC) is a real defensive midfielder — Wolves'
 * long-time DM, now at Al-Hilal — but his stored position/pos/primary_role/
 * raw_position fields say DEF/Defender. api_position and statsapi_position
 * are both null for him (no measured overlay data), so this isn't the
 * position-overlay override misfiring — it's the underlying text fields
 * themselves being wrong, same class of bug as the Rashford fix earlier
 * this session (targeted single-player correction, not a systemic issue
 * found elsewhere yet).
 *
 * Confirmed live via SQL (2026-07-13):
 *   name,team,position,pos,primary_role,raw_position,api_position,statsapi_position
 *   Rúben Neves,Al-Hilal Saudi FC,DEF,DEF,Defender,Defender,null,null
 *
 * DRY_RUN by default. Run:
 *   node scripts/fixRubenNevesPosition.mjs
 * Then to write:
 *   DRY_RUN=0 node scripts/fixRubenNevesPosition.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
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
const DRY_RUN = process.env.DRY_RUN !== '0';

if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const PATCH = {
  position: 'MID',
  pos: 'DM',
  primary_role: 'Defensive Midfielder',
  raw_position: 'Midfielder',
};

async function main() {
  console.log(DRY_RUN ? 'DRY RUN — no writes.\n' : 'LIVE RUN.\n');

  const { data, error } = await sb.from('players')
    .select('id,name,team,position,pos,primary_role,raw_position')
    .ilike('name', '%neves%')
    .ilike('team', '%hilal%');
  if (error) { console.error('Fetch error:', error.message); process.exit(1); }
  if (!data?.length) { console.log('No matching row found (name~neves, team~hilal) — nothing to fix.'); return; }

  for (const row of data) {
    console.log(`"${row.name}" (${row.team}) id=${row.id}`);
    console.log(`  before: position=${row.position} pos=${row.pos} primary_role=${row.primary_role} raw_position=${row.raw_position}`);
    console.log(`  after:  position=${PATCH.position} pos=${PATCH.pos} primary_role=${PATCH.primary_role} raw_position=${PATCH.raw_position}`);
    if (!DRY_RUN) {
      const { error: e2 } = await sb.from('players').update(PATCH).eq('id', row.id);
      if (e2) console.log(`  ERROR: ${e2.message}`);
      else console.log('  updated');
    }
  }
  console.log(DRY_RUN ? '\nDRY RUN complete. Re-run with DRY_RUN=0 to write, then re-run recomputeArchetypes.mjs to refresh his archetype label.' : '\nDone.');
}

main().catch(e => { console.error(e); process.exit(1); });
