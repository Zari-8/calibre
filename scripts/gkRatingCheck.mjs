// scripts/gkRatingCheck.mjs — READ-ONLY. No writes.
//
// GKs skip productionComponents() entirely (see scoreLine()'s bucket==='GK'
// branch) — production is q (from api_average_rating) blended with real
// save% shot-stopping ONLY once shotsFaced (saves+goals_conceded) is known,
// ramping to full 35% trust at 40 shots faced; with no save/conceded data at
// all it falls back to production = q*0.9 + buildNudge, i.e. GK rating is
// ~90% a direct function of api_average_rating alone. That's a plausible
// mechanism for systemic GK over-rating if a) save/goals_conceded coverage
// is thin, and/or b) apiR itself runs generously for keepers (small sample
// at a small club, or the source API just rates GKs kindly). This surfaces
// both: how many GK ratings are running with real shot-stopping evidence
// vs the apiR-only fallback, and the top of the GK rating distribution with
// the inputs that produced it.
//
// Run: node scripts/gkRatingCheck.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { calibreRating as calibreRatingNEW, positionBucket } from '../src/services/calibreRating.js';

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

function safe(fn, row) { try { return fn(row); } catch { return null; } }

async function run() {
  console.log('GK rating check — read-only.\n');
  const rows = await fetchAll();
  const gks = rows.filter(r => positionBucket(r) === 'GK');
  console.log(`${gks.length} GK-bucket rows.\n`);

  let withShotData = 0, withoutShotData = 0;
  const scored = [];
  for (const r of gks) {
    const res = safe(calibreRatingNEW, r);
    if (!res || !Number.isFinite(res.rating)) continue;
    const saves = Number(r.saves), conceded = Number(r.goals_conceded);
    const shotsFaced = (Number.isFinite(saves) && Number.isFinite(conceded)) ? saves + conceded : null;
    if (shotsFaced != null && shotsFaced > 0) withShotData++; else withoutShotData++;
    scored.push({
      name: r.name, team: r.team ?? '—', minutes: r.minutes,
      apiR: r.api_average_rating, saves, conceded, shotsFaced,
      rating: res.rating,
    });
  }

  console.log(`GK rows scored: ${scored.length}`);
  console.log(`  WITH real save/goals_conceded data (shot-stopping signal used): ${withShotData}`);
  console.log(`  WITHOUT it (falls back to production = apiR-derived q*0.9 — reputation only): ${withoutShotData}`);
  console.log(`  -> ${((withoutShotData / scored.length) * 100).toFixed(0)}% of GK ratings are running on api_average_rating alone, no independent shot-stopping check.\n`);

  scored.sort((a, b) => b.rating - a.rating);
  console.log('── Top 25 GK ratings ──');
  console.log(String('Rating').padEnd(8) + String('Name').padEnd(22) + String('Team').padEnd(20) + String('Mins').padEnd(6) + String('apiR').padEnd(6) + String('Saves').padEnd(7) + String('Conc').padEnd(6) + 'ShotsFaced');
  for (const g of scored.slice(0, 25)) {
    console.log(
      String(g.rating).padEnd(8) + String(g.name).padEnd(22) + String(g.team).padEnd(20) + String(g.minutes ?? '—').padEnd(6) +
      String(g.apiR ?? '—').padEnd(6) + String(g.saves ?? '—').padEnd(7) + String(g.conceded ?? '—').padEnd(6) + String(g.shotsFaced ?? 'NO DATA')
    );
  }

  const bands = [[90,99],[85,89],[80,84],[75,79],[0,74]];
  console.log('\n── GK rating bands ──');
  for (const [lo,hi] of bands) {
    const n = scored.filter(g => g.rating >= lo && g.rating <= hi).length;
    console.log(`  ${lo}-${hi}: ${n}  (${((n/scored.length)*100).toFixed(1)}%)`);
  }
}

run().catch(e => { console.error('\nFatal:', e?.message ?? e); process.exit(1); });
