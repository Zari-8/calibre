// scripts/checkLewandowskiDuplicate.mjs — READ-ONLY.
// Compares the visible "R. Lewandowski" row against the hidden "Robert
// Lewandowski" row (found via NAME="lewandowski" this session — id
// cde18d56-8542-4145-bac2-143687fe50a6, hidden=true) to check whether the
// hidden row is still holding the correct xG data that a prior session's
// merge (fixDuplicateIdentities.mjs) reportedly missed, per its own logged
// field list not including xg/xa/npxg.
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

const IDS = [
  { label: 'VISIBLE (R. Lewandowski)', id: 'bc833b7d-38f3-4d11-a4fb-bee21fb3f7c3' },
  { label: 'HIDDEN (Robert Lewandowski)', id: 'cde18d56-8542-4145-bac2-143687fe50a6' },
];

const FIELDS = 'id,name,team,hidden,statsapi_player_id,api_player_id,minutes,stats_minutes,goals,assists,xg,xa,npxg,shots,total_shots,shot_accuracy,statsapi_enriched_at,api_average_rating,competition_splits';

async function main() {
  for (const { label, id } of IDS) {
    const { data, error } = await sb.from('players').select(FIELDS).eq('id', id).maybeSingle();
    if (error) { console.error(`${label}: fetch failed —`, error.message); continue; }
    if (!data) { console.log(`${label}: no row found for id=${id}`); continue; }
    const { competition_splits, ...rest } = data;
    console.log(`\n${label}`);
    console.log(rest);
    console.log('  competition_splits present:', !!competition_splits);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
