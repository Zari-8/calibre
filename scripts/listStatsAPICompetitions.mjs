/**
 * listStatsAPICompetitions.mjs — READ-ONLY probe.
 *
 * Both reconcileNames.mjs and enrichStatsAPI.mjs hardcode an identical
 * 9-competition COMPETITIONS array (all top-flight: Premier League, LaLiga,
 * Bundesliga, Serie A, Ligue 1, Eredivisie, Pro League, Liga Portugal,
 * Brasileirão). No second-tier league (Championship, Segunda División,
 * Serie B, 2. Bundesliga, Ligue 2, etc.) is in either list, so those players
 * get zero statsapi_position coverage no matter how enrichStatsAPI.mjs is
 * run — TARGET_COMP_IDS filters everything outside the 9 out post-fetch.
 *
 * Before hardcoding "the next 10 leagues" we need TheStatsAPI's real
 * comp_XXXX ids for target competitions — guessing them would silently
 * fetch nothing (wrong id = empty result set, not an error). This hits
 * TheStatsAPI's /competitions endpoint (read-only, no Supabase writes) and
 * prints every competition it returns, flagging matches against a
 * candidate name list so we can copy the right ids straight into both
 * COMPETITIONS arrays.
 *
 * Run:
 *   node scripts/listStatsAPICompetitions.mjs
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const f of ['.env', '.env.local']) {
  const p = join(ROOT, f);
  if (!existsSync(p)) continue;
  for (const l of readFileSync(p, 'utf8').split('\n')) {
    const m = l.match(/^([^#=]+)=(.*)/);
    if (m) process.env[m[1].trim()] ??= m[2].trim().replace(/^["']|["']$/g, '');
  }
}

const API_KEY = process.env.STATSAPI_KEY;
if (!API_KEY) { console.error('Missing STATSAPI_KEY'); process.exit(1); }
const BASE = 'https://api.thestatsapi.com/api/football';

// Candidate "next leagues" — mainly UEFA-nation second tiers plus a few
// other strong first divisions not in the current 9. This is a proposal,
// not a commitment — whatever the API actually returns under these names
// (or doesn't) determines the real next-10 list.
const CANDIDATES = [
  'championship', 'segunda', 'serie b', '2. bundesliga', 'bundesliga 2',
  'ligue 2', 'super lig', 'süper lig', 'primeira liga', 'scottish premiership',
  'mls', 'major league soccer', 'liga mx', 'saudi', 'j1 league', 'j-league',
  'austrian bundesliga', 'swiss super league', 'championnat', 'segunda division',
  'liga profesional', 'primera division argentina', 'a-league',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${API_KEY}`, Accept: 'application/json' },
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { rawText: text }; }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${text.slice(0, 300)}`);
  return json;
}

function rows(json) {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.competitions)) return json.competitions;
  if (Array.isArray(json?.results)) return json.results;
  return [];
}

async function main() {
  console.log('Fetching competition list from TheStatsAPI (paginated)...\n');
  const list = [];
  let page = 1;
  let totalPages = 1;
  try {
    do {
      const json = await api(`/competitions?page=${page}`);
      const batch = rows(json);
      list.push(...batch);
      totalPages = json.meta?.total_pages || 1;
      console.log(`  page ${page}/${totalPages} — ${batch.length} rows (${list.length} total so far)`);
      page++;
      if (page <= totalPages) await sleep(250);
    } while (page <= totalPages);
  } catch (e) {
    console.error('Request to /competitions failed:', e.message);
    console.error('\nIf this endpoint path is wrong, check TheStatsAPI docs for the correct');
    console.error('listing route — this script assumes GET /competitions exists analogous to');
    console.error('the /matches endpoint already used in enrichStatsAPI.mjs, including the same');
    console.error('page/meta.total_pages pagination shape.');
    process.exit(1);
  }

  if (!list.length) {
    console.log('No rows returned.');
    return;
  }

  console.log(`\nTotal competitions returned: ${list.length}\n`);

  const CURRENT_9 = new Set([
    'comp_3039', 'comp_8814', 'comp_4643', 'comp_5840', 'comp_0256',
    'comp_3809', 'comp_8531', 'comp_8385', 'comp_4795',
  ]);

  console.log('── Matches against candidate "next leagues" list ──');
  const matched = [];
  for (const c of list) {
    const name = String(c.name || c.competition_name || '').toLowerCase();
    const id = c.id || c.competition_id;
    if (!name || !id) continue;
    if (CURRENT_9.has(id)) continue;
    if (CANDIDATES.some((cand) => name.includes(cand))) {
      matched.push({ id, name: c.name || c.competition_name, country: c.country || c.country_name || '' });
    }
  }
  matched.forEach((m) => console.log(`  ${m.id.padEnd(12)} ${m.name}${m.country ? ` (${m.country})` : ''}`));
  if (!matched.length) console.log('  (no candidate-name matches — see full dump below to find them manually)');

  console.log('\n── Full competition list (id, name, country) ──');
  list.forEach((c) => {
    const id = c.id || c.competition_id || '?';
    const name = c.name || c.competition_name || '?';
    const country = c.country || c.country_name || '';
    const flag = CURRENT_9.has(id) ? '  [already in COMPETITIONS]' : '';
    console.log(`  ${String(id).padEnd(12)} ${String(name).padEnd(30)} ${country}${flag}`);
  });

  console.log('\nDone. Copy the ids you want into the COMPETITIONS array in both');
  console.log('scripts/enrichStatsAPI.mjs and scripts/reconcileNames.mjs.');
}

main().catch((e) => { console.error(e); process.exit(1); });
