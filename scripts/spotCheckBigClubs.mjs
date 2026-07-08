// scripts/spotCheckBigClubs.mjs — READ-ONLY. Pulls every rated (or ratable)
// player at PSG, Barcelona, Real Madrid, and Bayern Munich and shows their
// CURRENT stored rating next to a freshly recomputed rating using today's
// fully-patched calibreRating() engine (g90/a90 fix, hollow-shell guard,
// nudge widening, ATT duel wiring, qFlat recalibration, GK core fix). This
// is a visual sanity check across marquee squads — no writes anywhere.
//
// Run (one line, no quotes):
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/spotCheckBigClubs.mjs

import { createClient } from '@supabase/supabase-js';
import { calibreRating } from '../src/services/calibreRating.js';

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!URL || !KEY) {
  console.error('Missing credentials. Run it like this (one line, no quotes):');
  console.error('  SUPABASE_URL=your_url SUPABASE_SERVICE_ROLE_KEY=your_service_key node scripts/spotCheckBigClubs.mjs');
  process.exit(1);
}
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TRANSIENT = /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|network|socket|terminated|TypeError/i;
const PAGE = 1000;

// Match on club OR team, tolerant of common naming variants in the data.
const CLUBS = [
  { key: 'PSG', patterns: ['%psg%', '%paris saint%', '%paris sg%'] },
  { key: 'Barcelona', patterns: ['%barcelona%', '%fc barcelona%', '%barça%', '%barca%'] },
  { key: 'Real Madrid', patterns: ['%real madrid%'] },
  { key: 'Bayern Munich', patterns: ['%bayern%'] },
];

function fmt(v, w) { return String(v == null ? '—' : v).padEnd(w); }

async function fetchClub(club) {
  const orParts = [];
  for (const p of club.patterns) {
    orParts.push(`club.ilike.${p}`);
    orParts.push(`team.ilike.${p}`);
  }
  const all = [];
  let offset = 0;
  while (true) {
    const MAX = 5;
    let data;
    for (let attempt = 1; attempt <= MAX; attempt++) {
      const { data: d, error } = await sb
        .from('players')
        .select('*')
        .or('hidden.is.null,hidden.eq.false')
        .or(orParts.join(','))
        .order('id', { ascending: true })
        .range(offset, offset + PAGE - 1);
      if (!error) { data = d; break; }
      const transient = TRANSIENT.test(String(error.message || error));
      if (!transient || attempt === MAX) { console.error(`Fetch failed (${club.key}):`, error.message || error); process.exit(1); }
      const wait = 1000 * attempt;
      console.warn(`  ↻ ${club.key} @${offset}: ${error.message || error} — retry ${attempt}/${MAX - 1} in ${wait}ms`);
      await sleep(wait);
    }
    if (!data || data.length === 0) break;
    all.push(...data);
    offset += data.length;
    if (data.length < PAGE) break;
  }
  return all;
}

function positionBucket(p) {
  const text = `${p.position||''} ${p.archetype||''} ${p.pos||''} ${p.primary_role||''} ${p.raw_position||''}`.toLowerCase();
  if (/(goalkeeper|keeper|\bgk\b)/.test(text)) return 'GK';
  if (/(defender|centre.?back|center.?back|full.?back|wing.?back|\bcb\b|\brb\b|\blb\b|\bdef\b)/.test(text)) return 'DEF';
  if (/(striker|forward|winger|wide creator|wide forward|attack|poacher|fox|\bst\b|\brw\b|\blw\b|\bcf\b|\bfwd\b|\batt\b)/.test(text)) return 'MID';
  return 'MID';
}

async function main() {
  console.log('SPOT CHECK: PSG / Barcelona / Real Madrid / Bayern Munich — read-only.\n');

  for (const club of CLUBS) {
    const rows = await fetchClub(club);
    // De-dupe by id just in case a row matches both club and team patterns.
    const seen = new Set();
    const uniq = rows.filter(r => (seen.has(r.id) ? false : (seen.add(r.id), true)));

    const results = uniq.map(row => {
      const res = calibreRating(row);
      const next = res && res.rating != null ? Math.round(res.rating) : null;
      const cur = row.rating == null ? null : Number(row.rating);
      return {
        name: row.name,
        pos: positionBucket(row),
        minutes: row.minutes,
        apiR: row.api_average_rating,
        cur,
        next,
        delta: (cur != null && next != null) ? next - cur : null,
      };
    });

    // Only show players with real minutes (skip empty shells / benchwarmers with 0 evidence)
    const withEvidence = results.filter(r => Number(r.minutes) > 0 || Number(r.apiR) > 0);
    withEvidence.sort((a, b) => (b.next ?? -1) - (a.next ?? -1));

    console.log(`\n══════════ ${club.key} — ${withEvidence.length} players (of ${uniq.length} matched rows) ══════════`);
    console.log(['name', 'pos', 'min', 'apiR', 'stored', 'recomputed', 'Δ'].map(h => fmt(h, 22)).join(''));
    for (const r of withEvidence) {
      const d = r.delta == null ? '' : (r.delta > 0 ? `+${r.delta}` : `${r.delta}`);
      console.log([r.name, r.pos, r.minutes, r.apiR, r.cur, r.next, d].map(v => fmt(v, 22)).join(''));
    }
  }

  console.log('\nDone. No rows were written.');
}

main().catch((e) => { console.error(e); process.exit(1); });
