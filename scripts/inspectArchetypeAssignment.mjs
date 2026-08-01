// scripts/inspectArchetypeAssignment.mjs — READ-ONLY. No writes.
//
// calibreRating.js's productionComponents() ATT branch flattens Kane/
// Mbappé/Haaland (poachers) and Salah/Vinícius (wide creators) into one
// shared weight profile, and inspectAttRoleFields.mjs showed the raw
// position/pos/primary_role/raw_position text fields are ALL generically
// "FWD"/"Forward"/"Attacker" for every one of them — no striker/winger
// signal there.
//
// playerTraits.js has its own, richer positionBucket() with a genuine WIDE
// bucket (separate from ATT) and a deriveArchetype() that labels players
// "Poacher" vs "Winger" vs "Inside Forward" vs "Target Man" etc. from real
// per-90 stats (dribbles/key-passes/width/transition), not circularly from
// calibreRating()'s own output. Before reusing that split inside
// calibreRating.js, need to confirm it actually FIRES for real wide players
// given the same generic position text — it's also text-regex-based
// ("wing"/"rw"/"lw"/"rm"/"lm" tokens), so it could have the identical dead-
// signal problem.
//
// Run: node scripts/inspectArchetypeAssignment.mjs
//      NAMES="Kane,Salah,..." node scripts/inspectArchetypeAssignment.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { playerTraits, deriveArchetype } from '../src/services/playerTraits.js';
import { positionBucket as ratingBucket } from '../src/services/calibreRating.js';

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

const DEFAULT_NAMES = ['H. Kane', 'Mbappé', 'Haaland', 'Mohamed Salah', 'Vinícius Júnior', 'Son', 'Grealish', 'Saka'];
const NAMES = (process.env.NAMES ? process.env.NAMES.split(',') : DEFAULT_NAMES).map(s => s.trim()).filter(Boolean);

async function run() {
  const { data, error } = await sb.from('players').select('*')
    .or(NAMES.map(n => `name.ilike.%${n}%`).join(','));
  if (error) { console.error('Query failed:', error.message); process.exit(1); }
  if (!data?.length) { console.log('No matches.'); return; }

  for (const row of data) {
    if (!(row.minutes > 0) && !(row.appearances > 0)) continue;
    if (ratingBucket(row) !== 'ATT') continue; // only ones calibreRating.js currently lumps as ATT

    let pt, arch;
    try { pt = playerTraits(row); arch = deriveArchetype(row); } catch (e) { console.log(`${row.name}: threw ${e.message}`); continue; }

    console.log('═'.repeat(70));
    console.log(`${row.name} (${row.team ?? '—'})`);
    console.log(`  calibreRating.js bucket: ATT (coarse, no split)`);
    console.log(`  playerTraits.js bucket:  ${pt.bucket}   archetype: ${arch}   basis: ${pt.basis}`);
    console.log(`  traits: ${JSON.stringify(pt.traits)}`);
  }
  console.log('═'.repeat(70));
}

run().catch(e => { console.error('\nFatal:', e?.message ?? e); process.exit(1); });
