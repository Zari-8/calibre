/**
 * populateFullNames.mjs
 *
 * Populates the full_name column for all players where:
 *   - full_name is NULL, AND
 *   - firstname OR lastname is present (already stored from API-Football enrichment)
 *
 * If firstname/lastname are also null for a row, falls back to expanding the
 * abbreviated name: "L. Messi" → cannot expand, leaves null (needs API call).
 *
 * Run:
 *   node scripts/populateFullNames.mjs
 *
 * Env (reads from .env.local):
 *   VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  (or SUPABASE_SERVICE_KEY)
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── Load .env.local ──────────────────────────────────────────────
function loadEnv(){
  const envPath = join(ROOT, '.env.local');
  try {
    const lines = readFileSync(envPath, 'utf8').split('\n');
    for(const line of lines){
      const m = line.match(/^([^#=\s]+)\s*=\s*(.*)/);
      if(m) process.env[m[1].trim()] = m[2].trim();
    }
  } catch { /* no .env.local — rely on process.env */ }
}
loadEnv();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPABASE_SERVICE_KEY
  || process.env.SUPABASE_ANON_KEY;

if(!SUPABASE_URL || !SUPABASE_KEY){
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchPage(offset, pageSize){
  const { data, error } = await sb
    .from('players')
    .select('id,name,full_name,firstname,lastname,api_player_id')
    .is('full_name', null)
    .range(offset, offset + pageSize - 1)
    .order('id');
  if(error) throw error;
  return data || [];
}

function buildFullName(row){
  const fn = (row.firstname || '').trim();
  const ln = (row.lastname || '').trim();
  if(fn && ln) return `${fn} ${ln}`;
  if(fn) return fn;
  if(ln) return ln;
  return null;
}

async function run(){
  const PAGE = 1000;
  let offset = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;

  console.log('Populating full_name column from existing firstname/lastname data...\n');

  while(true){
    const rows = await fetchPage(offset, PAGE);
    if(!rows.length) break;

    const toUpdate = [];
    for(const row of rows){
      const fullName = buildFullName(row);
      if(fullName){
        toUpdate.push({ id: row.id, full_name: fullName });
      } else {
        totalSkipped++;
      }
    }

    if(toUpdate.length){
      // Upsert in batches of 200
      for(let i = 0; i < toUpdate.length; i += 200){
        const batch = toUpdate.slice(i, i + 200);
        const { error } = await sb
          .from('players')
          .upsert(batch, { onConflict: 'id' });
        if(error){
          console.error('Upsert error:', error.message);
        } else {
          totalUpdated += batch.length;
          process.stdout.write(`\r  Updated: ${totalUpdated} | Skipped (no name data): ${totalSkipped}`);
        }
        await sleep(100);
      }
    }

    if(rows.length < PAGE) break;
    offset += PAGE;
  }

  console.log(`\n\nDone.`);
  console.log(`  Full names populated : ${totalUpdated}`);
  console.log(`  Rows skipped (no firstname/lastname): ${totalSkipped}`);
  console.log(`\nSearch now supports "Lionel Messi", "Kylian Mbappe", "Erling Haaland" etc.`);
  console.log(`Rows with no firstname/lastname need API-Football enrichment to get full names.`);
}

run().catch(err => {
  console.error('\nFatal:', err.message);
  process.exit(1);
});
