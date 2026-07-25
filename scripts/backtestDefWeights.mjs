// ============================================================
// backtestDefWeights.mjs — sanity-check the DEF production weighting
// (defend 0.66 / build 0.21 / prog 0.08 / att 0.05 — see productionComponents()
// in src/services/calibreRating.js) against a real spread of centre-backs:
// elite ball-players, elite physical destroyers, and a couple of "best of
// both worlds" references, so we can see whether that split produces
// sensible relative rankings against real reputation, or whether it
// systematically under-credits ball-playing CBs the way Cubarsí's case
// suggested. Same "verify against real data before touching a calibrated
// formula" approach as every other rating-engine change this session.
//
// For each match this prints the four raw production sub-scores
// (defend/build/prog/att), the blended production, and the final
// calibreRating() output — so we can see WHERE in the pipeline any given
// player's rating is being made or capped, not just the end number.
//
// Run this LOCALLY (sandbox has no live network egress to Supabase).
// USAGE:
//   cd ~/Desktop/calibre-github
//   node scripts/backtestDefWeights.mjs
// Paste the FULL console output back into the chat.
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const f of ['.env', '.env.local']) {
  const p = join(ROOT, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const [k, ...r] = t.split('=');
    process.env[k.trim()] ??= r.join('=').trim().replace(/^["']|["']$/g, '');
  }
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const sb = createClient(url, key, { auth: { persistSession: false } });

const { productionComponents, calibreRating, resolveRating } = await import('../src/services/calibreRating.js');
const { deriveArchetype } = await import('../src/services/playerTraits.js');

const RAW_FIELDS = [
  'id', 'api_player_id', 'name', 'full_name', 'team', 'club', 'league_id', 'season',
  'age', 'pos', 'position', 'raw_position',
  'minutes', 'stats_minutes', 'appearances', 'starts',
  'rating', 'ability_rating', 'availability_score', 'api_average_rating',
  'goals', 'assists', 'passes', 'pass_accuracy', 'key_passes',
  'dribbles_success', 'dribbles_attempts', 'tackles', 'interceptions', 'duels_won',
  'clearances', 'ground_duel_win_pct', 'aerial_duel_win_pct',
  'progressive_carries', 'touches', 'pressures',
];

// A deliberately mixed real spread — not a "prove the point" curated list.
// Reputational labels are what a knowledgeable fan would call these players
// GOING IN, before looking at any Calibre number, so we have something
// independent to sanity-check the output against.
const TARGETS = [
  { search: 'cubars', label: 'Pau Cubarsí — reputation: elite ball-player, still developing physically' },
  { search: 'stones', label: 'John Stones — reputation: elite ball-player/deep-lying, City system-specific' },
  { search: 'gvardiol', label: 'Josko Gvardiol — reputation: modern ball-playing CB, strong recovery pace' },
  { search: 'van dijk', label: 'Virgil van Dijk — reputation: best-of-both, elite passer AND defender' },
  { search: 'saliba', label: 'William Saliba — reputation: elite all-round, strong duels + composed on ball' },
  { search: 'romero', label: 'Cristian Romero — reputation: elite physical/duel-based destroyer' },
  { search: 'marquinhos', label: 'Marquinhos — reputation: elite all-round, PSG system' },
  { search: 'rudiger', label: 'Antonio Rüdiger — reputation: physical destroyer (search may miss diacritic spelling)' },
];

async function main() {
  for (const t of TARGETS) {
    // Deliberately NOT filtering on `rating IS NOT NULL` here — same lesson
    // as the getSupabasePlayersByApiIds fix: ordering by real minutes played
    // picks the season with actual evidence, whether or not that row has
    // been assigned a per-match rating yet.
    const { data, error } = await sb
      .from('players')
      .select(RAW_FIELDS.join(','))
      .or(`name.ilike.%${t.search}%,full_name.ilike.%${t.search}%`)
      .order('minutes', { ascending: false, nullsFirst: false })
      .limit(3);

    console.log('═'.repeat(78));
    console.log(t.label);
    if (error) { console.log('  query error:', error.message); continue; }
    if (!data || !data.length) { console.log(`  NOT FOUND for search "${t.search}" — try a different spelling.`); continue; }

    for (const row of data) {
      const comp = productionComponents(row, 'DEF');
      const [defend, build, prog, att] = comp.vals;
      const [wD, wB, wP, wA] = comp.w;
      const blended = defend * wD + build * wB + prog * wP + att * wA;
      const arch = deriveArchetype(row);
      const scored = resolveRating(row);

      console.log(`\n  ${row.name}  (${row.team || row.club}, league_id ${row.league_id}, ${row.minutes} mins / ${row.appearances} apps)`);
      console.log(`    passes=${row.passes} acc=${row.pass_accuracy}% key_passes=${row.key_passes} tackles=${row.tackles} interceptions=${row.interceptions} duels_won=${row.duels_won}`);
      console.log(`    defend=${defend?.toFixed(1)} (w${wD})  build=${build?.toFixed(1)} (w${wB})  prog=${prog?.toFixed(1)} (w${wP})  att=${att?.toFixed(1)} (w${wA})  -> blended production=${blended.toFixed(1)}`);
      console.log(`    archetype=${arch}`);
      console.log(`    rating: season=${scored?.rating}  ability=${scored?.ability}  availability=${scored?.availability}  confidence=${scored?.confidence}`);
    }
  }
}

main();
