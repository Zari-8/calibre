// scripts/syncTransfersFromApiFootball.mjs
//
// Populates public.transfers from API-Football's real /transfers endpoint —
// the automated replacement for hand-typing rows into the SQL Editor/dashboard
// (see supabase/migrations/20260802_transfers_table.sql for why that was a
// real gap: no schema, no write path, no audit trail for any row that ever
// went in). Chosen over TheStatsAPI (confirmed via its own published
// endpoint list: no transfers/transfer-market data at all) and over
// Twitter/X (no structured data, real ongoing API cost, and auto-publishing
// unverified rumours would contradict this whole codebase's "never
// fabricate, be honest about confidence" pattern — see calibreValue.js).
//
// WHAT THIS DOES NOT COVER: API-Football's /transfers only ever returns
// COMPLETED moves — there is no rumour/speculation data on this endpoint.
// Every row this script writes gets status='done'. 'rumour'/'watch'/
// 'premium' rows stay exactly as manual as they are today; this only
// automates the 'done' side.
//
// FEE DATA IS UNRELIABLE ON THIS ENDPOINT — confirmed against a live 300-
// player pull (2026-08-02): 193/194 transfers came back with NO usable fee.
// API-Football's `type` field is either a real money string ("€45M") or one
// of a handful of category placeholders that carry no amount at all:
// "Transfer" (fee undisclosed — the single largest bucket by far), "Free
// agent", "Free Transfer", "Loan", "Back from Loan", "Return from loan",
// "End of career", "N/A", "-". Only the money-string case parses to a real
// number; every category placeholder — including the bare word "Transfer",
// which reads like it should mean something and doesn't — is left NULL, not
// zero, not guessed. Same "don't invent a number" rule the valuation engine
// follows everywhere else in this codebase. Practical upshot: expect this
// pipeline to reliably populate WHO moved WHERE, but rarely the fee — plan
// any feature built on top of it (Market Pulse, Comparable Deals) around
// that gap rather than assuming fee coverage will improve on its own.
//
// NO MARKET VALUE. API-Football has no Transfermarkt-style valuation concept
// at all — market_value is left NULL here, on purpose. Transfers.jsx already
// has a fallback for this (loadPlayerIntoEngine: estimates from live rating
// when a transfer row has no market_value), so the page handles a null
// gracefully; this script isn't going to fabricate a number to fill the
// column.
//
// SAFETY GATE: every row this script writes lands with published=false by
// default — a human reviews and flips it to true before it's visible on the
// live page. Pass AUTO_PUBLISH=1 once you trust the pipeline enough to skip
// that review step.
//
// PREREQ: run supabase/migrations/20260802_transfers_table.sql first (adds
// the transfer_date column and the dedupe unique index this script upserts
// against). Running this before that migration will fail on the missing
// column / conflict target.
//
// Run:
//   node scripts/syncTransfersFromApiFootball.mjs
// Useful overrides:
//   PLAYER_LIMIT=300 DATE_FROM=2025-06-01 DELAY_MS=300 AUTO_PUBLISH=0 \
//     node scripts/syncTransfersFromApiFootball.mjs
//   DRY_RUN=1 node scripts/syncTransfersFromApiFootball.mjs   # print, don't write

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

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

const API_KEY = process.env.API_FOOTBALL_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY;

if (!API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing env vars. Need API_FOOTBALL_KEY, SUPABASE_URL/VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const API_HOST = 'https://v3.football.api-sports.io';
const PLAYER_LIMIT = Number(process.env.PLAYER_LIMIT || 300);
const DATE_FROM = process.env.DATE_FROM || '2025-06-01'; // ignore anything older in a player's career history
const DELAY_MS = Number(process.env.DELAY_MS || 300);
const AUTO_PUBLISH = process.env.AUTO_PUBLISH === '1';
const DRY_RUN = process.env.DRY_RUN === '1';
const DEBUG = process.env.DEBUG === '1'; // print the raw API-Football `type` string next to what we parsed from it

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Same July-cutoff convention the rest of the codebase uses for season
// strings (e.g. FALLBACK_TRANSFERS' '2026-27' in Transfers.jsx).
function seasonFor(dateStr) {
  const d = new Date(dateStr);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1; // 1-12
  return m >= 7 ? `${y}-${String((y + 1) % 100).padStart(2, '0')}` : `${y - 1}-${String(y % 100).padStart(2, '0')}`;
}

// "€45M" / "£12.5m" / "$5M" -> 45 / 12.5 / 5. "Free" -> 0. "Loan"/"N/A"/
// anything unparseable -> null (unknown, not zero — the valuation math
// downstream treats "no fee reported" very differently from "free transfer").
function parseFeeMillions(type) {
  const t = String(type || '').trim();
  if (!t) return null;
  if (/^free$/i.test(t)) return 0;
  const m = t.match(/([\d.,]+)\s*([mk])?/i);
  if (!m) return null;
  let n = Number(m[1].replace(/,/g, ''));
  if (!Number.isFinite(n)) return null;
  if (/^k$/i.test(m[2] || '')) n = n / 1000; // thousands -> millions
  return Math.round(n * 100) / 100;
}

async function apiFootballGet(path) {
  const res = await fetch(`${API_HOST}${path}`, { headers: { 'x-apisports-key': API_KEY } });
  if (!res.ok) throw new Error(`API-Football ${path} -> ${res.status} ${res.statusText}`);
  const json = await res.json();
  if (json.errors && Object.keys(json.errors).length) throw new Error(`API-Football error: ${JSON.stringify(json.errors)}`);
  return json;
}

// Top-rated players by design, not a random/full-table sweep: these are the
// players Comparable Deals, Spotlight and Market Pulse actually surface, and
// keeping the scan to a few hundred players (not 400k+ rows) keeps this
// quick and quota-friendly. Bump PLAYER_LIMIT if you want deeper coverage.
async function getTargetPlayers() {
  const { data, error } = await sb
    .from('players')
    .select('api_player_id, name, full_name, pos, position, ability_rating, rating')
    .not('api_player_id', 'is', null)
    .or('hidden.is.null,hidden.eq.false')
    .not('ability_rating', 'is', null)
    .order('ability_rating', { ascending: false, nullsFirst: false })
    .limit(PLAYER_LIMIT);
  if (error) throw error;
  // De-dup by api_player_id — players can carry more than one row per id
  // (see getSupabasePlayersByApiIds' comment on league-scoped enrichment rows).
  const seen = new Map();
  for (const row of data || []) {
    if (!seen.has(row.api_player_id)) seen.set(row.api_player_id, row);
  }
  return Array.from(seen.values());
}

async function main() {
  console.log(`Syncing transfers from API-Football for the top ${PLAYER_LIMIT} rated players, from ${DATE_FROM}...`);
  if (DRY_RUN) console.log('DRY RUN — nothing will be written to Supabase.');
  console.log(`New rows publish=${AUTO_PUBLISH} (${AUTO_PUBLISH ? 'live immediately' : 'pending review — flip published=true by hand once checked'}).\n`);

  const players = await getTargetPlayers();
  console.log(`${players.length} target players.\n`);

  const rowsToUpsert = [];
  let checked = 0, found = 0, noFeeParsed = 0;

  for (const p of players) {
    checked++;
    try {
      const json = await apiFootballGet(`/transfers?player=${p.api_player_id}`);
      const entries = json?.response?.[0]?.transfers || [];
      // Track what's already been queued for THIS player so a near-duplicate
      // (same clubs, a day or two apart — API-Football sometimes logs what's
      // really one real-world move as two entries, e.g. announcement vs
      // registration date) doesn't get written twice. The dedupe unique
      // index in the migration only catches EXACT transfer_date matches, so
      // this catches the near-miss case the DB constraint can't.
      const seenForPlayer = [];
      for (const t of entries) {
        if (!t.date || t.date < DATE_FROM) continue;
        const fromClub = t.teams?.out?.name || null;
        const toClub = t.teams?.in?.name || null;
        // Not a real move — API-Football occasionally logs a same-club event
        // (contract renewal, loan-return bookkeeping) as a "transfer."
        if (fromClub && toClub && fromClub.trim().toLowerCase() === toClub.trim().toLowerCase()) {
          if (DEBUG) console.log(`  [debug] ${p.full_name || p.name} ${t.date} skipped — from/to club identical (${fromClub})`);
          continue;
        }
        const thisDate = new Date(t.date).getTime();
        const isNearDuplicate = seenForPlayer.some(s =>
          s.toClub === toClub && s.fromClub === fromClub && Math.abs(thisDate - s.date) <= 3 * 86400000
        );
        if (isNearDuplicate) {
          if (DEBUG) console.log(`  [debug] ${p.full_name || p.name} ${t.date} skipped — near-duplicate of an already-queued ${fromClub} -> ${toClub} move`);
          continue;
        }
        seenForPlayer.push({ fromClub, toClub, date: thisDate });
        const feeMillions = parseFeeMillions(t.type);
        if (feeMillions == null) noFeeParsed++;
        if (DEBUG) console.log(`  [debug] ${p.full_name || p.name} ${t.date} ${fromClub} -> ${toClub}  raw type=${JSON.stringify(t.type)}  parsed fee=${feeMillions}`);
        rowsToUpsert.push({
          player_name: p.full_name || p.name,
          api_player_id: p.api_player_id,
          position: p.pos || p.position || null,
          position_label: null,
          from_club: fromClub,
          to_club: toClub,
          fee_millions: feeMillions,
          market_value: null, // honest gap — see file header
          status: 'done',
          season: seasonFor(t.date),
          transfer_date: t.date,
          published: AUTO_PUBLISH,
        });
        found++;
      }
    } catch (e) {
      console.warn(`  [skip] ${p.full_name || p.name} (${p.api_player_id}): ${e.message}`);
    }
    if (checked % 25 === 0) console.log(`  ...${checked}/${players.length} players checked, ${found} transfers found so far`);
    await sleep(DELAY_MS);
  }

  console.log(`\nDone scanning. ${found} transfer rows found (${noFeeParsed} with no parseable fee) across ${checked} players.`);

  if (!rowsToUpsert.length) { console.log('Nothing to write.'); return; }
  if (DRY_RUN) {
    console.log('\nSample rows (first 5):');
    console.log(JSON.stringify(rowsToUpsert.slice(0, 5), null, 2));
    return;
  }

  // Batch upsert, deduped on the (api_player_id, transfer_date, to_club)
  // unique index from the migration — re-running this script (overlapping
  // lookback windows, a cron re-run) updates the same rows instead of
  // duplicating them.
  const BATCH = 200;
  let written = 0;
  for (let i = 0; i < rowsToUpsert.length; i += BATCH) {
    const batch = rowsToUpsert.slice(i, i + BATCH);
    const { error } = await sb.from('transfers').upsert(batch, { onConflict: 'api_player_id,transfer_date,to_club' });
    if (error) { console.error(`  batch ${i / BATCH + 1} failed:`, error.message); continue; }
    written += batch.length;
  }
  console.log(`Wrote/updated ${written} rows into public.transfers.`);
  if (!AUTO_PUBLISH) {
    console.log(`\nAll new rows landed with published=false. Review them, then in the SQL Editor:`);
    console.log(`  update public.transfers set published = true where published = false and status = 'done';`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
