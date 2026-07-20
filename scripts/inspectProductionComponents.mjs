// scripts/inspectProductionComponents.mjs — READ-ONLY.
// Generic version of inspectAttBreakdown.mjs that works for ANY bucket
// (ATT/MID/DEF/GK), not just ATT — needed to diagnose WHY specific
// non-striker players (Aleix García, C. Romero x2, Szoboszlai) are landing
// at 90+ despite not being anywhere near Ballon d'Or conversation, per
// Zari's read: "garcia, romero, bruno and the rest should be 87 at best...
// mbappe is okay at 90." Shows each bucket's raw component values against
// their weights so we can see which single term is saturating (near its
// clamp ceiling) and driving the score, vs a genuinely well-rounded profile.
//
// Usage:
//   NAME="aleix garcia" node scripts/inspectProductionComponents.mjs
//   ID=<uuid> node scripts/inspectProductionComponents.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { calibreRating, calibreRatingUncalibrated, productionComponents, positionBucket } from '../src/services/calibreRating.js';

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
console.log('raw stats:', {
  minutes: data.minutes, appearances: data.appearances, starts: data.starts,
  goals: data.goals, assists: data.assists, xg: data.xg, xa: data.xa,
  pass_accuracy: data.pass_accuracy, api_average_rating: data.api_average_rating,
  tackles: data.tackles, interceptions: data.interceptions, duels_won: data.duels_won,
});

const LABELS = {
  ATT: ['goalScore', 'create', 'carry'],
  DEF: ['defend', 'build', 'prog', 'att'],
  MID: ['progress', 'create', 'goal', 'carry', 'defend'],
};

if (bucket === 'GK') {
  console.log('\nGK bucket does not use productionComponents() — production blends q (from api_average_rating) with save% shot-stopping directly in scoreLine(). See full result below.');
} else {
  const c = productionComponents(data, bucket);
  const labels = LABELS[bucket] || c.vals.map((_, i) => `v${i}`);
  console.log(`\n[${labels.join(', ')}]  weights [${c.w.join(', ')}]`);
  let weightedSum = 0;
  for (let i = 0; i < c.vals.length; i++) {
    const contribution = c.vals[i] * (c.w[i] ?? 0);
    weightedSum += contribution;
    const pctOfSum = 0; // filled below once total known
    console.log(`  ${labels[i].padEnd(10)} val=${c.vals[i].toFixed(1).padStart(6)}  weight=${(c.w[i] ?? 0).toFixed(2)}  contributes=${contribution.toFixed(1)}`);
  }
  console.log(`  spine() sum (pre-clamp production input) = ${weightedSum.toFixed(1)}`);
  for (let i = 0; i < c.vals.length; i++) {
    const contribution = c.vals[i] * (c.w[i] ?? 0);
    console.log(`  ${labels[i]}: ${((contribution / weightedSum) * 100).toFixed(0)}% of the weighted sum`);
  }
}

const uncalibrated = calibreRatingUncalibrated(data);
console.log(`\nPRE-CALIBRATION raw (what the anchor table needs to place): rating=${uncalibrated.rating}  ability=${uncalibrated.ability}`);

const result = calibreRating(data);
console.log('\nFull calibreRating() result (using CURRENT, possibly-stale anchors):', JSON.stringify(result, null, 2));
