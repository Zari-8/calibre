// scripts/scanEliteOutliers.mjs — READ-ONLY. No writes.
//
// Built overnight (v8.7 follow-up) at Zari's request: "scan for the outliers
// and those not traditionally big names with very high or elite ratings and
// interrogate their stats." This does NOT assume "obscure = wrong" — plenty
// of real players (Carlos Romero investigated below is one candidate) earn a
// high rating on genuine production. It just surfaces every elite-rated
// (>=THRESHOLD) player NOT on a small manually-curated "recognizable club"
// allowlist, plus a handful of automatic red flags per player so a human can
// tell at a glance which ones are worth a closer look vs. which are just a
// very good season from a mid-table player:
//   - hidden duplicate row sharing the same statsapi_player_id (the
//     Lewandowski xg-mixup bug's signature)
//   - stats_minutes/minutes mismatch >15% (partial-record inflation)
//   - assists far above xa (>1.6x, min 6 assists) — set-piece/luck flag,
//     not necessarily wrong, just worth knowing (this is the Bruno Fernandes
//     pattern; schema has no per-assist origin data to confirm further)
//   - api_average_rating missing entirely (rating riding on stats alone)
//   - position bucket possibly mismatched (text says one thing, regex
//     resolves another — reuses the Ferran Torres bug's signature)
//
// Run under the SPINE-FIXED + CALIBRATED + FLOOR engine (current working
// tree), which is what would actually ship, not the currently-live buggy one.
//
// Usage:
//   node scripts/scanEliteOutliers.mjs
//   THRESHOLD=88 node scripts/scanEliteOutliers.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { calibreRating, positionBucket } from '../src/services/calibreRating.js';

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

const THRESHOLD = Number(process.env.THRESHOLD || 87);
const PAGE = 1000;

// Deliberately small and conservative — teams whose star players SHOULD be
// elite-rated, so we don't waste review time re-confirming the obvious
// (Real Madrid/Man City/Bayern etc.). Everyone else with an elite rating
// gets surfaced for a look, big club or not — a genuine Bundesliga-title
// contender's best player belongs on the list just as much as a mid-table
// side's overperforming one; the point is "is this rating explained by the
// data," not "is this player famous."
const RECOGNIZABLE = [
  'real madrid','barcelona','manchester city','manchester united','liverpool',
  'arsenal','chelsea','tottenham','bayern','dortmund','psg','paris saint',
  'juventus','inter milan','ac milan','napoli','atletico madrid','atlético madrid',
];

function isRecognizable(team) {
  const t = String(team || '').toLowerCase();
  return RECOGNIZABLE.some(name => t.includes(name));
}

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
  console.log(`Elite outlier scan — threshold rating >= ${THRESHOLD}. Read-only.\n`);
  const rows = await fetchAll();

  // Index by statsapi_player_id for the duplicate-row check.
  const byStatsapiId = new Map();
  for (const r of rows) {
    if (!r.statsapi_player_id) continue;
    if (!byStatsapiId.has(r.statsapi_player_id)) byStatsapiId.set(r.statsapi_player_id, []);
    byStatsapiId.get(r.statsapi_player_id).push(r);
  }

  const candidates = [];
  for (const row of rows) {
    const res = safe(calibreRating, row);
    if (!res || !Number.isFinite(res.rating) || res.rating < THRESHOLD) continue;
    if (isRecognizable(row.team)) continue;

    const flags = [];
    const dupes = row.statsapi_player_id ? byStatsapiId.get(row.statsapi_player_id) : null;
    if (dupes && dupes.length > 1) flags.push(`DUPLICATE_ROW(${dupes.length})`);

    const mins = Number(row.minutes), sm = Number(row.stats_minutes);
    if (mins > 0 && sm > 0 && Math.abs(sm - mins) / Math.max(sm, mins) > 0.15) flags.push('MINUTES_MISMATCH');

    const assists = Number(row.assists), xa = Number(row.xa);
    if (assists >= 6 && xa > 0 && assists / xa > 1.6) flags.push('ASSISTS_FAR_ABOVE_XA');

    if (!(Number(row.api_average_rating) > 0)) flags.push('NO_API_RATING');

    const bucket = res.bucket;
    const posText = `${row.role||''} ${row.position||''} ${row.pos||''} ${row.primary_role||''}`.toLowerCase();
    if (bucket === 'ATT' && /defender|centre.?back|full.?back/.test(posText)) flags.push('POSITION_MISMATCH?');
    if (bucket === 'DEF' && /striker|forward|winger/.test(posText)) flags.push('POSITION_MISMATCH?');

    candidates.push({
      id: row.id, name: row.name, team: row.team ?? '—', league_id: row.league_id,
      rating: res.rating, bucket, minutes: row.minutes,
      goals: row.goals, assists: row.assists, api_average_rating: row.api_average_rating,
      flags,
    });
  }

  candidates.sort((a, b) => b.flags.length - a.flags.length || b.rating - a.rating);

  console.log(`\n${candidates.length} elite-rated (>=${THRESHOLD}) players outside the recognizable-club allowlist.\n`);
  console.log('── Flagged (worth a closer look) ──');
  const flagged = candidates.filter(c => c.flags.length > 0);
  for (const c of flagged) {
    console.log(`  ${c.rating}  ${String(c.name).padEnd(22)} ${String(c.team).padEnd(20)} ${c.bucket.padEnd(3)}  G${c.goals ?? '—'}/A${c.assists ?? '—'}  apiR=${c.api_average_rating ?? '—'}  [${c.flags.join(', ')}]  id=${c.id}`);
  }

  console.log(`\n── Clean (no automatic flags — production looks self-consistent) ──`);
  const clean = candidates.filter(c => c.flags.length === 0);
  for (const c of clean) {
    console.log(`  ${c.rating}  ${String(c.name).padEnd(22)} ${String(c.team).padEnd(20)} ${c.bucket.padEnd(3)}  G${c.goals ?? '—'}/A${c.assists ?? '—'}  apiR=${c.api_average_rating ?? '—'}  id=${c.id}`);
  }

  console.log(`\nSummary: ${flagged.length} flagged / ${clean.length} clean / ${candidates.length} total.`);
  console.log('Nothing written. For any flagged player, follow up with:');
  console.log('  ID=<uuid> node scripts/inspectPlayerBreakdown.mjs');
}

run().catch(e => { console.error('\nFatal:', e?.message ?? e); process.exit(1); });
