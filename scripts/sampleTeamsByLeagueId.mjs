// scripts/sampleTeamsByLeagueId.mjs — READ-ONLY. No writes, no API-Football
// calls at all — just Supabase reads. Built because API-Football's daily
// quota is currently exhausted (lookupLeagueNames.mjs came back empty for
// everything), so a handful of league_ids in the scored population
// (13,12,82,64,139,949,399) have no confirmed name yet. Team names already
// sitting in our own DB are human-readable and instantly reveal the real
// league without needing a single external API call — same technique
// checkLeagueIdMapping.mjs used for the Paderborn case.
//
// Run: node scripts/sampleTeamsByLeagueId.mjs
//      IDS=13,12 node scripts/sampleTeamsByLeagueId.mjs   (custom list)
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

const DEFAULT_IDS = [13, 12, 82, 64, 139, 949, 399];
const IDS = process.env.IDS ? process.env.IDS.split(',').map(Number) : DEFAULT_IDS;

async function run() {
  console.log('Sampling team names per unresolved league_id — read-only, no API-Football calls.\n');
  for (const id of IDS) {
    const { data, error } = await sb
      .from('players')
      .select('team')
      .eq('league_id', id)
      .not('team', 'is', null)
      .limit(2000);
    if (error) { console.log(`league_id=${id}: query failed (${error.message})`); continue; }
    const counts = new Map();
    for (const r of data ?? []) counts.set(r.team, (counts.get(r.team) || 0) + 1);
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    console.log(`league_id=${id}  (${data?.length ?? 0} player rows sampled, ${counts.size} distinct teams)`);
    for (const [team, n] of top) console.log(`    ${team}  (${n})`);
    console.log('');
  }
}

run().catch(e => { console.error('\nFatal:', e?.message ?? e); process.exit(1); });
