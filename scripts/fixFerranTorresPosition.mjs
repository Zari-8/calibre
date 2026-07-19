// scripts/fixFerranTorresPosition.mjs — targeted single-player correction.
// Same bug pattern as fixRashfordPosition.mjs: Ferran Torres' row is stored
// as position="MID" / pos="MID" / primary_role="Midfielder" /
// raw_position="Midfielder" / archetype="Central Midfielder" — confirmed via
// checkPositionData.mjs to be a raw data-entry error (21 goals / 3 assists in
// 2708 minutes is a striker/winger's statistical shape, not a central mid's,
// and positionBucket() has no way to know better than what's stored). Taxonomy
// copied from the same verified-correct attacker template fixRashfordPosition
// used (Lewandowski's row).
//
// DRY_RUN=1 by default-safe: prints before/after and does NOT write unless
// you pass DRY_RUN=0 explicitly.
//
// Run (one line, no quotes):
//   node scripts/fixFerranTorresPosition.mjs
//   DRY_RUN=0 node scripts/fixFerranTorresPosition.mjs

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

const DRY_RUN = process.env.DRY_RUN !== '0'; // safe-by-default

const FIX = {
  position: 'FWD',
  pos: 'FWD',
  primary_role: 'Forward',
  raw_position: 'Attacker',
  archetype: 'Inside Forward',
};

async function main() {
  const { data: rows, error } = await sb
    .from('players')
    .select('id, name, position, pos, archetype, primary_role, raw_position, team, club, minutes')
    .ilike('name', '%ferran torres%')
    .order('minutes', { ascending: false, nullsFirst: false })
    .limit(10);
  if (error) { console.error('Fetch failed:', error.message); process.exit(1); }
  if (!rows?.length) { console.log('No rows matched "ferran torres".'); return; }

  const row = rows[0];
  console.log(`Target: ${row.name} (id=${row.id}, team=${row.club || row.team}, minutes=${row.minutes})`);
  console.log('  before:', { position: row.position, pos: row.pos, archetype: row.archetype, primary_role: row.primary_role, raw_position: row.raw_position });
  console.log('  after :', FIX);

  if (rows.length > 1) {
    console.log(`\n(note: ${rows.length} rows matched — only the top one (most minutes) is being corrected. Others:`);
    rows.slice(1).forEach((r) => console.log(`  ${r.name}  id=${r.id}  minutes=${r.minutes ?? '—'}`));
    console.log(')');
  }

  if (DRY_RUN) {
    console.log('\nDRY RUN — nothing written. Re-run with DRY_RUN=0 to apply.');
    return;
  }

  const { error: upErr } = await sb.from('players').update(FIX).eq('id', row.id);
  if (upErr) { console.error('Update failed:', upErr.message); process.exit(1); }
  console.log('\n✓ Updated. Position/role fields corrected — players.rating itself is untouched by this');
  console.log('  script (only computeRatings.mjs or the canonical backfill writes ratings). Re-run:');
  console.log('    ID=' + row.id + ' node scripts/inspectPlayerBreakdown.mjs');
  console.log('  to see the corrected LIVE recompute against the ATT bucket before deciding whether to');
  console.log('  write it to the stored rating.');
}

main().catch((e) => { console.error(e); process.exit(1); });
