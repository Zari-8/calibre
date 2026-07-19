// scripts/inspectAttBreakdown.mjs — READ-ONLY. Shows the internal ATT
// production components (goalScore/create/carry) for a named player, OLD
// (live, spine-bugged) vs NEW (spine-fixed, calibrated), so a "why did this
// specific player drop" question can be answered from the actual numbers
// instead of guessed at.
//
// Usage: NAME="abel ruiz" node scripts/inspectAttBreakdown.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { calibreRating as calibreRatingNEW, productionComponents as productionComponentsNEW, positionBucket } from '../src/services/calibreRating.js';
import { calibreRating as calibreRatingOLD, productionComponents as productionComponentsOLD } from './_tmp_calib/calibreRating.OLD.js';

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
const ID = process.env.ID;
if (!NAME && !ID) { console.error('Set NAME="player name" or ID=<uuid>'); process.exit(1); }

let rows;
if (ID) {
  ({ data: rows } = await sb.from('players').select('*').eq('id', ID));
} else {
  ({ data: rows } = await sb.from('players').select('*').ilike('name', `%${NAME}%`).order('minutes', { ascending: false, nullsFirst: false }));
}

if (!rows?.length) { console.log('No matching row.'); process.exit(0); }
if (rows.length > 1 && !ID) {
  console.log(`${rows.length} matches — showing the one with most minutes (${rows[0].name}, ${rows[0].team ?? '—'}). Narrow with ID=<uuid> if you meant a different one:\n`);
  for (const r of rows.slice(0, 8)) console.log(`  ${r.id}  ${r.name.padEnd(24)} team=${r.team ?? '—'}  minutes=${r.minutes ?? '—'}`);
  console.log('');
}

const data = rows[0];
const bucket = positionBucket(data);
console.log(`${data.name} (${data.team ?? '—'}, age ${data.age ?? '—'}, bucket ${bucket})`);
console.log('raw stats:', { minutes: data.minutes, goals: data.goals, assists: data.assists, xg: data.xg, xa: data.xa, api_average_rating: data.api_average_rating, shot_accuracy: data.shot_accuracy });

if (bucket === 'ATT') {
  const cOld = productionComponentsOLD(data, 'ATT');
  const cNew = productionComponentsNEW(data, 'ATT');
  console.log('\n[goalScore, create, carry]  weights [0.76, 0.16, 0.08]');
  console.log('  OLD vals:', cOld.vals.map(v => v.toFixed(1)));
  console.log('  NEW vals:', cNew.vals.map(v => v.toFixed(1)), '(should be identical to OLD — spine() only changes how weights PAIR with these, not the vals themselves)');
  const sortedOld = [...cOld.vals].sort((a, b) => b - a);
  console.log(`  OLD spine() paired 0.76 with: ${sortedOld[0] === cOld.vals[0] ? 'goalScore (no swap happened)' : sortedOld[0] === cOld.vals[1] ? 'create <- bug: got goal-threat\'s weight' : 'carry <- bug'}`);
  console.log(`  NEW spine() pairs 0.76 with: goalScore (always, by position, correct)`);
}

const old = calibreRatingOLD(data);
const now = calibreRatingNEW(data);
console.log('\nOLD (live) full result:', JSON.stringify(old, null, 2));
console.log('\nNEW (spine-fixed, calibrated) full result:', JSON.stringify(now, null, 2));
