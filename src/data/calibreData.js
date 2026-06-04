export const navItems = [
  { label: 'Home', href: '/' },
  { label: 'Debates', href: '/debates' },
  { label: 'Players', href: '/players' },
  { label: 'Competitions', href: '/competitions' },
  { label: 'Talents', href: '/talents' },
  { label: 'System Fit', href: '/system-fit' },
];

export const ratingFormula = [
  { label: 'Performance', value: 35, detail: 'Raw output vs positional average' },
  { label: 'Consistency', value: 20, detail: 'Reliability: can I count on him?' },
  { label: 'Form', value: 20, detail: 'Last five games, hot or cold right now' },
  { label: 'Impact', value: 15, detail: 'Big moments, clutch games, comeback goals' },
  { label: 'Trajectory', value: 10, detail: 'Rate of improvement and growth arrow' },
];

export const leagueMultipliers = [
  { league: 'La Liga', multiplier: 1.00, tone: 'elite benchmark' },
  { league: 'Bundesliga', multiplier: 0.98, tone: 'elite pace + transition' },
  { league: 'Championship', multiplier: 0.82, tone: 'high-volume senior minutes' },
  { league: 'NPFL', multiplier: 0.62, tone: 'raw talent signal' },
  { league: 'Zimbabwe PSL', multiplier: 0.55, tone: 'context-heavy discovery' },
];

export const players = [
  {
    name: 'Pedri', team: 'FC Barcelona', role: 'Controller', archetype: 'Puppeteer', rating: 91,
    localImage: '/assets/players/pedri.jpg', apiImage: '', region: 'Spain', league: 'La Liga', trajectory: '+4.1', debateIndex: 94,
    breakdown: { Performance: 88, Consistency: 94, Form: 89, Impact: 83, Trajectory: 91 },
  },
  {
    name: 'Jude Bellingham', team: 'Real Madrid', role: 'Impact 8', archetype: 'Box Crasher', rating: 92,
    localImage: '/assets/players/jude-bellingham.jpg', apiImage: '', region: 'England', league: 'La Liga', trajectory: '+3.6', debateIndex: 96,
    breakdown: { Performance: 91, Consistency: 88, Form: 90, Impact: 96, Trajectory: 89 },
  },
  {
    name: 'Lamine Yamal', team: 'FC Barcelona', role: 'Wide Creator', archetype: 'Paintbrush', rating: 88,
    localImage: '/assets/players/lamine-yamal.jpg', apiImage: '', region: 'Spain', league: 'La Liga', trajectory: '+9.7', debateIndex: 98,
    breakdown: { Performance: 85, Consistency: 82, Form: 91, Impact: 87, Trajectory: 99 },
  },
  {
    name: 'Florian Wirtz', team: 'Germany', role: 'Advanced Playmaker', archetype: 'Magic Wand', rating: 90,
    localImage: '/assets/players/florian-wirtz.jpg', apiImage: '', region: 'Germany', league: 'Bundesliga', trajectory: '+5.8', debateIndex: 91,
    breakdown: { Performance: 89, Consistency: 86, Form: 92, Impact: 88, Trajectory: 94 },
  },
  {
    name: 'Kylian Mbappé', team: 'France', role: 'Pure Striker', archetype: 'Fox', rating: 94,
    localImage: '/assets/players/kylian-mbappe.jpg', apiImage: '', region: 'France', league: 'La Liga', trajectory: '+1.6', debateIndex: 93,
    breakdown: { Performance: 96, Consistency: 90, Form: 92, Impact: 98, Trajectory: 82 },
  },
  {
    name: 'Vinícius Júnior', team: 'Brazil', role: 'Inside Forward', archetype: 'Dagger', rating: 93,
    localImage: '/assets/players/vinicius-junior.jpg', apiImage: '', region: 'Brazil', league: 'La Liga', trajectory: '+2.9', debateIndex: 97,
    breakdown: { Performance: 92, Consistency: 87, Form: 90, Impact: 97, Trajectory: 88 },
  },
];

export const rateBattles = [
  { title: 'Pedri vs Jude', question: 'Who owns the midfield?', votes: '428K', heat: 98, category: 'Control vs Impact' },
  { title: 'Vini vs Mbappé', question: 'Chaos or goal threat?', votes: '391K', heat: 95, category: 'Final-third profile' },
  { title: 'Rice vs Vitinha', question: 'Who dominates the final?', votes: '184K', heat: 88, category: 'Tempo war' },
];

export const competitions = [
  { name: 'La Liga', country: 'Spain', calibre: 92, topScorer: 'Mbappé', topCreator: 'Pedri', debate: 'Is control football back?' },
  { name: 'Premier League', country: 'England', calibre: 94, topScorer: 'Haaland', topCreator: 'Saka', debate: 'Best league or best branding?' },
  { name: 'NPFL', country: 'Nigeria', calibre: 62, topScorer: 'Emerging 9', topCreator: 'Wide Creator U21', debate: 'Who is Europe sleeping on?' },
  { name: 'Zimbabwe PSL', country: 'Zimbabwe', calibre: 55, topScorer: 'Target Man prospect', topCreator: 'Teen controller', debate: 'Which talent is ready to move?' },
];

export const talents = [
  { name: 'Ibrahim Musa', age: 19, league: 'NPFL', role: 'Wide Creator', rating: 77, readiness: 82, nextStep: 'Belgian Pro League watchlist', trend: '+12%' },
  { name: 'Tawanda Moyo', age: 18, league: 'Zimbabwe PSL', role: 'Controller', rating: 71, readiness: 66, nextStep: 'Stay and dominate current league first', trend: '+8%' },
  { name: 'Mateo Silva', age: 20, league: 'Uruguay Primera', role: 'Pressing Engine', rating: 80, readiness: 79, nextStep: 'Loan move recommended for senior minutes', trend: '+10%' },
  { name: 'Noah Adebayo', age: 17, league: 'Academy / U21', role: 'False Nine', rating: 74, readiness: 63, nextStep: 'Needs one more senior-minutes season', trend: '+15%' },
];

export const fitRadar = [
  { label: 'Press resistance', value: 91 },
  { label: 'Positional IQ', value: 88 },
  { label: 'Tempo control', value: 84 },
  { label: 'Final-third entry', value: 79 },
  { label: 'Defensive load', value: 72 },
];

// ── ASIAN + SAUDI TALENT POOL ─────────────────────────────────────
export const asianTalents = [
  // East Asia
  { name:'Takefusa Kubo',      age:23, nation:'Japan',       flag:'🇯🇵', league:'La Liga',          club:'Real Sociedad',   role:'Wide Creator',       rating:84, readiness:87, trend:'+6%',  region:'east',   nextStep:'Top-6 La Liga or Premier League move', trajectory:'rising' },
  { name:'Kaoru Mitoma',       age:27, nation:'Japan',       flag:'🇯🇵', league:'Premier League',   club:'Brighton',        role:'Inside Forward',     rating:83, readiness:86, trend:'+4%',  region:'east',   nextStep:'Established PL starter',               trajectory:'peak'   },
  { name:'Ao Tanaka',          age:26, nation:'Japan',       flag:'🇯🇵', league:'Bundesliga',       club:'Dortmund',        role:'Controller',         rating:80, readiness:82, trend:'+5%',  region:'east',   nextStep:'UCL regular starter',                  trajectory:'rising' },
  { name:'Hwang Hee-chan',     age:28, nation:'South Korea', flag:'🇰🇷', league:'Premier League',   club:'Wolves',          role:'Pressing Forward',   rating:79, readiness:80, trend:'+3%',  region:'east',   nextStep:'Mid-table PL or step up',               trajectory:'peak'   },
  { name:'Lee Kang-in',        age:23, nation:'South Korea', flag:'🇰🇷', league:'Ligue 1',          club:'PSG',             role:'Advanced Playmaker', rating:82, readiness:84, trend:'+7%',  region:'east',   nextStep:'More UCL minutes, potential move',      trajectory:'rising' },
  { name:'Gue-sung Cho',       age:26, nation:'South Korea', flag:'🇰🇷', league:'Bundesliga',       club:'Freiburg',        role:'Target Striker',     rating:76, readiness:78, trend:'+4%',  region:'east',   nextStep:'Bigger Bundesliga club',                trajectory:'rising' },
  { name:'Chanathip Songkrasin',age:30,nation:'Thailand',    flag:'🇹🇭', league:'J-League',         club:'Kawasaki',        role:'Creative Midfielder',rating:72, readiness:68, trend:'+2%',  region:'sea',    nextStep:'Final elite Asian years',               trajectory:'peak'   },
  { name:'Egy Maulana Vikri',  age:23, nation:'Indonesia',   flag:'🇮🇩', league:'Ekstraklasa',      club:'Lechia Gdańsk',   role:'Wide Creator',       rating:71, readiness:72, trend:'+8%',  region:'sea',    nextStep:'Mid-table Bundesliga or Serie B',        trajectory:'rising' },
  { name:'Nguyen Quang Hai',   age:27, nation:'Vietnam',     flag:'🇻🇳', league:'Ligue 2',          club:'Pau FC',          role:'Creative Midfielder',rating:70, readiness:69, trend:'+3%',  region:'sea',    nextStep:'Consistent Ligue 2 or step to Ligue 1', trajectory:'stable' },
  // Middle East / Saudi Pro League
  { name:'Salem Al-Dawsari',   age:32, nation:'Saudi Arabia',flag:'🇸🇦', league:'Saudi Pro League', club:'Al-Hilal',        role:'Wide Forward',       rating:78, readiness:72, trend:'+1%',  region:'saudi',  nextStep:'Veteran leadership role',               trajectory:'peak'   },
  { name:'Mohammed Al-Qasim',  age:21, nation:'Saudi Arabia',flag:'🇸🇦', league:'Saudi Pro League', club:'Al-Nassr',        role:'Controller',         rating:72, readiness:74, trend:'+9%',  region:'saudi',  nextStep:'Move to European league recommended',   trajectory:'rising' },
  { name:'Sami Al-Najei',      age:19, nation:'Saudi Arabia',flag:'🇸🇦', league:'Saudi Pro League', club:'Al-Ittihad',      role:'Pressing Engine',    rating:70, readiness:68, trend:'+11%', region:'saudi',  nextStep:'Loan to mid-table European club',       trajectory:'rising' },
  { name:'Yasser Al-Shahrani', age:30, nation:'Saudi Arabia',flag:'🇸🇦', league:'Saudi Pro League', club:'Al-Hilal',        role:'Attacking Fullback', rating:75, readiness:74, trend:'+2%',  region:'saudi',  nextStep:'Established Saudi starter',             trajectory:'stable' },
  { name:'Nasser Al-Dawsari',  age:24, nation:'Saudi Arabia',flag:'🇸🇦', league:'Saudi Pro League', club:'Al-Qadsiah',      role:'Box-to-Box',         rating:73, readiness:75, trend:'+7%',  region:'saudi',  nextStep:'Top Saudi club or European trial',      trajectory:'rising' },
  { name:'Akram Afif',         age:27, nation:'Qatar',       flag:'🇶🇦', league:'Qatar Stars League',club:'Al-Sadd',        role:'Wide Creator',       rating:77, readiness:76, trend:'+3%',  region:'saudi',  nextStep:'European move still viable',            trajectory:'stable' },
];

export const TALENT_REGIONS = [
  { key: 'all',    label: 'All Regions'           },
  { key: 'africa', label: 'West & Southern Africa' },
  { key: 'south_america', label: 'South America'  },
  { key: 'europe', label: 'Eastern Europe'        },
  { key: 'east',   label: 'East Asia'             },
  { key: 'sea',    label: 'Southeast Asia'        },
  { key: 'saudi',  label: 'Saudi & Gulf'          },
  { key: 'north_america', label: 'North America' },
  { key: 'academy',label: 'Academy / U21'         },
];
