// Calibre Rating Engine v7 — production-led, event-stat aware, league-honest.
//
// v7 change vs v6: league strength now carries through the WHOLE rating instead
// of being halved and applied to only ~50% of the weighted score. A genuinely
// dominant season in a developmental league (e.g. Brasileirão, NPFL) can no
// longer reach the same 85-90 band as the same profile in La Liga or the
// Premier League. The intent: 88 should mean "elite, in an elite league," not
// "great stats, somewhere." The additive floor was also lowered and the slope
// steepened so mid-tier and developmental players spread into the 60s-70s
// instead of bunching in the high 80s.
const WEIGHTS = { Performance: 0.35, Consistency: 0.20, Form: 0.20, Impact: 0.15, Trajectory: 0.10 };
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function num(v, d = 0) { const n = Number(v); return Number.isFinite(n) ? n : d; }
function per(value, mins) { return mins > 0 ? num(value) / (mins / 90) : 0; }
const LEAGUE_ID_STRENGTH = { 39:1.00,140:1.00,78:0.98,135:0.96,61:0.92,94:0.84,88:0.83,71:0.82,144:0.80,40:0.81,203:0.73,128:0.80,13:0.74,307:0.63,253:0.80,98:0.72,281:0.66,12:0.66,399:0.55,525:0.94,44:0.92,254:0.90,142:0.90,82:0.90,64:0.88,139:0.86,949:0.74 };
const LEAGUE_STRENGTH = { 'la liga':1.00,'premier league':1.00,'bundesliga':0.98,'serie a':0.96,'ligue 1':0.92,'primeira liga':0.84,'eredivisie':0.83,'championship':0.81,'pro league':0.80,'super lig':0.73,'saudi pro league':0.63,'brasileiro':0.82,'brasileirão':0.82,'mls':0.80,'j1 league':0.72,'npfl':0.55,'zimbabwe psl':0.50 };
const DEFAULT_LEAGUE = 0.70;
function leagueStrength(player) {
  const id = num(player.league_id ?? player.leagueId);
  if (id && LEAGUE_ID_STRENGTH[id] != null) return LEAGUE_ID_STRENGTH[id];
  const key = String(player.league ?? player.league_name ?? '').trim().toLowerCase();
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
  const ratePts=clamp(g90/0.92*100,0,140), volPts=clamp(num(player.goals)/34*100,0,140);
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
export function calibreRating(player = {}) {
  const minutes=num(player.minutes ?? player.mins);
  let apps=num(player.appearances ?? player.apps), starts=num(player.starts);
  const apiR=num(player.api_average_rating ?? player.apiAverageRating ?? player.apiRating);
  const age=num(player.age,0);
  const bucket=positionBucket(player);
  const sRaw=leagueStrength(player);              // raw league strength 0.50–1.00
  const hasEvidence = minutes>0 || apps>0 || apiR>0;
  if (!hasEvidence) return { rating:null, computed:null, breakdown:null, bucket, confidence:'none', provisional:true };
  if (apps<=0 && minutes>0) { apps=minutes/85; starts=apps*0.9; }
  const q=qFlat(apiR);
  let production, ev;
  if (bucket==='GK') {
    const acc=num(player.pass_accuracy);
    const buildNudge=acc>0?clamp((acc-70)/25*12,0,12):0;
    production=clamp(q*0.9+buildNudge,0,100); ev=false;
  } else {
    const c=productionComponents(player,bucket);
    production=clamp(spine(c.vals,c.w),0,116); ev=c.ev;
  }
  const core=clamp(production*0.76+q*0.24,0,108);

  // ── League now carries through the headline components ──────────────
  // Performance & Impact take full league strength; Form takes a softened
  // share (so raw output still matters, but not league-blind). Consistency &
  // Trajectory stay league-neutral — they measure availability and age, which
  // are league-independent. This keeps the breakdown radar coherent with the
  // headline number instead of showing a league-blind 90 next to a 74 rating.
  const lgFormFactor = sRaw;                       // Form now also carries full league strength
  const Performance=clamp(core*sRaw,0,100);
  const startRate=apps>0?starts/apps:0.7, minsPerApp=apps>0?minutes/apps:0;
  const Consistency=clamp(clamp(startRate*100,0,100)*0.40+clamp((minsPerApp/90)*100,0,100)*0.30+clamp((minutes/3800)*100,0,100)*0.30,0,100);
  const Form=clamp(core*lgFormFactor,0,100);
  const avail=clamp(0.88+(minutes/3600)*0.12,0.88,1.0);
  const Impact=clamp(core*sRaw*avail,0,100);
  const youth=clamp((24-age)/(24-17),0,1);
  const Trajectory=age>0?clamp(50+youth*30+(core-60)*0.10,0,100):58;
  const breakdown={ Performance:Math.round(Performance),Consistency:Math.round(Consistency),Form:Math.round(Form),Impact:Math.round(Impact),Trajectory:Math.round(Trajectory) };
  const weighted=Performance*WEIGHTS.Performance+Consistency*WEIGHTS.Consistency+Form*WEIGHTS.Form+Impact*WEIGHTS.Impact+Trajectory*WEIGHTS.Trajectory;

  // Lower floor + steeper slope: developmental players spread into the 60s-70s.
  let raw=27+weighted*0.72;
  if (raw>88) raw=88+(raw-88)*0.42;               // gentle compression at the very top
  // Small final league trim above a floor — leaves elite leagues (sRaw 1.0)
  // untouched, gives weaker leagues one more honest nudge down.
  const TRIM_FLOOR=34;
  raw=TRIM_FLOOR+(raw-TRIM_FLOOR)*(0.72+0.28*sRaw);
  const computed=clamp(Math.round(raw),1,99);
  const confidence=ev&&apiR>0?'high':minutes>0||apps>0?'medium':'low';
  return { rating:computed, computed, breakdown, bucket, production:Math.round(production), core:Math.round(core), leagueStrength:sRaw, confidence, provisional:!ev&&bucket!=='GK' };
}
export default calibreRating;
