// scripts/componentCeilingCheck.mjs — READ-ONLY. No writes.
//
// Sizes the MID/DEF ceiling-saturation problem behind the Aleix García /
// C. Romero-shaped inflation: MID's `progress` (weight 0.58, clamp ceiling
// 126) and DEF's `defend` (weight 0.66, clamp ceiling 118) are each the
// single dominant term in their bucket, and inspectProductionComponents.mjs
// showed both landing AT or right against their hard ceiling for players who
// are good, not generational (Aleix García's progress=126.0, exactly maxed;
// C. Romero/Carlos Romero's defend=118.0/115.8, both essentially maxed).
// Compare to Kane/Mbappé, where the equivalent dominant term (ATT's
// goalScore) reflects genuinely rare production (131.7/112.7) rather than a
// bar any good possession-team regular clears.
//
// This prints the REAL percentile distribution of progress (MID) and defend
// (DEF) across every scored player, so the fix can raise each ceiling's
// effective bar to match genuine rarity (e.g. the same ~top-0.5-1% rarity
// that produces a Kane/Mbappé-tier goalScore) instead of guessing a number.
//
// Run: node scripts/componentCeilingCheck.mjs
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

const PAGE = 500;

async function fetchAll() {
  const rows = [];
  let offset = 0;
  while (true) {
    const { data, error } = await sb
      .from('players')
      .select('*')
      .or('minutes.gt.0,appearances.gt.0,api_average_rating.gt.0')
      .order('id', { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) { console.error('Fetch failed:', error.message); process.exit(1); }
    if (!data || data.length === 0) break;
    rows.push(...data);
    offset += data.length;
    process.stdout.write(`\r  fetched ${rows.length} rows...`);
    if (data.length < PAGE) break;
  }
  process.stdout.write('\n');
  return rows;
}

function safe(fn, ...args) { try { return fn(...args); } catch { return null; } }
function pct(arr, p) {
  const s = [...arr].sort((a, b) => a - b);
  if (!s.length) return null;
  const idx = Math.round((p / 100) * (s.length - 1));
  return s[idx];
}

async function run() {
  console.log('MID progress / DEF defend / ATT goalScore ceiling check — read-only.\n');
  const rows = await fetchAll();

  const mid = [], def = [], att = [], midRaw = [], defRaw = [];
  for (const r of rows) {
    const bucket = positionBucket(r);
    if (bucket !== 'MID' && bucket !== 'DEF' && bucket !== 'ATT') continue;
    const c = safe(productionComponents, r, bucket);
    if (!c) continue;
    if (bucket === 'MID') { mid.push(c.vals[0]); midRaw.push(c.raw?.[0]); }   // progress (clamped, unclamped)
    if (bucket === 'DEF') { def.push(c.vals[0]); defRaw.push(c.raw?.[0]); }   // defend (clamped, unclamped)
    if (bucket === 'ATT') att.push(c.vals[0]);        // goalScore, for reference
  }

  console.log(`MID rows: ${mid.length}   DEF rows: ${def.length}   ATT rows: ${att.length}\n`);
  console.log(String('Percentile').padEnd(12) + String('MID progress (ceil 126)').padEnd(26) + String('DEF defend (ceil 118)').padEnd(24) + 'ATT goalScore (ceil ~140, ref only)');
  for (const p of [50, 75, 90, 95, 97, 98, 99, 99.5, 100]) {
    console.log(`p${p}`.padEnd(12) + String(pct(mid, p) ?? '—').padEnd(26) + String(pct(def, p) ?? '—').padEnd(24) + String(pct(att, p) ?? '—'));
  }

  const midAtCeiling = mid.filter(v => v >= 125.5).length;
  const defAtCeiling = def.filter(v => v >= 117.5).length;
  console.log(`\nMID rows within 0.5 of the progress ceiling (126): ${midAtCeiling} (${((midAtCeiling/mid.length)*100).toFixed(2)}%)`);
  console.log(`DEF rows within 0.5 of the defend ceiling (118): ${defAtCeiling} (${((defAtCeiling/def.length)*100).toFixed(2)}%)`);

  console.log('\n── UNCLAMPED tail (what the formula outputs before the hard clamp — shows how far past the ceiling the real distribution goes) ──');
  console.log(String('Percentile').padEnd(12) + String('MID progress raw').padEnd(20) + 'DEF defend raw');
  for (const p of [90, 95, 97, 98, 99, 99.5, 100]) {
    console.log(`p${p}`.padEnd(12) + String(pct(midRaw, p)?.toFixed?.(1) ?? '—').padEnd(20) + String(pct(defRaw, p)?.toFixed?.(1) ?? '—'));
  }
}

run().catch(e => { console.error('\nFatal:', e?.message ?? e); process.exit(1); });
