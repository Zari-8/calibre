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
const WEIGHTS = { Performance: 0.35, Consistency: 0.20, Form: 0.20, Impact: 0.15, Trajectory: 0.10 };
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function num(v, d = 0) { const n = Number(v); return Number.isFinite(n) ? n : d; }
function per(value, mins) { return mins > 0 ? num(value) / (mins / 90) : 0; }

// ── TheStatsAPI event-stat helpers (v8.1) ────────────────────────────────
// These fire only when the new columns are populated (non-null). When absent
// the engine falls back to the v8 path unchanged — no rating breakage.

// Shot quality nudge: rewards on-target efficiency, penalises big-chance waste.
// Returns a small signed adjustment [-6, +6] to the production score.
function shotQualityNudge(player) {
  const acc = num(player.shot_accuracy, -1);
  const missed = num(player.big_chances_missed, -1);
  if (acc < 0 && missed < 0) return 0;        // no new data
  let nudge = 0;
  if (acc >= 0) nudge += clamp((acc - 33) / 33 * 4, -4, 4);  // 33% SOT = neutral
  if (missed >= 0) nudge -= clamp(missed / 5 * 3, 0, 3);      // each 5 missed = -3
  return clamp(nudge, -6, 6);
}

// Chance creation boost: big_chances_created per 90 is a strong creativity signal.
// Returns a bonus [0, 10] added to the create component.
function chanceCreationBoost(player, sm) {
  const bcc = num(player.big_chances_created, -1);
  if (bcc < 0) return 0;
  const bcc90 = per(bcc, sm);
  return clamp(bcc90 / 0.5 * 10, 0, 10);     // 0.5 BCC/90 = full +10
}

// Duel quality: replaces raw count-based win rate when % data is available.
// Returns [0, 100] component score, same scale as the existing duel calc.
function duelQualityScore(player, du90) {
  const gd = num(player.ground_duel_win_pct, -1);
  const ad = num(player.aerial_duel_win_pct, -1);
  if (gd < 0 && ad < 0) return null;          // fall back to count-based
  const gdScore = gd >= 0 ? clamp((gd - 30) / 40 * 80, 0, 80) : 40;
  const adScore = ad >= 0 ? clamp((ad - 25) / 40 * 60, 0, 60) : 30;
  const pctScore = gdScore * 0.6 + adScore * 0.4;
  // Blend with volume (du90) so a player who wins 80% of 1 duel/90 isn't overrated
  const volScore = clamp(du90 / 5.2 * 100, 0, 100);
  return clamp(pctScore * 0.60 + volScore * 0.40, 0, 110);
}

// Territorial index: opp_half_passes share → forward aggression score [0, 100].
// Used in DEF builds: a centre-back who rarely crosses halfway reads differently.
function territorialIndex(player) {
  const opp = num(player.opp_half_passes, -1);
  const own = num(player.own_half_passes, -1);
  if (opp < 0 || own < 0 || opp + own === 0) return null;
  const share = opp / (opp + own);            // 0 = never attacks, 1 = always
  return clamp(share * 100, 0, 100);
}

// Dribble quality: uses success % when available, else falls back to raw dr90.
function dribbleScore(player, sm) {
  const pct = num(player.dribble_success_pct, -1);
  const cnt = num(player.successful_dribbles ?? player.dribbles_success, -1);
  if (pct < 0) {
    const dr90 = per(player.dribbles_success ?? player.dribbles, sm);
    return { dr90, bonus: 0 };
  }
  const dr90 = cnt >= 0 ? per(cnt, sm) : per(player.dribbles_success ?? player.dribbles, sm);
  // Quality bonus: high success rate above 55% average earns up to +8
  const bonus = clamp((pct - 55) / 25 * 8, -4, 8);
  return { dr90, bonus };
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
function positionBucket(player) {
  const text = `${player.role||''} ${player.position||''} ${player.archetype||''} ${player.pos||''} ${player.primary_role||''}`.toLowerCase();
  if (/(goalkeeper|keeper|\bgk\b)/.test(text)) return 'GK';
  if (/(defender|centre.?back|center.?back|full.?back|wing.?back|\bcb\b|\brb\b|\blb\b|\bdef\b)/.test(text)) return 'DEF';
  if (/(striker|forward|winger|wide creator|wide forward|attack|poacher|fox|\bst\b|\brw\b|\blw\b|\bcf\b|\bfwd\b|\batt\b)/.test(text)) return 'ATT';
  return 'MID';
}
function qFlat(apiR) { return apiR > 0 ? clamp(42 + (apiR - 6.9) * 25, 0, 100) : 46; }
function spine(vals, w) { const s = [...vals].sort((a,b)=>b-a); let p=0; s.forEach((v,i)=>{p+=v*(w[i]??0);}); return p; }
function productionComponents(player, bucket) {
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

  const g90 = per(player.goals, m);
  const a90 = per(player.assists, m);

  const xg = num(player.xg ?? player.expected_goals, -1);
  const xa = num(player.xa ?? player.expected_assists, -1);
  const npxg = num(player.npxg ?? player.np_expected_goals, -1);

  const xg90 = xg >= 0 ? per(xg, sm) : null;
  const xa90 = xa >= 0 ? per(xa, sm) : null;
  const npxg90 = npxg >= 0 ? per(npxg, sm) : null;

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

  const shotQuality = num(player.shot_quality, -1);
  const shotQualityBonus = shotQuality >= 0
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
    const carry = clamp(dr90 / 2.1 * 40 + dribBonus + sh90 / 4.0 * 28, 0, 95);
    return { vals: [goalScore, create, carry], w: [0.76, 0.16, 0.08], ev };
  }

  if (bucket === 'DEF') {
    const rawDuel = clamp(tk90 / 2.1 * 40 + in90 / 1.7 * 38 + du90 / 5.2 * 40 + clear90 / 4.5 * 16, 0, 118);
    const defend = duelScore !== null ? clamp(duelScore * 1.05 + clear90 / 4.5 * 12, 0, 118) : rawDuel;
    const build = ev
      ? clamp((acc - 76) / (93 - 76) * 52 + pass90 / 78 * 48 + touchBonus + (terr != null ? (terr - 40) * 0.15 : 0), 0, 112)
      : 56;
    const prog = clamp(key90 / 1.0 * 42 + dr90 / 0.9 * 28 + dribBonus, 0, 88);
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
    bccBoost,
    0,
    120
  );

  const goal = clamp(g90 / 0.42 * 70 + (xg90 != null ? xg90 / 0.32 * 38 : 0) + sqNudge + shotQualityBonus, 0, 122);
  const carry = clamp(dr90 / 1.5 * 64 + dribBonus - lossPenalty * 0.5, 0, 104);
  const duelRaw = clamp(tk90 / 2.1 * 48 + in90 / 1.4 * 42 + clear90 / 3.0 * 8, 0, 104);
  const defend = duelScore !== null ? clamp(duelScore * 0.86 + tk90 / 2.1 * 10 + in90 / 1.4 * 10, 0, 104) : duelRaw;

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
  const hasEvidence = minutes>0 || baseApps>0 || apiR>0;
  if (!hasEvidence) return { rating:null, computed:null, breakdown:null, bucket, confidence:'none', provisional:true };

  let availMin=num(line.avail_minutes, NaN); if (!Number.isFinite(availMin)) availMin=minutes;
  let appsA=num(line.avail_apps, NaN); if (!Number.isFinite(appsA)) appsA=baseApps;
  let startsA=num(line.avail_starts, NaN); if (!Number.isFinite(startsA)) startsA=num(line.starts);
  if (appsA<=0 && availMin>0) { appsA=availMin/85; startsA=appsA*0.9; }

  const q=qFlat(apiR);
  let production, ev;
  if (bucket==='GK') {
    const acc=num(line.pass_accuracy);
    const buildNudge=acc>0?clamp((acc-70)/25*12,0,12):0;
    production=clamp(q*0.9+buildNudge,0,100); ev=false;
  } else {
    const c=productionComponents(line,bucket);
    production=clamp(spine(c.vals,c.w),0,116); ev=c.ev;
  }
  const core=clamp(production*0.76+q*0.24,0,108);

  const Performance=clamp(core*sRaw,0,100);
  const startRate=appsA>0?startsA/appsA:0.7, minsPerApp=appsA>0?availMin/appsA:0;
  const Consistency=clamp(clamp(startRate*100,0,100)*0.40+clamp((minsPerApp/90)*100,0,100)*0.30+clamp((availMin/3800)*100,0,100)*0.30,0,100);
  const Form=clamp(core*sRaw,0,100);
  const avail=clamp(0.88+(availMin/3600)*0.12,0.88,1.0);
  const Impact=clamp(core*sRaw*avail,0,100);
  const youth=clamp((24-age)/(24-17),0,1);
  const Trajectory=age>0?clamp(50+youth*30+(core-60)*0.10,0,100):58;
  const breakdown={ Performance:Math.round(Performance),Consistency:Math.round(Consistency),Form:Math.round(Form),Impact:Math.round(Impact),Trajectory:Math.round(Trajectory) };
  const weighted=Performance*WEIGHTS.Performance+Consistency*WEIGHTS.Consistency+Form*WEIGHTS.Form+Impact*WEIGHTS.Impact+Trajectory*WEIGHTS.Trajectory;
  let raw=27+weighted*0.72;
  if (raw>88) raw=88+(raw-88)*0.42;
  const TRIM_FLOOR=34;
  raw=TRIM_FLOOR+(raw-TRIM_FLOOR)*(0.72+0.28*sRaw);
  const computed=clamp(Math.round(raw),1,99);
  const confidence=ev&&apiR>0?'high':minutes>0||appsA>0?'medium':'low';
  return { rating:computed, computed, breakdown, bucket, production:Math.round(production), core:Math.round(core), leagueStrength:sRaw, confidence, provisional:!ev&&bucket!=='GK' };
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
function buildBaseLine(player, s) {
  const b=s.base||{}, f=s.friendly||{};
  const fMin=num(f.minutes), fApps=num(f.appearances), fStarts=num(f.starts);
  return { ...carryMeta(player),
    league_id:num(b.league_id)||num(player.league_id), league:player.league, league_name:player.league_name,
    api_average_rating:num(b.api_average_rating)||num(player.api_average_rating),
    minutes:num(b.minutes), stats_minutes:num(b.stats_minutes)||num(b.minutes),
    appearances:num(b.appearances), starts:num(b.starts),
    goals:num(b.goals), assists:num(b.assists),
    passes:num(b.passes), pass_accuracy:num(b.pass_accuracy),
    key_passes:num(b.key_passes), dribbles_success:num(b.dribbles_success), dribbles:num(b.dribbles),
    tackles:num(b.tackles), interceptions:num(b.interceptions), duels_won:num(b.duels_won), shots:num(b.shots),
    // Friendlies: near-full availability (0.9×), zero output weight.
    avail_minutes:num(b.minutes)+0.9*fMin,
    avail_apps:num(b.appearances)+0.9*fApps,
    avail_starts:num(b.starts)+0.9*fStarts,
  };
}
function buildOverlayLine(player, s) {
  const o=s.overlay||{};
  const oMin=num(o.minutes);
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
  return { ...base, rating:blended, computed:blended,
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
  const full = calibreRating(player);
  if (Number.isFinite(stored) && stored > 0) {
    return { ...full, rating: stored, computed: stored, provisional: false, source: 'stored' };
  }
  return { ...full, source: 'computed' };
}

export default calibreRating;
