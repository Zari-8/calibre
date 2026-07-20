// Calibre Rating Engine v8 — production-led, event-stat aware, league-honest,
// now competition-aware via an optional 70/30 base+overlay blend.
//
// v8 change vs v7: when a player row carries a valid `competition_splits`
// object, the engine rates two bodies of work and blends them:
//   • BASE (70%)  — domestic football (league + domestic cups) at full league
//     strength, with friendlies folded in at NEAR-FULL availability but ZERO
//     output weight (they played and were fit, so they're credited for the
//     load — but soft-opposition goals never inflate the per-90).
//   • OVERLAY (30%) — continental club + competitive national-team minutes,
//     rated at the (minutes-weighted) strength of those competitions, with the
//     goal-volume target scaled to the size of that body of work so a strong
//     continental haul isn't structurally penalised for the competition being
//     short. The overlay weight scales with a small-sample guard so a
//     200-minute cameo can't swing 30% of the rating.
// No splits, or no overlay minutes → the player rates EXACTLY as in v7. The
// blend is purely additive: nothing changes until splits are populated.
// v8.6 — Form removed from the weighted blend. It was computed as
// clamp(core*sRaw,0,100) — the EXACT same formula as Performance, no
// independent input at all — despite the public methodology copy
// (src/data/calibreData.js) describing it to users as "last five games, hot
// or cold right now." There's no per-match log feeding the engine today (the
// Players page's Form tab pulls recent fixtures live from the API for
// display, but that data was never aggregated back into a stored column this
// engine reads), so a real recency signal isn't available yet. Rather than
// silently double-count season production at 55% combined weight
// (Performance 0.35 + Form 0.20, identical inputs), Form's 0.20 is
// redistributed to the three components that ARE independent of core
// production — Consistency, Impact, Trajectory — proportional to their prior
// weights. Still computed and returned in `breakdown` for display continuity
// (and because ability's calibration below deliberately mirrors Performance,
// unaffected by this), just no longer double-counted in the score itself.
const WEIGHTS = { Performance: 0.35, Consistency: 0.20, Form: 0.20, Impact: 0.15, Trajectory: 0.10 };
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function num(v, d = 0) { const n = Number(v); return Number.isFinite(n) ? n : d; }
function per(value, mins) { return mins > 0 ? num(value) / (mins / 90) : 0; }
// v8.4 bugfix — every v8.1/v8.2 "is this field populated" check used
// num(player.x, -1) and then tested `< 0` to detect "no data". That's broken
// for real Postgres nulls: Number(null) is 0, which IS finite, so num() with
// a null input returns 0 — the -1 default NEVER fires for an actual DB null,
// only for a genuinely absent/undefined key. Since Supabase returns every
// unpopulated column as null (not undefined), this meant "no shot_accuracy
// on record" was silently read as "measured 0% shot accuracy", "no xG data"
// as "measured 0.00 xG", etc. — for the ~70-95% of rated players missing a
// given v8.2 field, these functions weren't neutral, they were actively
// applying a worst-case score. numOrNull is the correct "is this present"
// check; num() is left untouched everywhere it's used for real 0-defaults.
function numOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ── TheStatsAPI event-stat helpers (v8.1) ────────────────────────────────
// These fire only when the new columns are populated (non-null). When absent
// the engine falls back to the v8 path unchanged — no rating breakage.

// Shot quality nudge: rewards on-target efficiency, penalises big-chance waste.
// Returns a signed adjustment [-9, +9] to the production score. (v8.3: widened
// from [-6,+6] — coverage assessment showed this signal, when present, was
// too capped to move a ranked "spine" score meaningfully.)
function shotQualityNudge(player) {
  let acc = numOrNull(player.shot_accuracy);
  const missed = numOrNull(player.big_chances_missed);
  // v8.5 fallback: TheStatsAPI's shot_accuracy only reaches a minority of
  // rows. shots/shots_on are sibling fields inside the API-Football response
  // enrichPlayerStats.mjs already fetches for EVERY player — a real shot
  // accuracy reading from the base source, not just an enrichment extra.
  if (acc == null) {
    const shots = numOrNull(player.shots ?? player.total_shots);
    const shotsOn = numOrNull(player.shots_on);
    if (shots != null && shotsOn != null && shots > 0) acc = clamp((shotsOn / shots) * 100, 0, 100);
  }
  if (acc == null && missed == null) return 0;        // no new data
  let nudge = 0;
  if (acc != null) nudge += clamp((acc - 33) / 33 * 6, -6, 6);  // 33% SOT = neutral
  if (missed != null) nudge -= clamp(missed / 5 * 4.5, 0, 4.5);  // each 5 missed = -4.5
  return clamp(nudge, -9, 9);
}

// Chance creation boost: big_chances_created per 90 is a strong creativity signal.
// Returns a bonus [0, 16] added to the create component. (v8.3: widened from
// [0,10] — rarest advanced field (16.8% coverage) but the strongest single
// creativity signal we collect, worth more headroom when it's there.)
function chanceCreationBoost(player, sm) {
  const bcc = numOrNull(player.big_chances_created);
  if (bcc == null) return 0;
  const bcc90 = per(bcc, sm);
  return clamp(bcc90 / 0.5 * 16, 0, 16);     // 0.5 BCC/90 = full +16
}

// Duel quality: replaces raw count-based win rate when % data is available.
// Returns [0, 100] component score, same scale as the existing duel calc.
function duelQualityScore(player, du90) {
  const gd = numOrNull(player.ground_duel_win_pct);
  const ad = numOrNull(player.aerial_duel_win_pct);
  if (gd == null && ad == null) {
    // v8.5 fallback: a real (not ground/aerial-split) duel win% from
    // API-Football's duels.total/duels.won — sibling fields of duels.won,
    // which the engine already reads. Reaches every enriched player, not
    // just the ones with TheStatsAPI's split percentages.
    const total = numOrNull(player.duels_total);
    const won = numOrNull(player.duels_won ?? player.aerial_duels_won);
    if (total == null || won == null || total <= 0) return null;   // fall back to count-based
    const pct = clamp((won / total) * 100, 0, 100);
    const pctScore = clamp((pct - 45) / 35 * 70, 0, 100);   // 45% = neutral, matches gd/ad's ~general shape
    const volScore = clamp(du90 / 5.2 * 100, 0, 100);
    return clamp(pctScore * 0.60 + volScore * 0.40, 0, 110);
  }
  const gdScore = gd != null ? clamp((gd - 30) / 40 * 80, 0, 80) : 40;
  const adScore = ad != null ? clamp((ad - 25) / 40 * 60, 0, 60) : 30;
  const pctScore = gdScore * 0.6 + adScore * 0.4;
  // Blend with volume (du90) so a player who wins 80% of 1 duel/90 isn't overrated
  const volScore = clamp(du90 / 5.2 * 100, 0, 100);
  return clamp(pctScore * 0.60 + volScore * 0.40, 0, 110);
}

// Territorial index: opp_half_passes share → forward aggression score [0, 100].
// Used in DEF builds: a centre-back who rarely crosses halfway reads differently.
function territorialIndex(player) {
  const opp = numOrNull(player.opp_half_passes);
  const own = numOrNull(player.own_half_passes);
  if (opp == null || own == null || opp + own === 0) return null;
  const share = opp / (opp + own);            // 0 = never attacks, 1 = always
  return clamp(share * 100, 0, 100);
}

// Dribble quality: uses success % when available, else falls back to raw dr90.
function dribbleScore(player, sm) {
  const pct = numOrNull(player.dribble_success_pct);
  const cnt = numOrNull(player.successful_dribbles ?? player.dribbles_success);
  if (pct == null) {
    const dr90 = per(player.dribbles_success ?? player.dribbles, sm);
    return { dr90, bonus: 0 };
  }
  const dr90 = cnt != null ? per(cnt, sm) : per(player.dribbles_success ?? player.dribbles, sm);
  // Quality bonus: high success rate above 55% average earns up to +12.
  // (v8.3: widened from [-4,+8] — only 8.9% coverage, but a clean skill
  // signal that was barely nudging the score even when present.)
  const bonus = clamp((pct - 55) / 25 * 12, -6, 12);
  return { dr90, bonus };
}

// v8.5 — API-Football sibling fields that were fetched every enrichment run
// and simply never read off the response: tackles.blocks, dribbles.past,
// cards.yellow/red, fouls.committed/drawn, penalty.won/scored/missed. Zero
// extra API cost — these are all in the SAME response as tackles.total,
// duels.won, goals.total etc. which the engine already consumes.

// Blocks are a genuine defensive action distinct from tackles/interceptions
// (shots and crosses stopped, not the ball won outright). Being dribbled
// past a lot is a real weakness signal a raw tackle/interception count can't
// see — a defender can rack up tackles while still getting turned constantly.
// Returns a signed adjustment [-8, +8].
function defensiveExtrasNudge(player, sm) {
  const blocks = numOrNull(player.tackle_blocks);
  const past = numOrNull(player.dribbled_past);
  if (blocks == null && past == null) return 0;
  let nudge = 0;
  if (blocks != null) nudge += clamp(per(blocks, sm) / 1.2 * 6, 0, 6);      // 1.2 blocks/90 = full credit
  if (past != null) nudge -= clamp(per(past, sm) / 2.5 * 8, 0, 8);          // 2.5 times dribbled past/90 = full penalty
  return clamp(nudge, -8, 8);
}

// Discipline: cards scaled per-90, deliberately mild — a competitive tackler
// naturally picks some up, this isn't meant to punish physical defending,
// just the extreme end (repeat bookings, red cards, conceding penalties).
// Returns [-10, 0].
function disciplineNudge(player, sm) {
  const yellows = numOrNull(player.yellow_cards);
  const reds = numOrNull(player.red_cards);
  const penCon = numOrNull(player.penalty_conceded);
  if (yellows == null && reds == null && penCon == null) return 0;
  let penalty = 0;
  if (yellows != null) penalty += clamp((per(yellows, sm) - 0.15) / 0.35 * 4, 0, 4);  // >0.15 yellows/90 starts costing
  if (reds != null) penalty += clamp(per(reds, sm) / 0.05 * 3, 0, 3);                  // any real red-card rate is a big deal
  // Conceding a penalty is a sharper, rarer lapse than a normal foul — a real
  // per-90 rate here (any at all, given how rare pens are) is a bigger deal
  // than a card, so it gets its own headroom rather than sharing the "fouls" bucket.
  if (penCon != null) penalty += clamp(per(penCon, sm) / 0.06 * 3, 0, 3);
  return -clamp(penalty, 0, 10);
}

// Fouls drawn is a real threat signal defenders have to give something up to
// stop (an attacker nobody wants to foul isn't being pressured). Penalties
// won is the sharpest version of the same thing — earning a foul in the box.
// Returns a bonus [0, 10] for ATT/MID creation components.
function foulsAndPenaltyBoost(player, sm) {
  const drawn = numOrNull(player.fouls_drawn);
  const penWon = numOrNull(player.penalty_won);
  let boost = 0;
  if (drawn != null) boost += clamp(per(drawn, sm) / 1.8 * 6, 0, 6);   // 1.8 fouls drawn/90 = full credit
  if (penWon != null) boost += clamp(per(penWon, sm) / 0.15 * 4, 0, 4); // a real penalty-won rate is rare and valuable
  return clamp(boost, 0, 10);
}
// Incisiveness signal (v8.4): raw pass_accuracy/volume treats a sideways
// safety ball the same as a defense-splitting line-breaker. TheStatsAPI's
// season-stats endpoint carries `final_third_passes` (accurate_final_third
// _passes — completed passes that land IN the attacking third), which this
// codebase has been collecting via reconcileNames.mjs but never actually
// reading. It's a much better proxy for pass QUALITY/risk than accuracy%,
// which rewards a keeper-to-centreback recycle just as much as a through
// ball. Returns a bonus [0, 14], additive, 0 when no data (no behavior
// change until the field is populated for a given row).
function incisivePassBoost(player, sm) {
  const f3p = numOrNull(player.final_third_passes);
  if (f3p == null) return 0;
  const f3p90 = per(f3p, sm);
  return clamp(f3p90 / 4.5 * 14, 0, 14);   // ~4.5 accurate final-third passes/90 = full credit
}
const LEAGUE_ID_STRENGTH = { 39:1.00,140:1.00,78:0.98,135:0.96,61:0.92,94:0.84,88:0.83,71:0.82,144:0.80,40:0.81,203:0.73,128:0.80,13:0.74,307:0.63,253:0.80,98:0.72,281:0.66,12:0.66,399:0.55,525:0.94,44:0.92,254:0.90,142:0.90,82:0.90,64:0.88,139:0.86,949:0.74 };
const LEAGUE_STRENGTH = { 'la liga':1.00,'premier league':1.00,'bundesliga':0.98,'serie a':0.96,'ligue 1':0.92,'primeira liga':0.84,'eredivisie':0.83,'championship':0.81,'pro league':0.80,'super lig':0.73,'saudi pro league':0.63,'brasileiro':0.82,'brasileirão':0.82,'mls':0.80,'j1 league':0.72,'npfl':0.55,'zimbabwe psl':0.50 };
const DEFAULT_LEAGUE = 0.70;
function leagueStrength(line) {
  const id = num(line.league_id ?? line.leagueId);
  if (id && LEAGUE_ID_STRENGTH[id] != null) return LEAGUE_ID_STRENGTH[id];
  const key = String(line.league ?? line.league_name ?? '').trim().toLowerCase();
  if (key) { if (LEAGUE_STRENGTH[key] != null) return LEAGUE_STRENGTH[key];
    for (const name in LEAGUE_STRENGTH) if (key.includes(name)) return LEAGUE_STRENGTH[name]; }
  return DEFAULT_LEAGUE;
}
export function positionBucket(player) {
  // player.archetype deliberately excluded — including it makes bucket
  // detection circular (a stale/wrong archetype label can hijack the regex
  // before the real position fields get a say; this class of bug was found
  // and fixed in playerTraits.js's own positionBucket() earlier — ported
  // the same fix here so a future archetype recompute can't corrupt rating
  // position detection the same way).
  const text = `${player.role||''} ${player.position||''} ${player.pos||''} ${player.primary_role||''} ${player.raw_position||''}`.toLowerCase();
  if (/(goalkeeper|keeper|\bgk\b)/.test(text)) return 'GK';
  if (/(defender|centre.?back|center.?back|full.?back|wing.?back|\bcb\b|\brb\b|\blb\b|\bdef\b)/.test(text)) return 'DEF';
  if (/(striker|forward|winger|wide creator|wide forward|attack|poacher|fox|\bst\b|\brw\b|\blw\b|\bcf\b|\bfwd\b|\batt\b)/.test(text)) return 'ATT';
  return 'MID';
}
// v8.3 recalibration — anchored to the real api_average_rating distribution
// across 10,245 rated players (assessApiRatingDistribution.mjs), not an
// arbitrary flat slope. The old function required apiR ~9.2 to reach 100 and
// mapped the true median (6.76) to 38.5 — meaning q was contributing *below*
// neutral for essentially the entire rated population, not just a few edge
// cases. These anchors put the empirical median at 50 and spread the real
// p10/p90/p99/max points around it, piecewise-linear between them.
const Q_ANCHORS = [
  [3.30, 5],    // observed min
  [6.45, 25],   // p10
  [6.76, 50],   // p50 (median) — neutral, by definition
  [7.14, 75],   // p90
  [7.64, 92],   // p99
  [10.00, 100], // observed max
];
export function qFlat(apiR) {
  if (!(apiR > 0)) return 46;
  if (apiR <= Q_ANCHORS[0][0]) return Q_ANCHORS[0][1];
  for (let i = 1; i < Q_ANCHORS.length; i++) {
    const [x1, y1] = Q_ANCHORS[i - 1];
    const [x2, y2] = Q_ANCHORS[i];
    if (apiR <= x2) {
      const t = (apiR - x1) / (x2 - x1);
      return clamp(y1 + t * (y2 - y1), 0, 100);
    }
  }
  return 100;
}
// REVERTED (see session notes) — sort-based spine() is how the entire 1-99
// scale (TRIM_FLOOR, the 27+x*0.72 compression curve, Q_ANCHORS) was
// calibrated. Swapping it for positional weighting is mathematically
// guaranteed (rearrangement inequality: weights are ~monotonically
// descending per bucket, so sorted pairing is always >= any other pairing)
// to lower nearly every player's score, not just the inflated ones — dry run
// showed 10,111/13,883 players dropping, average -6.1, with legitimate
// starters (Abel Ruiz, Girona) landing at 47. Not a targeted fix; a full
// recalibration event that needs its own project. Left as the original
// production logic pending that decision.
function spine(vals, w) { const s = [...vals].sort((a,b)=>b-a); let p=0; s.forEach((v,i)=>{p+=v*(w[i]??0);}); return p; }
export function productionComponents(player, bucket) {
  const m = num(player.minutes ?? player.mins);
  const sm = num(player.stats_minutes) || m;

  // API-Football remains the baseline.
  // TheStatsAPI fields only fill/enhance where available.
  const passesRaw = player.passes ?? player.total_passes;
  const shotsRaw = player.shots ?? player.total_shots;
  const keyRaw = player.key_passes;
  const tacklesRaw = player.tackles;
  const interceptionsRaw = player.interceptions;
  const duelsRaw = player.duels_won ?? player.aerial_duels_won;

  const ev = sm > 0 && num(passesRaw) > 0;

  const g90 = per(player.goals, sm);
  const a90 = per(player.assists, sm);

  const xg = numOrNull(player.xg ?? player.expected_goals);
  const xa = numOrNull(player.xa ?? player.expected_assists);
  const npxg = numOrNull(player.npxg ?? player.np_expected_goals);

  const xg90 = xg != null ? per(xg, sm) : null;
  const xa90 = xa != null ? per(xa, sm) : null;
  const npxg90 = npxg != null ? per(npxg, sm) : null;

  const pass90 = per(passesRaw, sm);
  const acc = num(player.pass_accuracy);
  const key90 = per(keyRaw, sm);
  const tk90 = per(tacklesRaw, sm);
  const in90 = per(interceptionsRaw, sm);
  const du90 = per(duelsRaw, sm);
  const sh90 = per(shotsRaw, sm);

  const possessionLost90 = per(player.possession_lost, sm);
  const clear90 = per(player.clearances, sm);
  const touch90 = per(player.touches, sm);

  // v8.2 — StatsAPI advanced signals
  const { dr90, bonus: dribBonus } = dribbleScore(player, sm);
  const sqNudge = shotQualityNudge(player);
  const bccBoost = chanceCreationBoost(player, sm);
  const duelScore = duelQualityScore(player, du90);
  const terr = territorialIndex(player);
  const f3pBoost = incisivePassBoost(player, sm);
  const defExtras = defensiveExtrasNudge(player, sm);
  const foulsBoost = foulsAndPenaltyBoost(player, sm);

  const shotQuality = numOrNull(player.shot_quality);
  const shotQualityBonus = shotQuality != null
    ? clamp((shotQuality - 0.10) / 0.12 * 6, -3, 6)
    : 0;

  // Possession loss should not destroy attackers, but it should slightly punish
  // midfielders/controllers who lose the ball too often.
  const lossPenalty = possessionLost90 > 0
    ? clamp((possessionLost90 - 8) / 8 * 4, 0, 5)
    : 0;

  // Touch involvement helps controllers/defenders; it is not a goal-output stat.
  const touchBonus = touch90 > 0 ? clamp((touch90 - 45) / 40 * 5, -2, 5) : 0;

  const volTarget = num(player._volTarget, 34) || 34;

  const ratePts = clamp(g90 / 0.92 * 100, 0, 140);
  const volPts = clamp(num(player.goals) / volTarget * 100, 0, 140);

  // xG makes goal threat fairer: a player getting good chances is credited even
  // before goals arrive; over/under finishing still matters through actual goals.
  const xgPts = xg90 != null ? clamp(xg90 / 0.55 * 100, 0, 140) : null;
  const npxgPts = npxg90 != null ? clamp(npxg90 / 0.48 * 100, 0, 130) : null;

  let goalScore = xgPts != null
    ? clamp(ratePts * 0.34 + volPts * 0.26 + xgPts * 0.28 + (npxgPts ?? xgPts) * 0.12 + sqNudge + shotQualityBonus, 0, 145)
    : clamp(ratePts * 0.5 + volPts * 0.5 + sqNudge + shotQualityBonus, 0, 140);

  // xA upgrades creation beyond raw assists.
  const assistSignal = xa90 != null
    ? Math.max(a90 / 0.30 * 80, xa90 / 0.30 * 80)
    : a90 / 0.30 * 80;

  if (bucket === 'ATT') {
    const create = clamp(assistSignal + key90 / 2.5 * 30 + bccBoost, 0, 120);
    // v8.3: duelScore (ground/aerial duel win%) was computed for every player
    // but only ever consumed by DEF/MID — a forward's hold-up play and
    // physical duel-winning never touched their rating. Folded into carry at
    // a modest weight; ceiling raised 95->100 to give it room without
    // truncating existing dribble/shot-volume carry scores.
    const duelNudge = duelScore != null ? (duelScore - 50) * 0.10 : 0;
    const carry = clamp(dr90 / 2.1 * 40 + dribBonus + sh90 / 4.0 * 28 + duelNudge, 0, 100);
    return { vals: [goalScore, clamp(create + foulsBoost, 0, 134), carry], w: [0.76, 0.16, 0.08], ev };
  }

  if (bucket === 'DEF') {
    const rawDuel = clamp(tk90 / 2.1 * 40 + in90 / 1.7 * 38 + du90 / 5.2 * 40 + clear90 / 4.5 * 16 + defExtras, 0, 118);
    const defend = duelScore !== null ? clamp(duelScore * 1.05 + clear90 / 4.5 * 12 + defExtras, 0, 118) : rawDuel;
    const build = ev
      ? clamp((acc - 76) / (93 - 76) * 52 + pass90 / 78 * 48 + touchBonus + (terr != null ? (terr - 40) * 0.15 : 0), 0, 112)
      : 56;
    const prog = clamp(key90 / 1.0 * 42 + dr90 / 0.9 * 28 + dribBonus + f3pBoost, 0, 102);
    const att = clamp(g90 / 0.14 * 55 + a90 / 0.18 * 45 + (xg90 != null ? xg90 / 0.10 * 18 : 0), 0, 95);
    return { vals: [defend, build, prog, att], w: [0.66, 0.21, 0.08, 0.05], ev };
  }

  // MID
  const progress = ev
    ? clamp(pass90 / 68 * 60 + (acc - 75) / (93 - 75) * 56 + touchBonus - lossPenalty + (terr != null ? (terr - 50) * 0.10 : 0), 0, 126)
    : clamp(48 + a90 / 0.35 * 25, 0, 86);

  const create = clamp(
    key90 / 1.9 * 52 +
    (xa90 != null ? xa90 / 0.32 * 52 : a90 / 0.46 * 52) +
    bccBoost +
    f3pBoost +
    foulsBoost,
    0,
    144
  );

  const goal = clamp(g90 / 0.42 * 70 + (xg90 != null ? xg90 / 0.32 * 38 : 0) + sqNudge + shotQualityBonus, 0, 122);
  const carry = clamp(dr90 / 1.5 * 64 + dribBonus - lossPenalty * 0.5, 0, 104);
  const duelRaw = clamp(tk90 / 2.1 * 48 + in90 / 1.4 * 42 + clear90 / 3.0 * 8 + defExtras, 0, 104);
  const defend = duelScore !== null ? clamp(duelScore * 0.86 + tk90 / 2.1 * 10 + in90 / 1.4 * 10 + defExtras, 0, 104) : duelRaw;

  return { vals: [progress, create, goal, carry, defend], w: [0.58, 0.24, 0.09, 0.04, 0.05], ev };
}

// ── Core scorer: rate ONE body of work. ─────────────────────────────────
// Optional line fields:
//   _strengthOverride : use this strength instead of the league lookup (the
//                       overlay passes its minutes-weighted competition strength)
//   _volTarget        : goal-volume target for full credit (overlay scales this)
//   avail_minutes / avail_apps / avail_starts : availability inputs that may
//                       exceed the OUTPUT minutes — friendlies fold in here, so a
//                       player is credited for fitness/selection without diluting
//                       per-90 output. Absent → equal to the output figures.
function scoreLine(line = {}) {
  const minutes=num(line.minutes ?? line.mins);
  const apiR=num(line.api_average_rating ?? line.apiAverageRating ?? line.apiRating);
  const age=num(line.age,0);
  const bucket=positionBucket(line);
  const ovr=num(line._strengthOverride, NaN);
  const sRaw=Number.isFinite(ovr)?clamp(ovr,0.30,1.10):leagueStrength(line);
  const baseApps=num(line.appearances ?? line.apps);
  // Hollow-shell fingerprint: a row touched only by TheStatsAPI enrichment,
  // never resolved to a real API-Football league/rating/minutes. These
  // produce fake floor ratings (per-90 stats collapse without real minutes)
  // whether or not a correctly-enriched duplicate row exists elsewhere for
  // the same player. Treat as no evidence rather than score it.
  const leagueId = num(line.league_id ?? line.leagueId);
  const hollowShell = !leagueId && !(apiR>0) && !(minutes>0) && num(line.stats_minutes)>0;
  const hasEvidence = !hollowShell && (minutes>0 || baseApps>0 || apiR>0 || num(line.stats_minutes)>0);
  if (!hasEvidence) return { rating:null, computed:null, breakdown:null, bucket, confidence:'none', provisional:true };

  let availMin=num(line.avail_minutes, NaN); if (!Number.isFinite(availMin)) availMin=minutes||num(line.stats_minutes);
  let appsA=num(line.avail_apps, NaN); if (!Number.isFinite(appsA)) appsA=baseApps;
  let startsA=num(line.avail_starts, NaN); if (!Number.isFinite(startsA)) startsA=num(line.starts);
  if (appsA<=0 && availMin>0) { appsA=availMin/85; startsA=appsA*0.9; }

  const q=qFlat(apiR);
  let production, ev;
  if (bucket==='GK') {
    const acc=num(line.pass_accuracy);
    const buildNudge=acc>0?clamp((acc-70)/25*12,0,12):0;
    const sm=num(line.stats_minutes)||minutes;

    // v8.4 — real shot-stopping signal. saves/goals_conceded come straight out
    // of API-Football's existing player-statistics payload (goals.saves /
    // goals.conceded) — the data was always there, enrichPlayerStats.mjs just
    // never read it. Previously GK production was ~90% reputation (apiR via
    // q) with zero independent signal, so two keepers with the same apiR but
    // very different actual shot-stopping graded identically. save% now
    // dilutes q once there's enough of a sample to trust it; trust ramps to
    // full weight at 40 shots faced (~half a season of regular starts). No
    // save data yet (not re-enriched) -> falls back to the old formula
    // exactly, so nothing breaks before the re-enrichment pass runs.
    const saves=numOrNull(line.saves);
    const conceded=numOrNull(line.goals_conceded);
    const shotsFaced=(saves!=null && conceded!=null)?saves+conceded:-1;
    if (shotsFaced>0) {
      const savePct=saves/shotsFaced*100;
      // 68% ~ typical top-five-league save rate = neutral(50); ±2.5pts per 1%.
      const shotStop=clamp(50+(savePct-68)*2.5,0,100);
      const trust=clamp(shotsFaced/40,0,1);
      production=clamp(q*(1-0.35*trust)+shotStop*(0.35*trust)+buildNudge,0,100);
      ev=trust>=0.5;
    } else {
      production=clamp(q*0.9+buildNudge,0,100); ev=false;
    }
  } else {
    const c=productionComponents(line,bucket);
    production=clamp(spine(c.vals,c.w),0,116); ev=c.ev;
  }
  // GK production already blends in q above (at full weight when no save
  // data, at reduced weight when it exists) — blending q in again at 24%
  // here would double-count it. Outfielders still get the normal 76/24 blend
  // since their production is entirely independent stats.
  let core = bucket === 'GK'
    ? clamp(production, 0, 108)
    : clamp(production*0.76+q*0.24, 0, 108);

  // v8.5 — discipline, applied once here rather than duplicated per bucket
  // branch. Deliberately mild (see disciplineNudge) — this is a sanity check
  // against reckless/repeat bookings, not a penalty on physical defending.
  const sm2 = num(line.stats_minutes)||minutes;
  core = clamp(core + disciplineNudge(line, sm2), 0, 108);

  const Performance=clamp(core*sRaw,0,100);
  const startRate=appsA>0?startsA/appsA:0.7, minsPerApp=appsA>0?availMin/appsA:0;
  const Consistency=clamp(clamp(startRate*100,0,100)*0.40+clamp((minsPerApp/90)*100,0,100)*0.30+clamp((availMin/3800)*100,0,100)*0.30,0,100);
  const Form=clamp(core*sRaw,0,100);
  const avail=clamp(0.88+(availMin/3600)*0.12,0.88,1.0);
  const Impact=clamp(core*sRaw*avail,0,100);
  const youth=clamp((24-age)/(24-17),0,1);
  const Trajectory=age>0?clamp(50+youth*30+(core-60)*0.10,0,100):58;
  const breakdown={ Performance:Math.round(Performance),Consistency:Math.round(Consistency),Form:Math.round(Form),Impact:Math.round(Impact),Trajectory:Math.round(Trajectory) };
  // Form intentionally excluded here — see WEIGHTS comment above. Still in
  // `breakdown` above for display continuity; not double-counted in the score.
  const weighted=Performance*WEIGHTS.Performance+Consistency*WEIGHTS.Consistency+Form*WEIGHTS.Form+Impact*WEIGHTS.Impact+Trajectory*WEIGHTS.Trajectory;
  let raw=27+weighted*0.72;
  if (raw>88) raw=88+(raw-88)*0.42;
  const TRIM_FLOOR=34;
  raw=TRIM_FLOOR+(raw-TRIM_FLOOR)*(0.72+0.28*sRaw);
  const computed=clamp(Math.round(raw),1,99);
  const confidence=ev&&apiR>0?'high':minutes>0||appsA>0?'medium':'low';

  // ── Ability vs Season split ──
  // players.rating (computed above) answers "how good has he been THIS
  // SEASON" — it's supposed to fold in Consistency/Impact, which measure
  // selection/minutes, not skill. That's legitimate for a season-realized-
  // value number, but it's the wrong number for "how good is this player,"
  // which is what the Transfer and System Fit pages actually need. A player
  // recovering from injury or rotated by a manager who doesn't trust him yet
  // isn't worse at football; he's just played fewer minutes.
  //
  // ability: same production+quality signal (Performance), run through the
  // IDENTICAL calibration curve (27+x*0.72, top-end compression, league-
  // strength trim-floor stretch) as the season score above, so the two
  // numbers sit on the same visual scale — deliberately NOT re-deriving a
  // different formula, just skipping the Consistency/Impact/Trajectory
  // discount entirely.
  let abilityRaw=27+Performance*0.72;
  if (abilityRaw>88) abilityRaw=88+(abilityRaw-88)*0.42;
  abilityRaw=TRIM_FLOOR+(abilityRaw-TRIM_FLOOR)*(0.72+0.28*sRaw);
  const ability=clamp(Math.round(abilityRaw),1,99);

  // availability: the season-workload/reliability signal that used to be
  // silently blended into players.rating — now surfaced as its own labeled
  // number (start-rate + minutes-per-appearance + total-minutes read) rather
  // than a hidden discount on the ability score above.
  const availability=Math.round(Consistency);

  return { rating:computed, computed, ability, availability, breakdown, bucket, production:Math.round(production), core:Math.round(core), leagueStrength:sRaw, confidence, provisional:!ev&&bucket!=='GK' };
}

// ── Split helpers ───────────────────────────────────────────────────────
function hasUsableSplits(s) {
  if (!s || typeof s !== 'object') return false;
  const b=s.base||{}, f=s.friendly||{}, o=s.overlay||{};
  const baseMin=num(b.minutes)+num(f.minutes);
  const baseApps=num(b.appearances)+num(f.appearances);
  return baseMin>0 || baseApps>0 || num(o.minutes)>0;
}
function carryMeta(player) {
  return { role:player.role, position:player.position, archetype:player.archetype, pos:player.pos, primary_role:player.primary_role, age:num(player.age) };
}
// v8.4 bugfix — buildBaseLine/buildOverlayLine only ever copied the fields
// that exist per-competition inside competition_splits.base/overlay (raw
// API-Football counts). The v8.1/v8.2 TheStatsAPI fields (shot_accuracy,
// xg/xa, ground_duel_win_pct, final_third_passes, etc.) are stored as flat
// SEASON TOTALS on the player row, not split by competition — so neither
// scoreLine() call for a splits-blended player ever saw them. Every player
// with international/continental minutes on record (i.e. most marquee names)
// was getting the v7 no-advanced-stats treatment regardless of how well
// enriched they actually were. There's no per-competition breakdown for
// these signals to split accurately, so the same season-level reading is
// applied to both bodies of work — an approximation, but a real signal
// beats the silent zero it was getting before.
function advancedFields(player) {
  return {
    shot_accuracy:player.shot_accuracy, big_chances_missed:player.big_chances_missed,
    big_chances_created:player.big_chances_created,
    ground_duel_win_pct:player.ground_duel_win_pct, aerial_duel_win_pct:player.aerial_duel_win_pct,
    dribble_success_pct:player.dribble_success_pct, successful_dribbles:player.successful_dribbles,
    final_third_passes:player.final_third_passes,
    opp_half_passes:player.opp_half_passes, own_half_passes:player.own_half_passes,
    shot_quality:player.shot_quality,
    xg:player.xg, xa:player.xa, npxg:player.npxg,
  };
}
function buildBaseLine(player, s) {
  const b=s.base||{}, f=s.friendly||{};
  const fMin=num(f.minutes), fApps=num(f.appearances), fStarts=num(f.starts);
  return { ...carryMeta(player), ...advancedFields(player),
    league_id:num(b.league_id)||num(player.league_id), league:player.league, league_name:player.league_name,
    api_average_rating:num(b.api_average_rating)||num(player.api_average_rating),
    minutes:num(b.minutes), stats_minutes:num(b.stats_minutes)||num(b.minutes),
    appearances:num(b.appearances), starts:num(b.starts),
    goals:num(b.goals), assists:num(b.assists),
    passes:num(b.passes), pass_accuracy:num(b.pass_accuracy),
    key_passes:num(b.key_passes), dribbles_success:num(b.dribbles_success), dribbles:num(b.dribbles),
    tackles:num(b.tackles), interceptions:num(b.interceptions), duels_won:num(b.duels_won), shots:num(b.shots),
    saves:b.saves!=null?num(b.saves):null, goals_conceded:b.goals_conceded!=null?num(b.goals_conceded):null,
    duels_total:b.duels_total!=null?num(b.duels_total):null, shots_on:b.shots_on!=null?num(b.shots_on):null,
    tackle_blocks:b.tackle_blocks!=null?num(b.tackle_blocks):null, dribbled_past:b.dribbled_past!=null?num(b.dribbled_past):null,
    yellow_cards:b.yellow_cards!=null?num(b.yellow_cards):null, red_cards:b.red_cards!=null?num(b.red_cards):null,
    fouls_committed:b.fouls_committed!=null?num(b.fouls_committed):null, fouls_drawn:b.fouls_drawn!=null?num(b.fouls_drawn):null,
    penalty_won:b.penalty_won!=null?num(b.penalty_won):null, penalty_scored:b.penalty_scored!=null?num(b.penalty_scored):null,
    penalty_missed:b.penalty_missed!=null?num(b.penalty_missed):null, penalty_conceded:b.penalty_conceded!=null?num(b.penalty_conceded):null,
    // Friendlies: near-full availability (0.9×), zero output weight.
    avail_minutes:num(b.minutes)+0.9*fMin,
    avail_apps:num(b.appearances)+0.9*fApps,
    avail_starts:num(b.starts)+0.9*fStarts,
  };
}
function buildOverlayLine(player, s) {
  const o=s.overlay||{};
  const oMin=num(o.minutes);
  // NOTE: deliberately NOT spreading advancedFields(player) here. xg/xa/
  // shot_accuracy/ground_duel_win_pct/etc. come exclusively from
  // enrichStatsAPI.mjs, whose COMPETITIONS list is domestic leagues only —
  // no continental cups, no national-team competitions. Applying that
  // season-total figure to the overlay (continental/NT) line stamps a
  // player's real UCL/international form with shot data that was never
  // collected for it. Real case: Lewandowski's overlay (UCL, 4 goals in 623
  // minutes) inherited xg:3.5 that's actually his LaLiga-only reading,
  // dragging goalScore's xgPts term (28% weight) down for a competition it
  // has zero relationship to. buildBaseLine still carries these fields —
  // imperfect there too if a player's base blends league + domestic cup
  // minutes together, but league minutes dominate base for most players, so
  // it's a much closer match than applying league-only data to continental
  // form. The overlay scoring formula already has a no-xg fallback path
  // (rate + volume only) for exactly this situation.
  return { ...carryMeta(player),
    _strengthOverride:num(o.strength)||0.95,
    _volTarget:clamp(34*(oMin/3400),6,34),
    api_average_rating:num(o.api_average_rating)||num(player.api_average_rating),
    minutes:oMin, stats_minutes:num(o.stats_minutes)||oMin,
    appearances:num(o.appearances), starts:num(o.starts),
    goals:num(o.goals), assists:num(o.assists),
    passes:num(o.passes), pass_accuracy:num(o.pass_accuracy),
    key_passes:num(o.key_passes), dribbles_success:num(o.dribbles_success), dribbles:num(o.dribbles),
    tackles:num(o.tackles), interceptions:num(o.interceptions), duels_won:num(o.duels_won), shots:num(o.shots),
    saves:o.saves!=null?num(o.saves):null, goals_conceded:o.goals_conceded!=null?num(o.goals_conceded):null,
    duels_total:o.duels_total!=null?num(o.duels_total):null, shots_on:o.shots_on!=null?num(o.shots_on):null,
    tackle_blocks:o.tackle_blocks!=null?num(o.tackle_blocks):null, dribbled_past:o.dribbled_past!=null?num(o.dribbled_past):null,
    yellow_cards:o.yellow_cards!=null?num(o.yellow_cards):null, red_cards:o.red_cards!=null?num(o.red_cards):null,
    fouls_committed:o.fouls_committed!=null?num(o.fouls_committed):null, fouls_drawn:o.fouls_drawn!=null?num(o.fouls_drawn):null,
    penalty_won:o.penalty_won!=null?num(o.penalty_won):null, penalty_scored:o.penalty_scored!=null?num(o.penalty_scored):null,
    penalty_missed:o.penalty_missed!=null?num(o.penalty_missed):null, penalty_conceded:o.penalty_conceded!=null?num(o.penalty_conceded):null,
  };
}

export function calibreRating(player = {}) {
  const splits = player.competition_splits;
  if (!hasUsableSplits(splits)) return scoreLine(player);   // v7 path, unchanged

  const baseLine = buildBaseLine(player, splits);
  const overlay = splits.overlay || {};
  const overlayMin = num(overlay.minutes);

  const baseHasWork = num(baseLine.minutes)>0 || num(baseLine.appearances)>0 || num(baseLine.avail_minutes)>0;
  if (!baseHasWork && overlayMin>0) {                       // only continental/NT on record
    const only = scoreLine(buildOverlayLine(player, splits));
    return { ...only, blend:{ base:null, overlay:only.computed, overlayWeight:1 } };
  }

  const base = scoreLine(baseLine);
  if (overlayMin <= 0) {                                    // 100% base fallback
    return { ...base, blend:{ base:base.computed, overlay:null, overlayWeight:0 } };
  }
  const ov = scoreLine(buildOverlayLine(player, splits));
  const overlayTrust = clamp(overlayMin/900, 0, 1);         // full weight ~10 matches
  const w = 0.30*overlayTrust;
  const blended = clamp(Math.round(base.computed*(1-w) + ov.computed*w), 1, 99);
  // Same base/overlay weighting applied to ability and availability so all
  // three numbers are internally consistent, not just the season score.
  const abilityBlended = clamp(Math.round(base.ability*(1-w) + ov.ability*w), 1, 99);
  const availabilityBlended = clamp(Math.round(base.availability*(1-w) + ov.availability*w), 0, 100);
  return { ...base, rating:blended, computed:blended, ability:abilityBlended, availability:availabilityBlended,
    blend:{ base:base.computed, overlay:ov.computed, overlayWeight:Number(w.toFixed(3)), overlayStrength:num(overlay.strength)||0.95, overlayMinutes:overlayMin } };
}
// ── Canonical accessor ──
// Single source of truth for DISPLAYING a rating. Prefers the stored
// players.rating written once by scripts/computeRatings.mjs, so every surface
// shows the SAME number. Falls back to a live compute only when no stored
// rating exists yet (new prospects, unenriched rows). calibreRating itself is
// untouched — it stays the pure compute the batch script uses.
export function resolveRating(player = {}) {
  const stored = Number(player && player.rating);
  const storedAbility = Number(player && player.ability_rating);
  const storedAvailability = Number(player && player.availability_score);
  const full = calibreRating(player);
  const abilityOut = Number.isFinite(storedAbility) && storedAbility > 0 ? storedAbility : full.ability;
  const availabilityOut = Number.isFinite(storedAvailability) && storedAvailability >= 0 ? storedAvailability : full.availability;
  if (Number.isFinite(stored) && stored > 0) {
    return { ...full, rating: stored, computed: stored, ability: abilityOut, availability: availabilityOut, provisional: false, source: 'stored' };
  }
  return { ...full, ability: abilityOut, availability: availabilityOut, source: 'computed' };
}

export default calibreRating;
