// scripts/inspectAttProductionComponents.mjs — READ-ONLY. No writes.
//
// inspectEliteRatingBreakdown.mjs showed Salah/Vinícius Júnior (ATT bucket)
// landing at production=47/62 despite being undisputed top-tier players,
// while Kane/Mbappé/Haaland sit at production=98-116. Root cause traced into
// productionComponents(): the ATT branch is spine([goalScore, create, carry],
// [0.76, 0.16, 0.08]) — goalScore alone carries 76% of the weight, and it's
// benchmarked to a 0.92 goals/90 rate + 34-goal volume target for full credit
// (roughly a 35-goal season) — a bar calibrated to true one-in-a-generation
// poachers, not "merely" world-class attackers.
//
// This pulls named ATT players directly, calls the real productionComponents()
// (same function computeRatings.mjs/calibreRating.js use — no reimplementation)
// to get the actual [goalScore, create, carry] sub-values, then shows what
// `production` would be under the CURRENT weights vs candidate rebalanced
// weights — so any new split gets validated against Kane/Mbappé/Haaland (must
// not regress) AND Salah/Vinícius (must lift) before it's ever written into
// calibreRating.js for real.
//
// Run: node scripts/inspectAttProductionComponents.mjs
//      NAMES="Salah,Vinicius,Kane,Mbappe,Haaland,Son" node scripts/inspectAttProductionComponents.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { productionComponents, positionBucket } from '../src/services/calibreRating.js';

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

const DEFAULT_NAMES = ['H. Kane', 'Mbappé', 'Haaland', 'Mohamed Salah', 'Vinícius Júnior'];
const NAMES = (process.env.NAMES ? process.env.NAMES.split(',') : DEFAULT_NAMES).map(s => s.trim()).filter(Boolean);

// Candidate rebalanced weight sets to compare against the current [0.76,0.16,0.08].
// Keys are just labels; values must sum to 1.
const CANDIDATES = {
  current:        [0.76, 0.16, 0.08],
  moderate:        [0.68, 0.22, 0.10],
  proposed_60_28_12: [0.60, 0.28, 0.12],
  aggressive:      [0.52, 0.34, 0.14],
};

function spine(vals, w) { let p = 0; vals.forEach((v, i) => { p += v * (w[i] ?? 0); }); return p; }

async function run() {
  const { data, error } = await sb.from('players').select('*')
    .or(NAMES.map(n => `name.ilike.%${n}%`).join(','));
  if (error) { console.error('Query failed:', error.message); process.exit(1); }
  if (!data?.length) { console.log('No matches.'); return; }

  for (const row of data) {
    const bucket = positionBucket(row);
    if (bucket !== 'ATT') continue; // only ATT-bucket rows use goalScore/create/carry
    // Skip clearly-hollow rows (no real minutes/apps) so noisy name-collisions don't clutter output
    if (!(row.minutes > 0) && !(row.appearances > 0)) continue;

    let pc;
    try { pc = productionComponents(row, 'ATT'); } catch (e) { console.log(`${row.name}: productionComponents() threw: ${e.message}`); continue; }
    const [goalScore, create, carry] = pc.vals;

    console.log('═'.repeat(70));
    console.log(`${row.name} (${row.team ?? '—'})  minutes=${row.minutes}  goals=${row.goals}  assists=${row.assists}`);
    console.log(`  raw sub-components: goalScore=${goalScore.toFixed(2)}  create=${create.toFixed(2)}  carry=${carry.toFixed(2)}`);
    for (const [label, w] of Object.entries(CANDIDATES)) {
      const prod = spine([goalScore, create, carry], w);
      console.log(`  [${label.padEnd(18)}] w=${w.map(x => x.toFixed(2)).join('/')}  ->  production=${clampPrint(prod)}`);
    }
  }
  console.log('═'.repeat(70));
}
function clampPrint(v) { return Math.max(0, Math.min(116, v)).toFixed(1); }

run().catch(e => { console.error('\nFatal:', e?.message ?? e); process.exit(1); });
