// Calibre Rating Engine v6 — production-led, event-stat aware, API demoted.
const WEIGHTS = { Performance: 0.35, Consistency: 0.18, Form: 0.20, Impact: 0.17, Trajectory: 0.10 };
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function num(v, d = 0) { const n = Number(v); return Number.isFinite(n) ? n : d; }
function per(value, mins) { return mins > 0 ? num(value) / (mins / 90) : 0; }
const LEAGUE_ID_STRENGTH = { 39:1.00,140:1.00,78:0.98,135:0.96,61:0.93,94:0.86,88:0.85,71:0.84,144:0.82,197:0.80,253:0.74,98:0.74,307:0.80,40:0.82 };
const LEAGUE_STRENGTH = { 'la liga':1.00,'premier league':1.00,'bundesliga':0.98,'serie a':0.96,'ligue 1':0.92,'primeira liga':0.86,'eredivisie':0.85,'championship':0.82,'pro league':0.82,'super lig':0.80,'saudi pro league':0.80,'brasileiro':0.84,'mls':0.74,'j1 league':0.74,'npfl':0.62,'zimbabwe psl':0.55 };
const DEFAULT_LEAGUE = 0.75;
function leagueStrength(player) {
  const id = num(player.league_id ?? player.leagueId);
  if (id && LEAGUE_ID_STRENGTH[id] != null) return LEAGUE_ID_STRENGTH[id];
  const key = String(player.league ?? player.league_name ?? '').trim().toLowerCase();
  if (key) { if (LEAGUE_STRENGTH[key] != null) return LEAGUE_STRENGTH[key];
    for (const name in LEAGUE_STRENGTH) if (key.includes(name)) return LEAGUE_STRENGTH[name]; }
  return DEFAULT_LEAGUE;
}
function effectiveLeague(s) { return 1 - (1 - s) * 0.50; }
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
    const defend=clamp(tk90/1.9*42+in90/1.5*40+du90/4.6*42,0,122);
    const build=ev?clamp((acc-74)/(93-74)*58+pass90/66*52,0,116):60;
    const prog=clamp(key90/0.8*45+dr90/0.6*30,0,100);
    const att=clamp(g90/0.14*55+a90/0.18*45,0,90);
    return { vals:[defend,build,prog,att], w:[0.66,0.20,0.09,0.05], ev };
  }
  const progress=ev?clamp(pass90/64*64+(acc-74)/(93-74)*58,0,128):clamp(48+a90/0.35*25,0,86);
  const create=clamp(key90/1.7*58+a90/0.40*55,0,122);
  const goal=clamp(g90/0.42*85,0,120);
  const carry=clamp(dr90/1.3*68,0,108);
  const defend=clamp(tk90/2.1*48+in90/1.4*42,0,100);
  return { vals:[progress,create,goal,carry,defend], w:[0.62,0.23,0.09,0.04,0.02], ev };
}
export function calibreRating(player = {}) {
  const minutes=num(player.minutes ?? player.mins);
  let apps=num(player.appearances ?? player.apps), starts=num(player.starts);
  const apiR=num(player.api_average_rating ?? player.apiAverageRating ?? player.apiRating);
  const age=num(player.age,0);
  const bucket=positionBucket(player);
  const lg=effectiveLeague(leagueStrength(player));
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
  const core=clamp(production*0.74+q*0.26,0,108);
  const Performance=clamp(core*lg,0,100);
  const startRate=apps>0?starts/apps:0.7, minsPerApp=apps>0?minutes/apps:0;
  const Consistency=clamp(clamp(startRate*100,0,100)*0.40+clamp((minsPerApp/90)*100,0,100)*0.30+clamp((minutes/3800)*100,0,100)*0.30,0,100);
  const Form=clamp(core,0,100);
  const avail=clamp(0.88+(minutes/3600)*0.12,0.88,1.0);
  const Impact=clamp(core*lg*avail,0,100);
  const youth=clamp((24-age)/(24-17),0,1);
  const Trajectory=age>0?clamp(50+youth*34+(core-60)*0.10,0,100):58;
  const breakdown={ Performance:Math.round(Performance),Consistency:Math.round(Consistency),Form:Math.round(Form),Impact:Math.round(Impact),Trajectory:Math.round(Trajectory) };
  const weighted=Performance*WEIGHTS.Performance+Consistency*WEIGHTS.Consistency+Form*WEIGHTS.Form+Impact*WEIGHTS.Impact+Trajectory*WEIGHTS.Trajectory;
  let raw=38+weighted*0.585; if (raw>90) raw=90+(raw-90)*0.7;
  const computed=clamp(Math.round(raw),1,99);
  const confidence=ev&&apiR>0?'high':minutes>0||apps>0?'medium':'low';
  return { rating:computed, computed, breakdown, bucket, production:Math.round(production), core:Math.round(core), confidence, provisional:!ev&&bucket!=='GK' };
}
export default calibreRating;
