// scripts/fixRashfordPosition.mjs — targeted single-player correction.
// Rashford's row is stored as position="MID" / archetype="Controller" /
// primary_role="Midfielder" / raw_position="Midfielder" — confirmed via
// compareBreakdown.mjs to be a raw data-entry error, not an engine bug. The
// taxonomy below is copied exactly from a verified-correct attacker row
// (Lewandowski: position="FWD", pos="FWD", primary_role="Forward",
// raw_position="Attacker", archetype="Inside Forward" — a fitting descriptor
// for Rashford's actual role too).
//
// DRY_RUN=1 by default-safe: prints the before/after and does NOT write
// unless you pass DRY_RUN=0 explicitly.
//
// Run (one line, no quotes):
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/fixRashfordPosition.mjs
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... DRY_RUN=0 node scripts/fixRashfordPosition.mjs

import { createClient } from '@supabase/supabase-js';

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
    .ilike('name', '%rashford%')
    .order('minutes', { ascending: false, nullsFirst: false })
    .limit(10);
  if (error) { console.error('Fetch failed:', error.message); process.exit(1); }
  if (!rows?.length) { console.log('No rows matched "rashford".'); return; }

  const row = rows[0];
  console.log(`Target: ${row.name} (id=${row.id}, team=${row.club || row.team}, minutes=${row.minutes})`);
  console.log('  before:', { position: row.position, pos: row.pos, archetype: row.archetype, primary_role: row.primary_role, raw_position: row.raw_position });
  console.log('  after :', FIX);

  if (rows.length > 1) {
    console.log(`\n(note: ${rows.length} rows matched "rashford" — only the top one (most minutes) is being corrected. Others:`);
    rows.slice(1).forEach((r) => console.log(`  ${r.name}  id=${r.id}  minutes=${r.minutes ?? '—'}`));
    console.log(')');
  }

  if (DRY_RUN) {
    console.log('\nDRY RUN — nothing written. Re-run with DRY_RUN=0 to apply.');
    return;
  }

  const { error: upErr } = await sb.from('players').update(FIX).eq('id', row.id);
  if (upErr) { console.error('Update failed:', upErr.message); process.exit(1); }
  console.log('\n✓ Updated.');
}

main().catch((e) => { console.error(e); process.exit(1); });
