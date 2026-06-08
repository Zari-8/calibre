// ─────────────────────────────────────────────────────────────────────────
// Calibre · System Fit data + scoring
//
// Fit is NOT similarity. A team has a STYLE that prioritises certain traits and
// barely cares about others; a player is judged on whether he meets the demands
// his team prioritises, on the traits relevant to his POSITION. A controller
// scores high at a possession side and lower at a low block; a winger the
// reverse; a centre-back is judged on control + defensive load, not dribbling.
// That spread is the product — without it every player "fits" every club.
// ─────────────────────────────────────────────────────────────────────────

// Each club's trait vector is its DEMAND profile (what the system asks for),
// and `style` selects which traits matter most. Note the lows — a low block
// genuinely does not want high control; that variance is what discriminates.
export const SYSTEM_TEAMS = [
  { id: 50,  name: 'Manchester City',     short: 'Man City',    country: 'England',     league: 'Premier League',     formation: '4-3-3',   style: 'possession', philosophy: 'Territorial control',   intensity: 'High',      lineHeight: 'High',   crest: 'MC',  accent: '#6cabdd', secondary: '#1c2c5b', traits: { control: 96, transition: 70, pressing: 88, width: 84, tempo: 90, defensiveLoad: 60 } },
  { id: 529, name: 'FC Barcelona',        short: 'Barcelona',   country: 'Spain',       league: 'La Liga',            formation: '4-3-3',   style: 'possession', philosophy: 'Positional control',    intensity: 'High',      lineHeight: 'High',   crest: 'FCB', accent: '#a50044', secondary: '#ffd700', traits: { control: 94, transition: 68, pressing: 85, width: 86, tempo: 88, defensiveLoad: 58 } },
  { id: 85,  name: 'Paris Saint-Germain', short: 'PSG',         country: 'France',      league: 'Ligue 1',            formation: '4-3-3',   style: 'possession', philosophy: 'Fluid possession',      intensity: 'High',      lineHeight: 'High',   crest: 'PSG', accent: '#004170', secondary: '#e30613', traits: { control: 90, transition: 80, pressing: 84, width: 92, tempo: 88, defensiveLoad: 62 } },
  { id: 157, name: 'Bayern München',      short: 'Bayern',      country: 'Germany',     league: 'Bundesliga',         formation: '4-2-3-1', style: 'possession', philosophy: 'Front-foot overloads',  intensity: 'High',      lineHeight: 'High',   crest: 'FCB', accent: '#dc052d', secondary: '#fff',    traits: { control: 90, transition: 80, pressing: 88, width: 90, tempo: 90, defensiveLoad: 64 } },
  { id: 40,  name: 'Liverpool',           short: 'Liverpool',   country: 'England',     league: 'Premier League',     formation: '4-3-3',   style: 'gegenpress', philosophy: 'Transition pressure',   intensity: 'Very high', lineHeight: 'High',   crest: 'LFC', accent: '#c8102e', secondary: '#fff',    traits: { control: 80, transition: 92, pressing: 95, width: 82, tempo: 92, defensiveLoad: 80 } },
  { id: 42,  name: 'Arsenal',             short: 'Arsenal',     country: 'England',     league: 'Premier League',     formation: '4-3-3',   style: 'gegenpress', philosophy: 'Structured pressure',   intensity: 'High',      lineHeight: 'High',   crest: 'ARS', accent: '#ef0107', secondary: '#fff',    traits: { control: 86, transition: 84, pressing: 92, width: 84, tempo: 86, defensiveLoad: 82 } },
  { id: 499, name: 'Atalanta',            short: 'Atalanta',    country: 'Italy',       league: 'Serie A',            formation: '3-4-1-2', style: 'gegenpress', philosophy: 'Man-to-man chaos',      intensity: 'Very high', lineHeight: 'High',   crest: 'ATA', accent: '#1d70b8', secondary: '#000',    traits: { control: 74, transition: 90, pressing: 94, width: 86, tempo: 86, defensiveLoad: 82 } },
  { id: 541, name: 'Real Madrid',         short: 'Real Madrid', country: 'Spain',       league: 'La Liga',            formation: '4-3-1-2', style: 'direct',     philosophy: 'Vertical dominance',    intensity: 'High',      lineHeight: 'Medium', crest: 'RM',  accent: '#00529f', secondary: '#ffd700', traits: { control: 74, transition: 94, pressing: 74, width: 84, tempo: 90, defensiveLoad: 72 } },
  { id: 34,  name: 'Newcastle United',    short: 'Newcastle',   country: 'England',     league: 'Premier League',     formation: '4-3-3',   style: 'direct',     philosophy: 'Direct intensity',      intensity: 'Very high', lineHeight: 'Medium', crest: 'NEW', accent: '#241f20', secondary: '#fff',    traits: { control: 70, transition: 90, pressing: 86, width: 86, tempo: 86, defensiveLoad: 80 } },
  { id: 554, name: 'Club Brugge',         short: 'Club Brugge', country: 'Belgium',     league: 'Belgian Pro League', formation: '4-2-3-1', style: 'direct',     philosophy: 'Aggressive progression',intensity: 'High',      lineHeight: 'Medium', crest: 'CB',  accent: '#0071c8', secondary: '#000',    traits: { control: 72, transition: 86, pressing: 82, width: 84, tempo: 84, defensiveLoad: 76 } },
  { id: 505, name: 'Inter',               short: 'Inter',       country: 'Italy',       league: 'Serie A',            formation: '3-5-2',   style: 'counter',    philosophy: 'Automated rotations',   intensity: 'Medium',    lineHeight: 'Medium', crest: 'INT', accent: '#00529f', secondary: '#000',    traits: { control: 80, transition: 86, pressing: 74, width: 90, tempo: 80, defensiveLoad: 90 } },
  { id: 168, name: 'Bayer Leverkusen',    short: 'Leverkusen',  country: 'Germany',     league: 'Bundesliga',         formation: '3-4-2-1', style: 'counter',    philosophy: 'Patient counter',       intensity: 'Medium',    lineHeight: 'Medium', crest: 'B04', accent: '#e32219', secondary: '#000',    traits: { control: 78, transition: 90, pressing: 80, width: 86, tempo: 82, defensiveLoad: 84 } },
  { id: 530, name: 'Atlético Madrid',     short: 'Atlético',    country: 'Spain',       league: 'La Liga',            formation: '4-4-2',   style: 'lowblock',   philosophy: 'Compact low block',     intensity: 'Medium',    lineHeight: 'Low',    crest: 'ATM', accent: '#cb3524', secondary: '#272e61', traits: { control: 58, transition: 86, pressing: 76, width: 72, tempo: 64, defensiveLoad: 95 } },
  { id: 500, name: 'Bologna',             short: 'Bologna',     country: 'Italy',       league: 'Serie A',            formation: '4-2-3-1', style: 'lowblock',   philosophy: 'Mid-block discipline',  intensity: 'Medium',    lineHeight: 'Low',    crest: 'BOL', accent: '#1a2f48', secondary: '#9f1f33', traits: { control: 64, transition: 82, pressing: 78, width: 76, tempo: 70, defensiveLoad: 90 } },
  { id: 194, name: 'Ajax',                short: 'Ajax',        country: 'Netherlands', league: 'Eredivisie',         formation: '4-3-3',   style: 'balanced',   philosophy: 'Development possession',intensity: 'High',      lineHeight: 'High',   crest: 'AJX', accent: '#d2122e', secondary: '#fff',    traits: { control: 86, transition: 80, pressing: 86, width: 85, tempo: 84, defensiveLoad: 66 } },
  { id: 55,  name: 'Brentford',           short: 'Brentford',   country: 'England',     league: 'Premier League',     formation: '3-5-2',   style: 'balanced',   philosophy: 'Set-piece + duels',     intensity: 'Medium',    lineHeight: 'Low',    crest: 'BRE', accent: '#e30613', secondary: '#fbb800', traits: { control: 66, transition: 84, pressing: 80, width: 80, tempo: 76, defensiveLoad: 86 } },
];

export const SYSTEM_PLAYERS = [
  { id: 154, name: 'Jude Bellingham', team: 'Real Madrid', age: 22, position: 'CM / AM', archetype: 'Box Crasher', image: '/assets/players/jude-bellingham.jpg', rating: 92, traits: { control: 86, transition: 94, pressing: 88, width: 72, tempo: 91, defensiveLoad: 84 }, roleMetrics: { Positioning: 92, 'Decision making': 91, 'Link-up play': 87, 'Final-third impact': 94, 'Press resistance': 85, 'Transition contribution': 93 } },
  { id: 276, name: 'Pedri', team: 'FC Barcelona', age: 23, position: 'CM', archetype: 'Puppeteer', image: '/assets/players/pedri.jpg', rating: 91, traits: { control: 98, transition: 77, pressing: 84, width: 76, tempo: 94, defensiveLoad: 75 }, roleMetrics: { Positioning: 96, 'Decision making': 95, 'Link-up play': 94, 'Final-third impact': 82, 'Press resistance': 96, 'Transition contribution': 79 } },
  { id: 44, name: 'Rodri', team: 'Manchester City', age: 29, position: 'DM / CDM', archetype: 'Anchor', image: '/assets/players/rodri.jpg', rating: 90, traits: { control: 95, transition: 66, pressing: 84, width: 52, tempo: 88, defensiveLoad: 90 }, roleMetrics: { Positioning: 95, 'Decision making': 94, 'Link-up play': 91, 'Final-third impact': 72, 'Press resistance': 96, 'Transition contribution': 70 } },
  { id: 1100, name: 'Florian Wirtz', team: 'Bayern München', age: 23, position: 'AM', archetype: 'Magic Wand', image: '/assets/players/florian-wirtz.jpg', rating: 90, traits: { control: 91, transition: 90, pressing: 80, width: 82, tempo: 89, defensiveLoad: 67 }, roleMetrics: { Positioning: 89, 'Decision making': 91, 'Link-up play': 93, 'Final-third impact': 92, 'Press resistance': 88, 'Transition contribution': 87 } },
  { id: 874, name: 'Vitinha', team: 'Paris Saint-Germain', age: 26, position: 'CM', archetype: 'Controller', image: '/assets/players/vitinha.jpg', rating: 89, traits: { control: 95, transition: 78, pressing: 86, width: 74, tempo: 93, defensiveLoad: 81 }, roleMetrics: { Positioning: 94, 'Decision making': 93, 'Link-up play': 94, 'Final-third impact': 79, 'Press resistance': 94, 'Transition contribution': 80 } },
  { id: 762, name: 'Lamine Yamal', team: 'FC Barcelona', age: 18, position: 'RW', archetype: 'Paintbrush', image: '/assets/players/lamine-yamal.jpg', rating: 88, traits: { control: 88, transition: 96, pressing: 72, width: 98, tempo: 91, defensiveLoad: 54 }, roleMetrics: { Positioning: 84, 'Decision making': 88, 'Link-up play': 86, 'Final-third impact': 96, 'Press resistance': 91, 'Transition contribution': 93 } },
  { id: 278, name: 'Vinícius Júnior', team: 'Real Madrid', age: 25, position: 'LW', archetype: 'Dagger', image: '/assets/players/vinicius-junior.jpg', rating: 93, traits: { control: 82, transition: 99, pressing: 69, width: 96, tempo: 95, defensiveLoad: 48 }, roleMetrics: { Positioning: 87, 'Decision making': 85, 'Link-up play': 82, 'Final-third impact': 98, 'Press resistance': 89, 'Transition contribution': 99 } },
  { id: 521, name: 'Kylian Mbappé', team: 'Real Madrid', age: 27, position: 'CF / LW', archetype: 'Fox', image: '/assets/players/kylian-mbappe.jpg', rating: 94, traits: { control: 80, transition: 99, pressing: 62, width: 90, tempo: 98, defensiveLoad: 42 }, roleMetrics: { Positioning: 95, 'Decision making': 91, 'Link-up play': 79, 'Final-third impact': 99, 'Press resistance': 86, 'Transition contribution': 99 } },
  { id: 9091, name: 'Anthony Gordon', team: 'Newcastle United', age: 25, position: 'LW / RW / AM', archetype: 'Transition Monster', image: '/assets/players/gordon.jpg', rating: 86, traits: { control: 78, transition: 95, pressing: 91, width: 92, tempo: 94, defensiveLoad: 73 }, roleMetrics: { Positioning: 83, 'Decision making': 81, 'Link-up play': 79, 'Final-third impact': 87, 'Press resistance': 76, 'Transition contribution': 96 } },
];

const ROLE_MAP = {
  'Box Crasher': ['Advanced 8', 'Roaming midfielder', 'Second-wave creator'],
  Puppeteer: ['Controller', 'Deep-lying playmaker', 'Interior organiser'],
  Anchor: ['Single pivot', 'Deep-lying playmaker', 'Press screen'],
  'Magic Wand': ['Advanced playmaker', 'Free 10', 'Wide creator'],
  Controller: ['Deep-lying playmaker', 'Tempo controller', 'Press escape valve'],
  Paintbrush: ['Wide creator', 'Inside forward', 'Touchline isolator'],
  Dagger: ['Inside forward', 'Transition monster', 'Wide outlet'],
  Fox: ['Poacher', 'Channel runner', 'Transition finisher'],
  'Transition Monster': ['Left-wing runner', 'Right-wing outlet', 'Inside-left presser'],
};

const KEYS = ['control', 'transition', 'pressing', 'width', 'tempo', 'defensiveLoad'];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Which traits a team's STYLE prioritises.
const STYLE_WEIGHTS = {
  possession: { control: 2.0, tempo: 1.6, pressing: 1.2, width: 1.0, transition: 0.7, defensiveLoad: 0.5 },
  gegenpress: { pressing: 2.0, transition: 1.7, tempo: 1.4, control: 1.0, defensiveLoad: 0.9, width: 0.8 },
  direct:     { transition: 1.9, width: 1.5, tempo: 1.2, defensiveLoad: 1.1, pressing: 1.0, control: 0.6 },
  counter:    { transition: 1.8, defensiveLoad: 1.7, pressing: 1.1, width: 1.1, tempo: 0.9, control: 0.6 },
  lowblock:   { defensiveLoad: 2.2, transition: 1.5, pressing: 0.9, width: 0.8, tempo: 0.7, control: 0.5 },
  balanced:   { control: 1.1, transition: 1.1, pressing: 1.0, width: 1.0, tempo: 1.0, defensiveLoad: 1.0 },
};

// How much each trait matters when judging a given POSITION (don't grade a
// centre-back on dribbling, or a winger on defensive load).
const RELEVANCE = {
  GK:   { control: 0.6, transition: 0.2, pressing: 0.2, width: 0.2, tempo: 0.4, defensiveLoad: 1.0 },
  DEF:  { control: 1.0, transition: 0.35, pressing: 0.5, width: 0.2, tempo: 0.35, defensiveLoad: 1.0 },
  FB:   { control: 0.6, transition: 0.8, pressing: 0.8, width: 1.0, tempo: 0.6, defensiveLoad: 0.8 },
  DM:   { control: 1.0, transition: 0.6, pressing: 0.9, width: 0.4, tempo: 0.8, defensiveLoad: 1.0 },
  MID:  { control: 0.9, transition: 0.8, pressing: 0.8, width: 0.6, tempo: 0.9, defensiveLoad: 0.7 },
  WIDE: { control: 0.6, transition: 1.0, pressing: 0.6, width: 1.0, tempo: 0.9, defensiveLoad: 0.4 },
  ATT:  { control: 0.6, transition: 1.0, pressing: 0.6, width: 0.7, tempo: 0.9, defensiveLoad: 0.4 },
};

function positionBucket(player) {
  const t = `${player.position || ''} ${player.archetype || ''} ${player.pos || ''}`.toLowerCase();
  if (/(goalkeeper|keeper|\bgk\b)/.test(t)) return 'GK';
  if (/(wing.?back|full.?back|\brb\b|\blb\b|\brwb\b|\blwb\b)/.test(t)) return 'FB';
  if (/(back|defender|centre.?back|center.?back|\bcb\b|\bdef\b)/.test(t)) return 'DEF';
  if (/(defensive mid|\bdm\b|\bcdm\b|anchor|holding|ball-winning)/.test(t)) return 'DM';
  if (/(wing|\brw\b|\blw\b|winger)/.test(t)) return 'WIDE';
  if (/(forward|striker|\bcf\b|\bst\b|attacker|poacher|\bfox\b)/.test(t)) return 'ATT';
  return 'MID';
}

function average(values) {
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

// Returns { score, per } where per[k] is the 0-100 fit on each trait (how well
// the player meets that team's demand on it), and score is the weighted, scaled
// overall fit.
function compatibility(player, team) {
  const styleWeights = STYLE_WEIGHTS[team.style] || STYLE_WEIGHTS.balanced;
  const relevance = RELEVANCE[positionBucket(player)] || RELEVANCE.MID;
  const per = {};
  let acc = 0;
  let wsum = 0;
  for (const key of KEYS) {
    const demand = team.traits[key] ?? 75;
    const have = player.traits?.[key] ?? 70;
    const styleW = styleWeights[key] ?? 1;
    const shortfall = Math.max(0, demand - have);   // falling short of a demand hurts
    const surplus = Math.max(0, have - demand);      // exceeding it barely matters
    // Falling short on a trait the team's STYLE is built around hurts much more
    // than falling short on a peripheral one — that's what stops an elite
    // all-rounder fitting a stylistically wrong side just because his floor is high.
    const shortPenalty = 1.2 + styleW * 0.8;
    const traitFit = clamp(100 - shortfall * shortPenalty - surplus * 0.18, 0, 100);
    per[key] = Math.round(traitFit);
    const weight = styleW * (relevance[key] ?? 1);
    acc += traitFit * weight;
    wsum += weight;
  }
  const weighted = wsum > 0 ? acc / wsum : 70;
  // Stretch the working band so good and poor fits actually separate on screen.
  const stretched = (weighted - 60) / (99 - 60) * (99 - 55) + 55;
  return { score: Math.round(clamp(stretched, 35, 99)), per };
}

function scoreOnly(player, team) {
  return compatibility(player, team).score;
}

function verdictFor(score) {
  if (score >= 90) return 'Elite fit';
  if (score >= 84) return 'Excellent fit';
  if (score >= 78) return 'Very good fit';
  if (score >= 70) return 'Good fit';
  if (score >= 62) return 'Conditional fit';
  return 'System mismatch';
}

export function buildSystemFitReport(player, team) {
  const { score, per } = compatibility(player, team);

  const breakdown = [
    ['Possession fit', per.control],
    ['Transition fit', per.transition],
    ['Pressing fit', per.pressing],
    ['Width fit', per.width],
    ['Tempo fit', per.tempo],
    ['Defensive fit', per.defensiveLoad],
  ].map(([label, value]) => ({ label, value }));

  const sortedFits = [...breakdown].sort((a, b) => b.value - a.value);
  const best = sortedFits[0];
  const weakest = sortedFits[sortedFits.length - 1];

  const alternativeFits = SYSTEM_TEAMS
    .map(candidate => {
      const s = scoreOnly(player, candidate);
      return { ...candidate, score: s, verdict: verdictFor(s) };
    })
    .sort((a, b) => b.score - a.score);

  const roleLabel = (player.archetype && !/profile|provisional|pending/i.test(player.archetype))
    ? player.archetype.toLowerCase()
    : `${(player.position || 'all-round').toLowerCase()} profile`;

  const strengths = [
    `${team.philosophy} rewards his strongest actions: ${best.label.toLowerCase()} grades at ${best.value} inside this system.`,
    `As a ${roleLabel}, he meets the demands ${team.short} prioritises most rather than being forced into a generic role.`,
    score >= 84
      ? `The overall ${score} fit means the team can build around his profile, not bend it out of shape.`
      : `At ${score}, the fit is workable but selective — he solves specific phases rather than every one.`,
  ];

  const risks = [
    `${weakest.label} is the soft spot at ${weakest.value}; the surrounding structure has to carry that load.`,
    player.traits?.defensiveLoad < team.traits.defensiveLoad
      ? 'Defensive cover must be protected by the players around him.'
      : 'Role clarity matters most against deep blocks, where his best actions are easier to smother.',
  ];

  const conclusion = score >= 84
    ? `${player.name} improves ${team.short} because the profile changes the attack without breaking the structure. The fit is not about squeezing him into every phase. It is about giving his decisive actions the right platform.`
    : score >= 70
      ? `${player.name} can work at ${team.short}, but the system would need to bend around his best actions. The talent is the easy part. The role design is the real question.`
      : `${player.name} is a stylistic mismatch for ${team.short} as currently set up. It would take a structural change, not just a role tweak, to get value from him here.`;

  return {
    generatedAt: new Date().toISOString(),
    player,
    team,
    score,
    verdict: verdictFor(score),
    breakdown,
    rolePulse: Object.entries(player.roleMetrics || {}).map(([label, value]) => ({ label, value })),
    alternativeFits,
    primaryRoles: ROLE_MAP[player.archetype] ?? ['Hybrid role', 'Flexible starter', 'Rotation option'],
    strengths,
    risks,
    conclusion,
  };
}

export function buildPlayerComparison(primary, challenger, team) {
  const first = compatibility(primary, team);
  const second = compatibility(challenger, team);
  const dimensions = KEYS.map(label => ({
    label: label === 'defensiveLoad' ? 'defensive load' : label,
    primary: primary.traits?.[label] ?? 0,
    challenger: challenger.traits?.[label] ?? 0,
  }));
  return {
    generatedAt: new Date().toISOString(),
    team,
    primary,
    challenger,
    primaryScore: first.score,
    challengerScore: second.score,
    dimensions,
    verdict: first.score === second.score
      ? `${primary.name} and ${challenger.name} land level for ${team.short}, but they solve different problems.`
      : `${first.score > second.score ? primary.name : challenger.name} grades higher for ${team.short}. That does not make the other player worse. It changes what the team becomes.`,
  };
}

const deburr = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function searchLocalTeams(query = '') {
  const needle = deburr(query.trim());
  if (!needle) return SYSTEM_TEAMS.slice(0, 6);
  return SYSTEM_TEAMS.filter(team => deburr(`${team.name} ${team.short} ${team.country} ${team.league}`).includes(needle)).slice(0, 8);
}

export function searchLocalPlayers(query = '') {
  const needle = deburr(query.trim());
  if (!needle) return SYSTEM_PLAYERS.slice(0, 6);
  return SYSTEM_PLAYERS.filter(player => deburr(`${player.name} ${player.team} ${player.position} ${player.archetype}`).includes(needle)).slice(0, 8);
}

export const TRANSFER_SPOTLIGHTS = [
  {
    id: 'gordon-barcelona-scenario',
    status: 'SCENARIO MODEL',
    window: 'TRANSFER WINDOW SPOTLIGHT',
    playerId: 9091,
    teamId: 529,
    headline: 'Anthony Gordon at Barcelona: where does the chaos fit?',
    dek: 'A top-club move is not only a talent question. It is a role-design question. This spotlight shows how one player can solve different match states from more than one starting position.',
    verdict: 'Gordon gives Barcelona a different kind of wide threat: less pause, more rupture. The cleanest use is from the left, attacking the space created when the ball is held on the opposite side. He can also start from the right or arrive as an inside-left presser when the game needs speed rather than control.',
    sourceNote: 'Illustrative transfer-window scenario. The live transfer/news layer can replace this seed record when connected.',
    lineup: [
      { role: 'LW', label: 'PRIMARY', score: 92, x: 18, y: 20 },
      { role: 'RW', label: 'SECONDARY', score: 84, x: 82, y: 20 },
      { role: 'L8', label: 'GAME-STATE OPTION', score: 78, x: 34, y: 56 },
    ],
    talkingPoints: [
      'Left wing: attacks the back line while the opposite flank holds width.',
      'Right wing: gives the team a direct outlet when the game becomes stretched.',
      'Inside-left role: useful as a pressing and transition option, not as the permanent controller.',
    ],
  },
];
