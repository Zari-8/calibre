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
  const ev = sm > 0 && num(player.passes) > 0;
  const g90=per(player.goals,m), a90=per(player.assists,m);
  const pass90=per(player.passes,sm), acc=num(player.pass_accuracy);
  const key90=per(player.key_passes,sm), dr90=per(player.dribbles_success ?? player.dribbles,sm);
  const tk90=per(player.tackles,sm), in90=per(player.interceptions,sm), du90=per(player.duels_won,sm), sh90=per(player.shots,sm);
  // Volume target defaults to a full top-flight season (34). The overlay line
  // passes a smaller _volTarget scaled to its minutes, so a continental haul is
  // judged against what's achievable in that many games — not a full league
  // season it could never reach. The base never sets it, so the deliberate
  // "injured/partial season scores lower" property from v7 is preserved.
  const volTarget = num(player._volTarget, 34) || 34;
  const ratePts=clamp(g90/0.92*100,0,140), volPts=clamp(num(player.goals)/volTarget*100,0,140);
  const goalScore=ratePts*0.5+volPts*0.5;
  if (bucket==='ATT') {
    const create=clamp(a90/0.30*80+key90/2.5*30,0,116);
    const carry=clamp(dr90/2.1*40+sh90/4.0*28,0,92);
    return { vals:[goalScore,create,carry], w:[0.80,0.13,0.07], ev };
  }
  if (bucket==='DEF') {
    const defend=clamp(tk90/2.1*40+in90/1.7*38+du90/5.2*40,0,110);
    const build=ev?clamp((acc-76)/(93-76)*52+pass90/78*48,0,108):56;
    const prog=clamp(key90/1.0*42+dr90/0.9*28,0,88);
    const att=clamp(g90/0.14*55+a90/0.18*45,0,90);
    return { vals:[defend,build,prog,att], w:[0.66,0.20,0.09,0.05], ev };
  }
  const progress=ev?clamp(pass90/68*60+(acc-75)/(93-75)*56,0,124):clamp(48+a90/0.35*25,0,86);
  const create=clamp(key90/1.9*56+a90/0.46*52,0,116);
  const goal=clamp(g90/0.42*85,0,120);
  const carry=clamp(dr90/1.5*64,0,104);
  const defend=clamp(tk90/2.1*48+in90/1.4*42,0,100);
  return { vals:[progress,create,goal,carry,defend], w:[0.62,0.23,0.09,0.04,0.02], ev };
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
export default calibreRating;
