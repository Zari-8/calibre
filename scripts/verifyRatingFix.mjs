// scripts/verifyRatingFix.mjs
// Read-only. Confirms the calibreRating.js g90/a90/availMin fix actually
// moves the players it was supposed to move, before you run the live
// computeRatings.mjs pass.
//
// Run: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/verifyRatingFix.mjs

import { createClient } from '@supabase/supabase-js';
import { calibreRating } from '../src/services/calibreRating.js';

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!URL || !KEY) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const NAMES = ['guimar', 'eze', 'jack harrison', 'joão neves', 'joao neves', 'gavi'];

const { data, error } = await sb
  .from('players')
  .select('*')
  .or(NAMES.map((n) => `name.ilike.%${n}%`).join(','))
  .order('name');

if (error) { console.error(error.message); process.exit(1); }

console.log('name'.padEnd(22), 'min'.padEnd(6), 'stMin'.padEnd(6), 'app'.padEnd(5), 'g/a'.padEnd(6), 'stored'.padEnd(7), 'oldEngine*'.padEnd(11), 'newEngine', 'delta');
console.log('-'.repeat(90));

let moved = 0;
for (const r of data || []) {
  const min = r.minutes ?? '—';
  const stMin = r.stats_minutes ?? '—';
  const app = r.appearances ?? '—';
  const ga = `${r.goals ?? 0}/${r.assists ?? 0}`;
  const stored = r.rating ?? '—';
  const now = calibreRating(r);
  const newRating = now && now.rating != null ? now.rating : '—';
  const gap = (r.minutes == null && r.stats_minutes > 0) ? '  (was hitting the bug)' : '';
  if (typeof stored === 'number' && typeof newRating === 'number' && stored !== newRating) moved++;
  console.log(
    (r.name || '').padEnd(22),
    String(min).padEnd(6), String(stMin).padEnd(6), String(app).padEnd(5), ga.padEnd(6),
    String(stored).padEnd(7), ''.padEnd(11), String(newRating).padEnd(9), gap
  );
}
console.log(`\n${moved} row(s) above would get a different rating once you re-run computeRatings.mjs.`);
console.log('* "oldEngine" column intentionally left blank — the file on disk IS the fixed engine now, so there is no way to show the pre-fix number from here. Compare "stored" (last live write) vs "newEngine" (fixed engine, live) instead.');
