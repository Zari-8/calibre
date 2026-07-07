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

    // Count-INDEPENDENT ratios. Unlike per90 volumes (which scale with squad
    // size / match-completeness), these are pure shares in [0,1], so they
    // compare cleanly across teams regardless of how many players matched.
    const vsum  = k => (t.acc[k] ? t.acc[k].vsum : null);
    const share = (a, b) => { const x = vsum(a), y = vsum(b); return (x != null && y != null && (x + y) > 0) ? x / (x + y) : null; };
    const ratio = (a, b) => { const x = vsum(a), y = vsum(b); return (x != null && y != null && y > 0) ? x / y : null; };

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
        // territory shares (count-independent) — for the pressing axis
        opp_half_share:     share('opp_half_passes', 'own_half_passes'),
        final_third_share:  ratio('final_third_passes', 'passes'),
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

function normBase(s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// Canonical name join: reconciles StatsAPI names (in team_indices) with the
// names stored in derived_team_profiles. First an explicit alias table for the
// ones that can't be derived, then generic prefix/suffix stripping.
const NAME_ALIASES = {
  'as monaco': 'monaco',
  'olympique de marseille': 'marseille',
  'olympique lyonnais': 'lyon',
  'stade rennais': 'rennes',
  'rc lens': 'lens',
  'rc strasbourg': 'strasbourg',
  'rc strasbourg alsace': 'strasbourg',
  'fc bayern munchen': 'bayern munchen',
  'sporting': 'sporting cp',
  'sporting clube de portugal': 'sporting cp',
  'bayer 04 leverkusen': 'bayer leverkusen',
  'borussia m gladbach': 'borussia monchengladbach',
  '1 fsv mainz 05': 'fsv mainz 05',
  'sv werder bremen': 'werder bremen',
  'internazionale': 'inter',
  'inter milano': 'inter',
};

function norm(s) {
  let n = normBase(s);
  if (NAME_ALIASES[n]) return NAME_ALIASES[n];
  // generic: drop leading club prefixes and a trailing bare "fc"/"cf".
  // Numeric tokens (05, 04, 1899…) are left intact — stripping them is unsafe.
  n = n
    .replace(/^(fc|afc|sc|ac|as|rc|rcd|ss|ssc|ssv|sv|vfl|vfb|us|ud|cd|cf)\s+/, '')
    .replace(/^olympique( de)?\s+/, '')
    .replace(/^stade\s+/, '')
    .replace(/\s+(fc|cf)$/, '')
    .trim();
  return NAME_ALIASES[n] || n;
}

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
      pressing:      has('opp_half_share') || has('final_third_share') || has('ground_duel'),
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
    // PRESSING — where the team wins and plays the ball, NOT raw tackle volume.
    // Tackle/interception counts are an ANTI-signal for elite pressing sides:
    // possession-dominant teams (City, Liverpool) tackle less because the
    // opponent rarely has the ball. High tackle volume instead marks teams that
    // DEFEND a lot (deep blocks) — which is defensiveLoad, not pressing. So we
    // base pressing on territorial dominance (share of passing in the opponent
    // half), sustained final-third involvement, and ground-duel aggression —
    // all count-independent, so a true high press separates cleanly from a deep
    // block that merely racks up defensive actions.
    const pressing = band(
      0.45 * pr(t, 'opp_half_share') +
      0.30 * pr(t, 'ground_duel') +
      0.25 * pr(t, 'final_third_share')
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

  // ── PPDA-based pressing override (from team_indices) ──────────────────────
  // PPDA (opponent passes ÷ our defensive actions) is the correct press signal;
  // LOW ppda = intense press. We rank it GLOBALLY across every team that has it
  // and override the territory-based pressing axis for those teams. Teams with
  // no PPDA keep the territory fallback, so nothing regresses. Joined by name
  // because team_indices is keyed by StatsAPI id, this table by API-Football id.
  // Cup competitions (small, ~5-13 match samples that DUPLICATE clubs already
  // present via their domestic league) are excluded — they contaminate the
  // global press ranking. And when a club has more than one league row, we keep
  // the highest-sample one so full-season PPDA always beats a thin sample.
  const CUP_COMPS = new Set(['comp_3498', 'comp_08478']); // UEFA CL, CAF CL
  const { data: idx } = await sb.from('team_indices').select('team_name,ppda_raw,matches,competition_id');
  const bestByName = new Map(); // canonical name -> { ppda, matches }
  for (const r of (idx || [])) {
    if (r.ppda_raw == null || !r.team_name) continue;
    if (CUP_COMPS.has(r.competition_id)) continue;        // domestic-league PPDA only
    const key = norm(r.team_name);                        // same canonicaliser both sides
    const m = Number(r.matches) || 0;
    const prev = bestByName.get(key);
    if (!prev || m > prev.matches) bestByName.set(key, { ppda: Number(r.ppda_raw), matches: m });
  }
  const ppdaByName = new Map();
  for (const [nm, v] of bestByName) ppdaByName.set(nm, v.ppda);
  for (const t of teams) {
    const base = byId.get(t.id);
    const nm = base ? norm(base.name) : null;
    t.ppda = (nm && ppdaByName.has(nm)) ? ppdaByName.get(nm) : null;
  }
  const withPpda = teams.filter(t => t.ppda != null).sort((a, b) => a.ppda - b.ppda);
  const nP = withPpda.length;
  // VALUE-based scaling (not rank). PPDA is bunched near the low-middle with a
  // long high tail, so ranking by position squashes genuinely-elite pressers
  // (e.g. PSG) into the mid-pack. Instead we map the VALUE linearly: the best
  // presser (min PPDA) → ~99, the 90th-percentile PPDA → the floor, clamped so
  // the long tail of passive teams doesn't stretch the scale. Self-calibrating.
  if (nP > 0) {
    const vals = withPpda.map(t => t.ppda);          // ascending (low = press)
    const lo = vals[0];                               // min → strongest press
    const hi = vals[Math.floor((nP - 1) * 0.90)];     // p90 → floor
    const span = Math.max(hi - lo, 1e-6);
    for (const t of withPpda) {
      const frac = Math.min(Math.max((t.ppda - lo) / span, 0), 1); // 0 at min, 1 at p90+
      t.traits.pressing = band(1 - frac);             // low ppda → high pressing
      t.ppdaPressing = true;
    }
  }
  console.log(`PPDA pressing override applied to ${nP} of ${teams.length} teams${nP === 0 ? ' (run computeTeamIndices.mjs first)' : ''}.`);

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
      const hadInputs = axis === 'pressing'
        ? (t.ppdaPressing || (t.inputs && t.inputs.pressing))
        : (t.inputs && t.inputs[axis]);
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
