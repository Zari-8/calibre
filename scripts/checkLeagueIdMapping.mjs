// scripts/checkLeagueIdMapping.mjs — READ-ONLY. No writes.
//
// Zari's catch: D. Seimen (SC Paderborn 07) rated 90 while Paderborn plays
// in 2. Bundesliga, not the top-flight Bundesliga — but his row's
// leagueStrength printed as 0.98 (calibreRating.js's LEAGUE_ID_STRENGTH[78]
// = 0.98, the top-flight Bundesliga value) in every breakdown pulled
// tonight. If his (or Paderborn's) league_id is actually stored as 78, or
// if 2. Bundesliga has no entry in LEAGUE_ID_STRENGTH and something is
// falling back to a top-flight-adjacent default, that alone could explain a
// meaningful chunk of the inflation this session has been chasing at the
// formula level — a data/mapping bug, not something any amount of weight
// rebalancing fixes. This pulls the raw league_id/league fields directly
// for every Paderborn (and Hamburger SV, for Tangvik) row on record, plus
// every DISTINCT league_id/league_name combination in league_id 78's
// bucket, to see if 2. Bundesliga clubs are bleeding into it.
//
// Run: node scripts/checkLeagueIdMapping.mjs
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

async function run() {
  console.log('League ID mapping check — read-only.\n');

  const { data: pad, error: e1 } = await sb.from('players').select('*').ilike('team', '%paderborn%');
  if (e1) { console.error(e1.message); process.exit(1); }
  console.log('── Paderborn rows ──');
  for (const r of pad ?? []) console.log(`  ${r.name}  league_id=${r.league_id}  league_name=${r.league_name ?? '—'}`);

  const { data: hsv, error: e2 } = await sb.from('players').select('*').ilike('team', '%hamburger%');
  if (e2) { console.error(e2.message); process.exit(1); }
  console.log('\n── Hamburger SV rows ──');
  for (const r of hsv ?? []) console.log(`  ${r.name}  league_id=${r.league_id}  league_name=${r.league_name ?? '—'}`);

  const { data: l78, error: e3 } = await sb.from('players').select('*').eq('league_id', 78);
  if (e3) { console.error(e3.message); process.exit(1); }
  const teams = [...new Set((l78 ?? []).map(r => r.team))].sort();
  console.log(`\n── Every distinct team currently stored under league_id=78 (${teams.length} teams, ${l78?.length ?? 0} rows) ──`);
  for (const t of teams) console.log(`  ${t}`);

  const leagueNames = [...new Set((l78 ?? []).map(r => r.league_name).filter(Boolean))];
  console.log(`\nDistinct league_name values seen under league_id=78: ${JSON.stringify(leagueNames)}`);
}

run().catch(e => { console.error('\nFatal:', e?.message ?? e); process.exit(1); });
