// ============================================================
// importYouthProspects.mjs  —  Calibre Youth Radar importer
// ------------------------------------------------------------
// Builds a DIRECTORY of elite-pathway youth players: identity + age
// only. API-Football provides no youth performance stats (confirmed
// via probe — the entire statistics block is null at youth level),
// so this is explicitly a discovery surface, NOT a rating engine.
//
// What it stores per prospect: name, exact age + birthdate, position,
// nationality, height, club, youth league. Plus the one honest signal
// a stats-less directory can compute: "plays_up_years" — how young the
// player is versus the league's age ceiling (a 16yo in a U20 league is
// playing up ~3 years, which is genuinely interesting on its own).
//
// Auto-discovers youth team IDs per league (calls /teams?league=X),
// so no manual team-id entry — same pattern as deriveTeamProfiles.mjs.
//
// USAGE (one line, no quotes, real values):
//   API_FOOTBALL_KEY=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/importYouthProspects.mjs
//
// Flags:
//   LEAGUES=705,702,488   override the default youth-league set
//   SEASON=2024           default 2024 (last completed; 2025 may be empty)
//   DRY=1                 compute + print, write nothing
// ============================================================

import { createClient } from '@supabase/supabase-js';

const API_KEY = process.env.API_FOOTBALL_KEY;
const SB_URL  = process.env.SUPABASE_URL;
const SB_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY     = process.env.DRY === '1';
const SEASON  = Number(process.env.SEASON || 2024);

// Tight set: top youth tiers that actually feed elite football.
// Verify each id on your plan before a wide run (a wrong id returns nothing).
const DEFAULT_LEAGUES = '705,702,488';
const LEAGUE_IDS = (process.env.LEAGUES || DEFAULT_LEAGUES)
  .split(',').map(s => Number(s.trim())).filter(Boolean);

// Label + the league's nominal age ceiling, for the "plays_up" signal.
// ceiling = the oldest age the competition is built around (U20 -> 20, etc.).
const LEAGUE_META = {
  705: { label: 'Primavera 1 (ITA)',     ceiling: 20 },
  706: { label: 'Primavera 2 (ITA)',     ceiling: 20 },
  702: { label: 'Premier League 2 (ENG)', ceiling: 21 },
  488: { label: 'U19 Bundesliga (GER)',  ceiling: 19 },
  695: { label: 'U18 Premier League N',  ceiling: 18 },
  696: { label: 'U18 Premier League S',  ceiling: 18 },
};

const API_BASE = 'https://v3.football.api-sports.io';

if (!API_KEY || !SB_URL || !SB_KEY) {
  console.error('Missing env. Need API_FOOTBALL_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

const num = v => (v == null || Number.isNaN(Number(v))) ? null : Number(v);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function apiGet(path, params, wantPaging = false) {
  const url = new URL(API_BASE + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'x-apisports-key': API_KEY } });
      if (res.status === 429) { await sleep(2000 * attempt); continue; }
      const json = await res.json();
      return wantPaging ? json : (json.response ?? null);
    } catch (e) {
      if (attempt === 4) throw e;
      await sleep(1200 * attempt);
    }
  }
  return wantPaging ? null : null;
}

// height "184 cm" -> 184
function parseHeight(h) {
  if (!h) return null;
  const m = String(h).match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

// exact age from birthdate at the season's reference point (Jan 1 of end year)
function ageFromBirth(birthDate, season) {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return null;
  const ref = new Date(`${season + 1}-01-01`);  // mid-season reference
  let age = ref.getFullYear() - b.getFullYear();
  const m = ref.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < b.getDate())) age--;
  return age;
}

async function main() {
  console.log(`Youth Radar import · season ${SEASON} · leagues ${LEAGUE_IDS.join(', ')}${DRY ? ' · DRY RUN' : ''}`);

  const out = [];
  for (const leagueId of LEAGUE_IDS) {
    const meta = LEAGUE_META[leagueId] || { label: `League ${leagueId}`, ceiling: 20 };

    // discover teams in this youth league
    const teams = await apiGet('/teams', { league: leagueId, season: SEASON });
    if (!teams || teams.length === 0) { console.warn(`  ${meta.label}: no teams (check id/season)`); continue; }
    console.log(`\n${meta.label} — ${teams.length} clubs`);

    for (const t of teams) {
      const team = t.team;
      // players endpoint is paginated; walk all pages
      let page = 1, totalPages = 1;
      do {
        const json = await apiGet('/players', { team: team.id, season: SEASON, league: leagueId, page }, true);
        const resp = json?.response ?? [];
        totalPages = json?.paging?.total ?? 1;

        for (const entry of resp) {
          const p = entry.player || {};
          const stat = (entry.statistics && entry.statistics[0]) || {};
          const birthDate = p.birth?.date || null;
          const age = p.age ?? ageFromBirth(birthDate, SEASON);
          const playsUp = (age != null && meta.ceiling) ? Math.max(0, meta.ceiling - age) : null;

          out.push({
            api_player_id: p.id,
            name: p.name || `${p.firstname || ''} ${p.lastname || ''}`.trim(),
            firstname: p.firstname || null,
            lastname: p.lastname || null,
            age: age,
            birth_date: birthDate,
            birth_place: p.birth?.place || null,
            birth_country: p.birth?.country || null,
            nationality: p.nationality || null,
            height_cm: parseHeight(p.height),
            position: stat.games?.position || null,
            photo: p.photo || null,
            club: team.name,
            club_id: team.id,
            youth_league: meta.label,
            league_id: leagueId,
            season: SEASON,
            plays_up_years: playsUp,
            logo: team.logo || null,
            source: 'api-football-youth',
            updated_at: new Date().toISOString(),
          });
        }
        page += 1;
        await sleep(160);
      } while (page <= totalPages);
    }
  }

  // dedupe by (api_player_id, season) — a player can list under one youth team
  const seen = new Map();
  for (const row of out) seen.set(`${row.api_player_id}::${row.season}`, row);
  const deduped = [...seen.values()];
  const dropped = out.length - deduped.length;

  console.log(`\nCollected ${out.length} prospect rows${dropped ? ` (${dropped} duplicates collapsed)` : ''}.`);

  // sample: the youngest "playing up" prospects — the one honest highlight
  const highlights = [...deduped]
    .filter(r => r.age != null && r.plays_up_years != null)
    .sort((a, b) => b.plays_up_years - a.plays_up_years)
    .slice(0, 12);
  console.log('\nYoungest playing up (age vs league ceiling):');
  for (const r of highlights) {
    console.log(`  ${(r.name || '').padEnd(22)} age ${String(r.age).padStart(2)}  +${r.plays_up_years}y up  ${(r.position || '—').padEnd(11)} ${r.nationality || ''} · ${r.club}`);
  }

  if (DRY) { console.log('\nDRY RUN — nothing written.'); return; }
  if (!deduped.length) { console.log('Nothing to write.'); return; }

  let written = 0;
  for (let i = 0; i < deduped.length; i += 200) {
    const chunk = deduped.slice(i, i + 200);
    const { error } = await sb
      .from('youth_prospects')
      .upsert(chunk, { onConflict: 'api_player_id,season' });
    if (error) { console.error(`Upsert error chunk ${i}:`, error.message); continue; }
    written += chunk.length;
  }
  console.log(`\nWrote ${written} prospects to youth_prospects.`);
}

main().catch(e => { console.error(e); process.exit(1); });
