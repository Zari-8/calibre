// scripts/fixLewandowskiXg.mjs — targeted single-player correction.
//
// Confirmed via checkLewandowskiDuplicate.mjs: the visible row (R.
// Lewandowski, id bc833b7d-38f3-4d11-a4fb-bee21fb3f7c3, api_player_id 521)
// and a hidden decoy row (Robert Lewandowski, id
// cde18d56-8542-4145-bac2-143687fe50a6, api_player_id 147229) share the same
// statsapi_player_id (pl_703474) — the same real player split across two
// rows, a bug traced in an earlier session to reconcileNames.mjs's old
// matching logic. A prior merge (fixDuplicateIdentities.mjs) copied most
// fields over but its list never included xg/xa/npxg, so the visible row is
// stuck on a July 6 enrichment (xg 3.5) while the hidden row got correctly
// re-enriched July 18 (xg 13.97 — matches an independent shotmap probe from
// the earlier session almost exactly).
//
// This script ONLY touches xg/xa/npxg — the specific fields diagnosed as
// broken. It deliberately does NOT touch goals/assists/shots: the hidden
// row's goals (22) disagree with the visible row's (19, which matches its
// own competition_splits base+overlay sum) and that discrepancy hasn't been
// explained, so those fields are left alone rather than guessed at.
//
// It also nulls the HIDDEN row's statsapi_player_id, so future
// enrichStatsAPI.mjs runs can only ever address the visible row going
// forward — otherwise this exact bug recurs on the next scheduled run.
//
// DRY_RUN=1 by default-safe. Run:
//   node scripts/fixLewandowskiXg.mjs
//   DRY_RUN=0 node scripts/fixLewandowskiXg.mjs

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

const DRY_RUN = process.env.DRY_RUN !== '0';

const VISIBLE_ID = 'bc833b7d-38f3-4d11-a4fb-bee21fb3f7c3'; // R. Lewandowski
const HIDDEN_ID = 'cde18d56-8542-4145-bac2-143687fe50a6';  // Robert Lewandowski (decoy)

async function main() {
  const { data: rows, error } = await sb
    .from('players')
    .select('id, name, team, xg, xa, npxg, goals, statsapi_player_id, statsapi_enriched_at')
    .in('id', [VISIBLE_ID, HIDDEN_ID]);
  if (error) { console.error('Fetch failed:', error.message); process.exit(1); }

  const visible = rows.find(r => r.id === VISIBLE_ID);
  const hidden = rows.find(r => r.id === HIDDEN_ID);
  if (!visible || !hidden) { console.error('Could not find both rows — aborting (nothing written).'); process.exit(1); }

  console.log('VISIBLE before:', { xg: visible.xg, xa: visible.xa, npxg: visible.npxg, statsapi_player_id: visible.statsapi_player_id, enriched: visible.statsapi_enriched_at });
  console.log('HIDDEN  source:', { xg: hidden.xg, xa: hidden.xa, npxg: hidden.npxg, statsapi_player_id: hidden.statsapi_player_id, enriched: hidden.statsapi_enriched_at });

  if (hidden.xg == null) {
    console.log('\nHidden row has no xg to pull — nothing to do. Aborting (nothing written).');
    return;
  }

  const xgPatch = { xg: hidden.xg, xa: hidden.xa, npxg: hidden.npxg };
  console.log('\nWould apply to VISIBLE row:', xgPatch);
  console.log('Would null HIDDEN row\'s statsapi_player_id (currently', hidden.statsapi_player_id + ') so future enrichment can\'t land there again.');

  if (DRY_RUN) {
    console.log('\nDRY RUN — nothing written. Re-run with DRY_RUN=0 to apply.');
    return;
  }

  const { error: e1 } = await sb.from('players').update(xgPatch).eq('id', VISIBLE_ID);
  if (e1) { console.error('Update failed (visible row):', e1.message); process.exit(1); }

  const { error: e2 } = await sb.from('players').update({ statsapi_player_id: null }).eq('id', HIDDEN_ID);
  if (e2) { console.error('Update failed (hidden row):', e2.message); process.exit(1); }

  console.log('\n✓ Updated. Visible row now has the correct xg/xa/npxg; hidden row can no longer be');
  console.log('  targeted by future enrichStatsAPI.mjs runs. players.rating is untouched by this script —');
  console.log('  re-run computeRatings.mjs (or check ID=' + VISIBLE_ID + ' node scripts/inspectPlayerBreakdown.mjs)');
  console.log('  to see the corrected number.');
}

main().catch(e => { console.error(e); process.exit(1); });
