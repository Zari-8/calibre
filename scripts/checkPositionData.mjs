// scripts/checkPositionData.mjs — READ-ONLY. Prints exactly the fields
// positionBucket() reads (role, position, pos, primary_role, raw_position)
// plus the bucket it resolves to, for a named player.
//
// Usage: NAME="ferran torres" node scripts/checkPositionData.mjs
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

const NAME = process.env.NAME;
if (!NAME) { console.error('Set NAME="player name"'); process.exit(1); }

const { data, error } = await sb.from('players').select('*').ilike('name', `%${NAME}%`).order('name');
if (error) { console.error(error.message); process.exit(1); }
if (!data?.length) { console.log('No matching row.'); process.exit(0); }

for (const row of data) {
  console.log(`\n${row.name}  (${row.team ?? '—'}, id=${row.id})`);
  console.log('  role:', row.role, ' position:', row.position, ' pos:', row.pos, ' primary_role:', row.primary_role, ' raw_position:', row.raw_position, ' archetype:', row.archetype);
  console.log('  resolved bucket:', positionBucket(row));
}
