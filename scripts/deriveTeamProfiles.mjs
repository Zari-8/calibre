// ============================================================
// deriveTeamProfiles.mjs  —  System Fit "derived first pass"
// ------------------------------------------------------------
// Generates a baseline tactical profile for EVERY club in the
// chosen leagues, from each club's real API-Football team
// statistics, mapped onto the exact six trait axes the System
// Fit engine scores against:
//     control, transition, pressing, width, tempo, defensiveLoad
// plus categorical formation / philosophy / intensity / lineHeight.
//
// Output: writes a `derived_team_profiles` table in Supabase,
// one row per club, each tagged derived:true so you can tell
// auto-generated from hand-authored, and overwrite league by
// league during the enrichment pass.
//
// This does NOT touch SYSTEM_TEAMS (the curated 54). It builds
// the breadth layer alongside it. The app reads curated first,
// then falls back to derived, then to generic — so a hand-authored
// profile always wins over its derived counterpart.
//
// USAGE (one line, no quotes, real values in place of the dots):
//   API_FOOTBALL_KEY=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/deriveTeamProfiles.mjs
//
// Optional:
//   LEAGUES=39,140,78,135,61   (default = top 5)
//   SEASON=2025                 (default = current season below)
//   DRY=1                       (compute + print, write nothing)
// ============================================================

import { createClient } from '@supabase/supabase-js';

const API_KEY  = process.env.API_FOOTBALL_KEY;
const SB_URL   = process.env.SUPABASE_URL;
const SB_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY      = process.env.DRY === '1';
const SEASON   = Number(process.env.SEASON || 2025);

// API-Football league ids. Top 5 by default; cascade by appending more.
const LEAGUE_IDS = (process.env.LEAGUES || '39,140,78,135,61')
  .split(',').map(s => Number(s.trim())).filter(Boolean);

// Map league id -> the league label used in SYSTEM_TEAMS, so derived
// rows read consistently with curated ones.
const LEAGUE_LABEL = {
  39:  'Premier League',
  140: 'La Liga',
  78:  'Bundesliga',
  135: 'Serie A',
  61:  'Ligue 1',
  88:  'Eredivisie',
  144: 'Belgian Pro League',
  94:  'Primeira Liga',
  71:  'Brasileirão',
  399: 'NPFL',
  // D1s
  253: 'MLS',
  307: 'Saudi Pro League',
  128: 'Liga Profesional Argentina',
  // D2 / lower tiers of the majors
  40:  'Championship',
  141: 'Segunda División',
  79:  '2. Bundesliga',
  136: 'Serie B',
  62:  'Ligue 2',
  80:  '3. Liga',
  41:  'League One',
  129: 'Primera Nacional',
  // Women's
  44:  'FA WSL',
  142: 'Liga F (W)',
  82:  'Frauen-Bundesliga',
  139: 'Serie A Women',
  254: 'NWSL',
  64:  "D1 Arkema (W)",
};

const API_BASE = 'https://v3.football.api-sports.io';

if (!API_KEY || !SB_URL || !SB_KEY) {
  console.error('Missing env. Need API_FOOTBALL_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

// ── small helpers ──────────────────────────────────────────
const clamp = (n, lo = 40, hi = 99) => Math.max(lo, Math.min(hi, Math.round(n)));
const num   = v => (v == null || Number.isNaN(Number(v))) ? null : Number(v);
const pct   = s => num(String(s ?? '').replace('%', ''));   // "53%" -> 53
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function apiGet(path, params) {
  const url = new URL(API_BASE + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'x-apisports-key': API_KEY } });
      if (res.status === 429) { await sleep(2000 * attempt); continue; }
      const json = await res.json();
      return json.response ?? null;
    } catch (e) {
      if (attempt === 4) throw e;
      await sleep(1200 * attempt);
    }
  }
  return null;
}

// ── trait derivation ───────────────────────────────────────
// Turn one club's API-Football team statistics into the six axes.
//
// NOTE: /teams/statistics does NOT return possession on this plan.
// So control & tempo are derived from what IS present:
//   - win rate + goal difference per game  -> control (game dominance)
//   - goals-per-game + minute spread        -> tempo (sustained threat)
// transition / width / defensiveLoad / pressing use goals, clean
// sheets, failed-to-score and cards. Where a signal is absent we
// fall to neutral rather than invent.
function deriveTraits(stats) {
  const played = num(stats?.fixtures?.played?.total) || 1;

  // record
  const wins   = num(stats?.fixtures?.wins?.total) ?? 0;
  const draws  = num(stats?.fixtures?.draws?.total) ?? 0;
  const winRate  = wins / played;                 // 0..1
  const pointsPer = (wins * 3 + draws) / played;   // 0..3

  // goals
  const gf    = num(stats?.goals?.for?.total?.total) ?? 0;
  const ga    = num(stats?.goals?.against?.total?.total) ?? 0;
  const gfPer = gf / played;
  const gaPer = ga / played;
  const gdPer = gfPer - gaPer;                      // goal diff per game

  // clean sheets & failed-to-score (objects keyed home/away/total)
  const cleanSheet  = num(stats?.clean_sheet?.total) ?? 0;
  const failedScore = num(stats?.failed_to_score?.total) ?? 0;
  const csRate  = cleanSheet  / played;
  const ftsRate = failedScore / played;

  // cards (aggression proxy) — sum across minute buckets if needed
  let yellows = num(stats?.cards?.yellow?.total);
  if (yellows == null && stats?.cards?.yellow) {
    yellows = Object.values(stats.cards.yellow)
      .reduce((a, c) => a + (num(c?.total) || 0), 0);
  }
  const yellowPer = (yellows || 0) / played;

  // minute distribution of goals -> tempo signature.
  // Sides that score evenly across the match (esp. late, 76-90) sustain
  // tempo; sides bunched in one window do not. Measure spread + late share.
  const mins = stats?.goals?.for?.minute || {};
  const buckets = ['0-15','16-30','31-45','46-60','61-75','76-90'];
  const counts = buckets.map(b => num(mins?.[b]?.total) || 0);
  const totalMin = counts.reduce((a, b) => a + b, 0) || 1;
  const lateShare = (counts[5]) / totalMin;        // 76-90 share
  // evenness: 1 - normalized variance across buckets (1 = perfectly even)
  const mean = totalMin / buckets.length;
  const variance = counts.reduce((a, c) => a + (c - mean) ** 2, 0) / buckets.length;
  const evenness = 1 - Math.min(1, variance / (mean * mean + 1));

  // ── map to axes ──

  // control: game dominance — win rate + goal difference. A side that
  // wins and outscores controls matches even without a possession number.
  const control = clamp(
    52 + (winRate * 34) + (gdPer * 7)
  );

  // tempo: scoring rate + how evenly/late goals come (sustained pressure).
  const tempo = clamp(
    56 + (gfPer * 9) + (evenness * 14) + (lateShare * 12)
  );

  // transition: attacking output, leaning vertical. High GF with a strong
  // late-goal share reads as a side that hurts you in transition.
  const transition = clamp(
    60 + (gfPer * 11) + (lateShare * 10)
  );

  // pressing: aggression (cards) + attacking intent + winning sides press
  // higher up. Dampened for low-scoring, low-card sides.
  const pressing = clamp(
    58 + (yellowPer * 4) + (gfPer * 5) + (winRate * 10)
  );

  // width: attacking output proxy (no shot-location data on this endpoint).
  const width = clamp(64 + (gfPer * 9));

  // defensiveLoad: solidity — clean sheets up, goals-against down.
  const defensiveLoad = clamp(
    68 + (csRate * 24) - (gaPer * 9)
  );

  return { control, transition, pressing, width, tempo, defensiveLoad };
}

// Categorical descriptors derived from the same signals + most-used formation.
function deriveCategoricals(stats, traits, formation) {
  const intensity =
    traits.pressing >= 86 ? 'Very high' :
    traits.pressing >= 78 ? 'High' :
    traits.pressing >= 70 ? 'Medium' : 'Low';

  const lineHeight =
    traits.defensiveLoad >= 86 ? 'Low' :          // sits deep, defends a lot
    (traits.control >= 82 || traits.pressing >= 84) ? 'High' :
    traits.transition >= 86 ? 'High' :
    traits.control >= 72 ? 'Medium' : 'Low';

  // philosophy: a short label from the dominant trait
  const ranked = Object.entries(traits).sort((a, b) => b[1] - a[1]);
  const top = ranked[0][0];
  const PHIL = {
    control:        'Possession control',
    transition:     'Vertical transitions',
    pressing:       'High-press intensity',
    width:          'Wide attacking play',
    tempo:          'Up-tempo circulation',
    defensiveLoad:  'Compact defensive block',
  };
  const philosophy = PHIL[top] || 'Balanced structure';

  return { intensity, lineHeight, philosophy, formation: formation || '4-3-3' };
}

// Most-used formation comes from stats.lineups (handled inline in main).

// ── main ───────────────────────────────────────────────────
async function main() {
  console.log(`Derived team-profile pass · season ${SEASON} · leagues ${LEAGUE_IDS.join(', ')}${DRY ? ' · DRY RUN' : ''}`);

  const out = [];
  for (const leagueId of LEAGUE_IDS) {
    const label = LEAGUE_LABEL[leagueId] || `League ${leagueId}`;
    const teams = await apiGet('/teams', { league: leagueId, season: SEASON });
    if (!teams) { console.warn(`  ${label}: no teams returned`); continue; }
    console.log(`\n${label} — ${teams.length} clubs`);

    for (const t of teams) {
      const team = t.team;
      const stats = await apiGet('/teams/statistics', { league: leagueId, season: SEASON, team: team.id });
      if (!stats) { console.warn(`  · ${team.name}: no stats`); continue; }

      // most-used formation from stats.lineups (array of {formation, played})
      const lineups = Array.isArray(stats.lineups) ? [...stats.lineups] : [];
      lineups.sort((a, b) => (b.played || 0) - (a.played || 0));
      const formation = lineups[0]?.formation || null;

      const traits = deriveTraits(stats);
      const cat = deriveCategoricals(stats, traits, formation);

      const row = {
        team_id: team.id,
        name: team.name,
        short: team.name.length > 14 ? team.name.slice(0, 14) : team.name,
        country: team.country || null,
        league: label,
        league_id: leagueId,
        season: SEASON,
        formation: cat.formation,
        philosophy: cat.philosophy,
        intensity: cat.intensity,
        line_height: cat.lineHeight,
        crest: (team.name.match(/\b\w/g) || []).join('').slice(0, 3).toUpperCase(),
        logo: team.logo || null,
        traits,                 // jsonb { control, transition, ... }
        derived: true,
        source: 'api-football-derived',
        updated_at: new Date().toISOString(),
      };
      out.push(row);
      console.log(`  · ${team.name.padEnd(24)} ${cat.formation || '—'}  ` +
        `ctl ${traits.control} tr ${traits.transition} pr ${traits.pressing} ` +
        `wd ${traits.width} tp ${traits.tempo} def ${traits.defensiveLoad}  [${cat.intensity}]`);

      await sleep(180); // gentle on the rate limit
    }
  }

  console.log(`\nComputed ${out.length} derived profiles.`);

  if (DRY) { console.log('DRY RUN — nothing written.'); return; }
  if (!out.length) { console.log('Nothing to write.'); return; }

  // Dedupe by (team_id, season) BEFORE writing. A club can appear in more
  // than one league we queried (shared team_id across competitions), and
  // Postgres rejects an upsert that touches the same conflict target twice
  // in one batch ("cannot affect row a second time"). Last write wins.
  const seen = new Map();
  for (const row of out) {
    seen.set(`${row.team_id}::${row.season}`, row);
  }
  const deduped = [...seen.values()];
  const dropped = out.length - deduped.length;
  if (dropped > 0) console.log(`Deduped ${dropped} duplicate club row(s) shared across leagues.`);

  // upsert in chunks on (team_id, season)
  let written = 0, failed = 0;
  for (let i = 0; i < deduped.length; i += 100) {
    const chunk = deduped.slice(i, i + 100);
    const { error } = await sb
      .from('derived_team_profiles')
      .upsert(chunk, { onConflict: 'team_id,season' });
    if (error) {
      console.error(`Upsert error on chunk ${i}-${i + chunk.length}:`, error.message);
      failed += chunk.length;
      continue;            // keep going; don't lose the whole run on one bad chunk
    }
    written += chunk.length;
  }
  console.log(`Wrote ${written} rows to derived_team_profiles.${failed ? ` (${failed} failed)` : ''}`);
}

main().catch(e => { console.error(e); process.exit(1); });
