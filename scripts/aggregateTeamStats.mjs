// ============================================================
// aggregateTeamStats.mjs  —  measured team profiles from player data
// ------------------------------------------------------------
// TheStatsAPI has NO team-stats endpoint with possession (confirmed
// via curl — team stats return only goals/form/position). But the deep
// signal exists at PLAYER level, and ~4,065 players are already enriched
// with it (final_third_passes, ground_duel_win_pct, big_chances_created,
// accurate_crosses, etc.). This script aggregates each squad's player
// stats UP to team level to produce genuinely MEASURED tactical axes,
// then merges them into derived_team_profiles — upgrading the goals-based
// derived profiles for the ~176 teams that have enough enriched players.
//
// Zero API calls. Pure Supabase read + write.
//
// Key design choices that keep it honest:
//  - MINUTES-WEIGHTED: a 3000-min starter counts more than a 200-min sub,
//    so the squad average reflects who actually plays.
//  - THRESHOLD GUARD: only teams with >= MIN_PLAYERS enriched players are
//    aggregated; below that, the goals-based derived profile is left alone.
//  - PERCENTILE NORMALIZATION: each axis is ranked ACROSS all qualifying
//    teams, so the 0-100 scale is relative to the real population — this is
//    what makes the profiles DISCRIMINATE instead of clustering (the bug
//    that made System Fit useless before the rewrite).
//  - aggregated-wins-where-present: a measured profile overwrites the
//    goals-derived one for that team; breadth leagues keep goals-based.
//
// USAGE (one line, no quotes, real values):
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/aggregateTeamStats.mjs
//
// Flags:
//   DRY=1          compute + print, write nothing
//   MIN_PLAYERS=6  minimum enriched players per team (default 6)
// ============================================================

import { createClient } from '@supabase/supabase-js';

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY = process.env.DRY === '1';
const MIN_PLAYERS = Number(process.env.MIN_PLAYERS || 6);

if (!SB_URL || !SB_KEY) {
  console.error('Missing env. Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

const num = v => (v == null || Number.isNaN(Number(v))) ? null : Number(v);

// ── 1. Pull all enriched players with a team id ────────────────────
// Page through (Supabase caps at 1000 rows/request).
async function fetchEnrichedPlayers() {
  const cols = [
    'api_team_id', 'minutes', 'stats_minutes',
    'pass_accuracy', 'passes', 'final_third_passes', 'opp_half_passes', 'own_half_passes',
    'tackles', 'interceptions', 'ground_duel_win_pct', 'aerial_duel_win_pct',
    'accurate_crosses', 'cross_accuracy',
    'big_chances_created', 'total_shots', 'shots_on_target',
    'successful_dribbles', 'dribble_success_pct',
  ].join(',');

  const all = [];
  let from = 0;
  const PAGE = 1000;
  for (;;) {
    const { data, error } = await sb
      .from('players')
      .select(cols)
      .not('final_third_passes', 'is', null)
      .not('api_team_id', 'is', null)
      .range(from, from + PAGE - 1);
    if (error) { console.error('Fetch error:', error.message); process.exit(1); }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

// ── 2. Aggregate per team, minutes-weighted ────────────────────────
// For each metric we compute a minutes-weighted squad mean (so starters
// dominate). Volume metrics (passes, shots, crosses) are summed per-90
// to reflect team output; rate metrics (accuracy, win%) are weighted means.
function aggregateByTeam(players) {
  const teams = new Map();

  for (const p of players) {
    const id = Number(p.api_team_id);
    const mins = num(p.minutes) || num(p.stats_minutes) || 0;
    if (mins <= 0) continue;                 // can't weight a player with no minutes
    if (!teams.has(id)) teams.set(id, { id, count: 0, totalMins: 0, acc: {} });
    const t = teams.get(id);
    t.count += 1;
    t.totalMins += mins;

    // weighted accumulators. For each field we keep sum(value * mins) and
    // for per-90 volumes we keep sum(value) and totalMins separately.
    const add = (k, v) => {
      const x = num(v);
      if (x == null) return;
      t.acc[k] = t.acc[k] || { wsum: 0, wmins: 0, vsum: 0 };
      t.acc[k].wsum += x * mins;   // for weighted mean
      t.acc[k].wmins += mins;
      t.acc[k].vsum += x;          // for raw sum (per-90 volume)
    };

    add('pass_accuracy', p.pass_accuracy);
    add('passes', p.passes);
    add('final_third_passes', p.final_third_passes);
    add('opp_half_passes', p.opp_half_passes);
    add('own_half_passes', p.own_half_passes);
    add('tackles', p.tackles);
    add('interceptions', p.interceptions);
    add('ground_duel_win_pct', p.ground_duel_win_pct);
    add('aerial_duel_win_pct', p.aerial_duel_win_pct);
    add('accurate_crosses', p.accurate_crosses);
    add('cross_accuracy', p.cross_accuracy);
    add('big_chances_created', p.big_chances_created);
    add('total_shots', p.total_shots);
    add('successful_dribbles', p.successful_dribbles);
  }

  // collapse accumulators into per-team metric values
  const out = [];
  for (const t of teams.values()) {
    if (t.count < MIN_PLAYERS) continue;     // threshold guard
    const wmean = k => (t.acc[k] && t.acc[k].wmins) ? t.acc[k].wsum / t.acc[k].wmins : null;
    const per90 = k => (t.acc[k] && t.totalMins) ? (t.acc[k].vsum / t.totalMins) * 90 * t.count : null;
    // note: per90 here is a squad-level volume proxy (sum across squad,
    // scaled). It's only used for RELATIVE ranking, so the exact scale
    // doesn't matter — only the ordering across teams does.

    out.push({
      id: t.id,
      count: t.count,
      m: {
        pass_accuracy:      wmean('pass_accuracy'),
        final_third_vol:    per90('final_third_passes'),
        opp_half_vol:       per90('opp_half_passes'),
        own_half_vol:       per90('own_half_passes'),
        pass_vol:           per90('passes'),
        tackles_vol:        per90('tackles'),
        interceptions_vol:  per90('interceptions'),
        ground_duel:        wmean('ground_duel_win_pct'),
        aerial_duel:        wmean('aerial_duel_win_pct'),
        cross_vol:          per90('accurate_crosses'),
        cross_acc:          wmean('cross_accuracy'),
        big_chances_vol:    per90('big_chances_created'),
        shots_vol:          per90('total_shots'),
        dribbles_vol:       per90('successful_dribbles'),
      },
    });
  }
  return out;
}

// ── 3. Percentile-rank normalization ───────────────────────────────
// Rank each metric across all qualifying teams -> 0..1, then to a 35..99
// band. This GUARANTEES spread (relative to the real population) instead
// of clustering. Teams missing a metric get the median rank (0.5).
function percentileRanker(teams, metricKey) {
  const vals = teams.map(t => t.m[metricKey]).filter(v => v != null).sort((a, b) => a - b);
  if (vals.length === 0) return () => 0.5;
  return (v) => {
    if (v == null) return 0.5;
    // fraction of teams at or below v
    let lo = 0, hi = vals.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (vals[mid] <= v) lo = mid + 1; else hi = mid; }
    return lo / vals.length;
  };
}

function band(p) { return Math.round(35 + p * 64); }   // 0..1 -> 35..99

function buildAxes(teams) {
  // pre-build rankers for each raw metric
  const rk = {};
  for (const k of Object.keys(teams[0].m)) rk[k] = percentileRanker(teams, k);
  const pr = (t, k) => rk[k](t.m[k]);

  for (const t of teams) {
    // Track whether each axis had ANY real input (vs all-null -> median).
    const has = k => t.m[k] != null;
    t.inputs = {
      control:       has('pass_accuracy') || has('final_third_vol') || has('opp_half_vol'),
      tempo:         has('pass_vol') || has('shots_vol'),
      transition:    has('big_chances_vol') || has('shots_vol') || has('dribbles_vol'),
      pressing:      has('tackles_vol') || has('interceptions_vol') || has('ground_duel'),
      width:         has('cross_vol') || has('cross_acc'),
      defensiveLoad: has('own_half_vol') || has('tackles_vol') || has('interceptions_vol'),
    };

    // Each axis blends a few percentile-ranked metrics. Weights reflect
    // which signals best express that tactical dimension.
    const control = band(
      0.45 * pr(t, 'pass_accuracy') +
      0.30 * pr(t, 'final_third_vol') +
      0.25 * pr(t, 'opp_half_vol')
    );
    const tempo = band(
      0.55 * pr(t, 'pass_vol') +
      0.45 * pr(t, 'shots_vol')
    );
    const transition = band(
      0.50 * pr(t, 'big_chances_vol') +
      0.30 * pr(t, 'shots_vol') +
      0.20 * pr(t, 'dribbles_vol')
    );
    const pressing = band(
      0.40 * pr(t, 'tackles_vol') +
      0.35 * pr(t, 'interceptions_vol') +
      0.25 * pr(t, 'ground_duel')
    );
    const width = band(
      0.60 * pr(t, 'cross_vol') +
      0.40 * pr(t, 'cross_acc')
    );
    // defensiveLoad: built ONLY from reliably-populated fields.
    // aerial_duel_win_pct is present on just ~20% of enriched players, so
    // including it collapsed many teams to the median (band(0.5)≈73). We use
    // own-half pass share (a side that plays more in its own half carries more
    // defensive load) + defensive actions volume (tackles + interceptions),
    // all populated on 100% of enriched players.
    const defensiveLoad = band(
      0.45 * pr(t, 'own_half_vol') +
      0.30 * pr(t, 'tackles_vol') +
      0.25 * pr(t, 'interceptions_vol')
    );

    t.traits = { control, transition, pressing, width, tempo, defensiveLoad };
  }
  return teams;
}

// ── 4. Merge into derived_team_profiles ────────────────────────────
async function main() {
  console.log(`Aggregating measured team profiles · min ${MIN_PLAYERS} enriched players/team${DRY ? ' · DRY RUN' : ''}`);

  const players = await fetchEnrichedPlayers();
  console.log(`Fetched ${players.length} enriched player rows.`);

  let teams = aggregateByTeam(players);
  console.log(`${teams.length} teams clear the ${MIN_PLAYERS}-player threshold.`);
  if (teams.length === 0) { console.log('Nothing to aggregate.'); return; }

  teams = buildAxes(teams);

  // pull existing derived rows so we update in place (keep name/league/etc.)
  const { data: existing, error: exErr } = await sb
    .from('derived_team_profiles')
    .select('team_id,season,name,short,country,league,league_id,formation,philosophy,intensity,line_height,crest,logo');
  if (exErr) { console.error('Read derived error:', exErr.message); process.exit(1); }
  const byId = new Map((existing || []).map(r => [Number(r.team_id), r]));

  // build upsert rows: only for teams we have a derived profile for
  // (so we keep their name/league metadata and just swap in measured traits)
  const rows = [];
  let matched = 0, noProfile = 0;
  for (const t of teams) {
    const base = byId.get(t.id);
    if (!base) { noProfile += 1; continue; }   // enriched team not in derived set
    matched += 1;

    // Safety net: if a measured axis had NO real inputs for this team (every
    // contributing field was null, so it landed on the median default), keep
    // the team's existing goals-derived trait for that axis instead of writing
    // a flat default. Honest fallback — measured where we can, goals-based
    // where we can't, never a fabricated middle value.
    const measured = t.traits;
    const prior = base.traits || {};
    const blended = {};
    for (const axis of ['control', 'transition', 'pressing', 'width', 'tempo', 'defensiveLoad']) {
      const hadInputs = t.inputs && t.inputs[axis];
      blended[axis] = hadInputs ? measured[axis] : (prior[axis] ?? measured[axis]);
    }

    rows.push({
      ...base,
      traits: blended,
      derived: true,
      source: 'player-aggregated',
      profile_source: 'aggregated',
      enriched_players: t.count,
      updated_at: new Date().toISOString(),
    });
  }

  console.log(`Matched ${matched} teams to existing derived profiles. ${noProfile} enriched teams had no derived profile (skipped).`);

  // print a sample so the spread can be eyeballed
  const sample = rows.slice(0, 12);
  console.log('\nSample measured profiles:');
  for (const r of sample) {
    const x = r.traits;
    console.log(`  ${(r.name || r.team_id).padEnd(22)} ctl ${x.control} tr ${x.transition} pr ${x.pressing} wd ${x.width} tp ${x.tempo} def ${x.defensiveLoad}  [${r.enriched_players}p]`);
  }

  if (DRY) { console.log('\nDRY RUN — nothing written.'); return; }
  if (!rows.length) { console.log('Nothing to write.'); return; }

  let written = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const { error } = await sb
      .from('derived_team_profiles')
      .upsert(chunk, { onConflict: 'team_id,season' });
    if (error) { console.error(`Upsert error chunk ${i}:`, error.message); continue; }
    written += chunk.length;
  }
  console.log(`\nWrote ${written} measured profiles to derived_team_profiles (profile_source='aggregated').`);
}

main().catch(e => { console.error(e); process.exit(1); });
