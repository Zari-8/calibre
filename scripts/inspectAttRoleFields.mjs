// scripts/inspectAttRoleFields.mjs — READ-ONLY. No writes.
//
// Before splitting productionComponents()'s ATT branch into striker vs
// winger sub-profiles, need to see what positionBucket()'s own text sources
// (role/position/pos/primary_role/raw_position) actually contain for known
// strikers (Kane, Mbappé, Haaland) vs known wingers (Salah, Vinícius Júnior)
// — no point writing classification regex against guessed field values.
//
// Run: node scripts/inspectAttRoleFields.mjs
//      NAMES="Kane,Salah,..." node scripts/inspectAttRoleFields.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { positionBucket } from '../src/services/calibreRating.js';

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

const DEFAULT_NAMES = ['H. Kane', 'Mbappé', 'Haaland', 'Mohamed Salah', 'Vinícius Júnior', 'Son', 'Vlahovic', 'Osimhen', 'Grealish', 'Saka'];
const NAMES = (process.env.NAMES ? process.env.NAMES.split(',') : DEFAULT_NAMES).map(s => s.trim()).filter(Boolean);

async function run() {
  const { data, error } = await sb.from('players').select('*')
    .or(NAMES.map(n => `name.ilike.%${n}%`).join(','));
  if (error) { console.error('Query failed:', error.message); process.exit(1); }
  if (!data?.length) { console.log('No matches.'); return; }

  for (const row of data) {
    if (!(row.minutes > 0) && !(row.appearances > 0)) continue; // skip hollow name-collisions
    const bucket = positionBucket(row);
    if (bucket !== 'ATT') continue;
    console.log('═'.repeat(70));
    console.log(`${row.name} (${row.team ?? '—'})`);
    console.log(`  role=${JSON.stringify(row.role)}  position=${JSON.stringify(row.position)}  pos=${JSON.stringify(row.pos)}`);
    console.log(`  primary_role=${JSON.stringify(row.primary_role)}  raw_position=${JSON.stringify(row.raw_position)}`);
  }
  console.log('═'.repeat(70));
}

run().catch(e => { console.error('\nFatal:', e?.message ?? e); process.exit(1); });
