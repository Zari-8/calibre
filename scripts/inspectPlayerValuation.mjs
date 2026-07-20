// scripts/inspectPlayerValuation.mjs — READ-ONLY. Runs the real
// calibreValue() engine (src/services/calibreValue.js) against a real player
// row by name, printing the full breakdown — including the new Injury /
// Durability Risk factor now that scripts/backfillPlayerInjuries.mjs has
// populated injury_days_last_365 / major_injuries_count / injuries_synced_at
// for real. Built to check Ansu Fati's real number against the actual €11m
// Monaco fee / €15m Transfermarkt estimate discussed this session, but works
// for anyone by name.
//
//   node scripts/inspectPlayerValuation.mjs
//   NAME="ansu fati" node scripts/inspectPlayerValuation.mjs

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { calibreValue } from '../src/services/calibreValue.js';

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

const NAME = process.env.NAME || 'ansu fati';

const { data, error } = await sb.from('players').select('*').ilike('name', `%${NAME}%`);
if (error) { console.error(error.message); process.exit(1); }
if (!data || !data.length) { console.error(`No player matched "${NAME}"`); process.exit(1); }

for (const player of data) {
  console.log(`\n══════════ ${player.name} (${player.team || 'no team'}) ══════════`);
  console.log('── raw row (valuation-relevant fields) ──');
  console.log({
    age: player.age, team: player.team, position: player.position || player.pos,
    rating: player.rating, ability_rating: player.ability_rating, availability_score: player.availability_score,
    injury_days_last_365: player.injury_days_last_365,
    major_injuries_count: player.major_injuries_count,
    injuries_synced_at: player.injuries_synced_at,
  });

  const result = calibreValue(player);
  console.log('\n── calibreValue() live recompute ──');
  console.log(JSON.stringify(result, null, 2));
}
