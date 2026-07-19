// scripts/findByTeam.mjs — READ-ONLY. Finds players by a team fragment AND
// (optionally) a name fragment, since some names don't match the obvious
// search term (e.g. Tottenham's Cristian Romero not turning up under
// NAME="cristian romero" or NAME="cristian").
//
// Usage:
//   TEAM="Tottenham" node scripts/findByTeam.mjs
//   TEAM="Tottenham" NAME="romero" node scripts/findByTeam.mjs
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

const TEAM = process.env.TEAM;
const NAME = process.env.NAME;
if (!TEAM) { console.error('Set TEAM="team fragment"'); process.exit(1); }

let q = sb.from('players').select('id,name,team,rating,minutes,position,pos').ilike('team', `%${TEAM}%`);
if (NAME) q = q.ilike('name', `%${NAME}%`);
const { data, error } = await q.order('minutes', { ascending: false, nullsFirst: false });
if (error) { console.error('Fetch failed:', error.message); process.exit(1); }
if (!data?.length) { console.log('No matches.'); process.exit(0); }

console.log(`${data.length} matches:\n`);
for (const r of data) {
  console.log(`  ${r.id}  ${String(r.name).padEnd(24)} team=${r.team ?? '—'}  minutes=${r.minutes ?? '—'}  pos=${r.position ?? r.pos ?? '—'}  rating=${r.rating ?? '—'}`);
}
