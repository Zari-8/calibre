// scripts/teamRatingsSnapshot.mjs — READ-ONLY. No writes.
// Prints every player on given team(s), current live rating vs. what it'd
// be under the Form-weight fix (src/services/calibreRating.js as it stands
// right now in the working tree), sorted highest to lowest.
//
// Usage:
//   node scripts/teamRatingsSnapshot.mjs
//     -> defaults to FC Barcelona + Real Madrid
//   TEAMS="Liverpool,Arsenal" node scripts/teamRatingsSnapshot.mjs
//     -> comma-separated, matched with ILIKE %term%
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { calibreRating } from '../src/services/calibreRating.js';

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

const TEAMS = (process.env.TEAMS || 'FC Barcelona,Real Madrid').split(',').map(s => s.trim()).filter(Boolean);

async function run() {
  for (const team of TEAMS) {
    const { data, error } = await sb
      .from('players')
      .select('*')
      .ilike('team', `%${team}%`)
      .order('rating', { ascending: false, nullsFirst: false });
    if (error) { console.error(`Fetch failed for "${team}":`, error.message); continue; }
    if (!data?.length) { console.log(`\n=== ${team} — no rows found ===`); continue; }

    console.log(`\n=== ${team} (${data.length} rows — includes any reserve/youth/women's squads matching the name) ===`);
    console.log(String('Name').padEnd(26) + String('Team').padEnd(22) + String('Age').padEnd(5) + String('Live').padEnd(6) + String('Fixed').padEnd(7) + 'Δ');
    for (const row of data) {
      const live = row.rating;
      const fixed = calibreRating(row);
      const fixedR = fixed?.rating ?? null;
      const delta = (live != null && fixedR != null) ? fixedR - live : null;
      console.log(
        String(row.name ?? '—').padEnd(26) +
        String(row.team ?? '—').padEnd(22) +
        String(row.age ?? '—').padEnd(5) +
        String(live ?? '—').padEnd(6) +
        String(fixedR ?? '—').padEnd(7) +
        (delta == null ? '—' : (delta > 0 ? `+${delta}` : delta))
      );
    }
  }
}

run().catch(e => { console.error('\nFatal:', e?.message ?? e); process.exit(1); });
