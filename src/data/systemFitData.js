export const SYSTEM_TEAMS = [
  { id: 529, name: 'FC Barcelona', short: 'Barcelona', country: 'Spain', league: 'La Liga', formation: '4-3-3', philosophy: 'Positional control', intensity: 'High', lineHeight: 'High', crest: 'FCB', accent: '#a50044', secondary: '#ffd700', traits: { control: 94, transition: 78, pressing: 86, width: 88, tempo: 84, defensiveLoad: 76 } },
  { id: 541, name: 'Real Madrid', short: 'Real Madrid', country: 'Spain', league: 'La Liga', formation: '4-3-1-2', philosophy: 'Vertical dominance', intensity: 'High', lineHeight: 'Medium', crest: 'RM', accent: '#00529f', secondary: '#ffd700', traits: { control: 85, transition: 94, pressing: 79, width: 82, tempo: 91, defensiveLoad: 72 } },
  { id: 50, name: 'Manchester City', short: 'Man City', country: 'England', league: 'Premier League', formation: '4-3-3', philosophy: 'Territorial control', intensity: 'High', lineHeight: 'High', crest: 'MC', accent: '#6cabdd', secondary: '#1c2c5b', traits: { control: 96, transition: 80, pressing: 90, width: 86, tempo: 88, defensiveLoad: 79 } },
  { id: 42, name: 'Arsenal', short: 'Arsenal', country: 'England', league: 'Premier League', formation: '4-3-3', philosophy: 'Structured pressure', intensity: 'High', lineHeight: 'High', crest: 'ARS', accent: '#ef0107', secondary: '#fff', traits: { control: 88, transition: 84, pressing: 92, width: 84, tempo: 85, defensiveLoad: 83 } },
  { id: 157, name: 'Bayern München', short: 'Bayern', country: 'Germany', league: 'Bundesliga', formation: '4-2-3-1', philosophy: 'Front-foot overloads', intensity: 'High', lineHeight: 'High', crest: 'FCB', accent: '#dc052d', secondary: '#fff', traits: { control: 87, transition: 90, pressing: 88, width: 90, tempo: 91, defensiveLoad: 77 } },
  { id: 40, name: 'Liverpool', short: 'Liverpool', country: 'England', league: 'Premier League', formation: '4-3-3', philosophy: 'Transition pressure', intensity: 'Very high', lineHeight: 'High', crest: 'LFC', accent: '#c8102e', secondary: '#fff', traits: { control: 82, transition: 96, pressing: 94, width: 84, tempo: 94, defensiveLoad: 80 } },
  { id: 85, name: 'Paris Saint-Germain', short: 'PSG', country: 'France', league: 'Ligue 1', formation: '4-3-3', philosophy: 'Fluid possession', intensity: 'High', lineHeight: 'High', crest: 'PSG', accent: '#004170', secondary: '#e30613', traits: { control: 90, transition: 89, pressing: 86, width: 92, tempo: 89, defensiveLoad: 73 } },
  { id: 505, name: 'Inter', short: 'Inter', country: 'Italy', league: 'Serie A', formation: '3-5-2', philosophy: 'Automated rotations', intensity: 'Medium', lineHeight: 'Medium', crest: 'INT', accent: '#00529f', secondary: '#000', traits: { control: 84, transition: 86, pressing: 78, width: 91, tempo: 82, defensiveLoad: 91 } },
  { id: 194, name: 'Ajax', short: 'Ajax', country: 'Netherlands', league: 'Eredivisie', formation: '4-3-3', philosophy: 'Development possession', intensity: 'High', lineHeight: 'High', crest: 'AJX', accent: '#d2122e', secondary: '#fff', traits: { control: 86, transition: 82, pressing: 87, width: 85, tempo: 86, defensiveLoad: 70 } },
  { id: 554, name: 'Club Brugge', short: 'Club Brugge', country: 'Belgium', league: 'Belgian Pro League', formation: '4-2-3-1', philosophy: 'Aggressive progression', intensity: 'High', lineHeight: 'Medium', crest: 'CB', accent: '#0071c8', secondary: '#000', traits: { control: 77, transition: 85, pressing: 82, width: 83, tempo: 84, defensiveLoad: 76 } },
];

export const SYSTEM_PLAYERS = [
  { id: 154, name: 'Jude Bellingham', team: 'Real Madrid', age: 22, position: 'CM / AM', archetype: 'Box Crasher', image: '/assets/players/jude-bellingham.jpg', rating: 92, traits: { control: 86, transition: 94, pressing: 88, width: 72, tempo: 91, defensiveLoad: 84 }, roleMetrics: { Positioning: 92, 'Decision making': 91, 'Link-up play': 87, 'Final-third impact': 94, 'Press resistance': 85, 'Transition contribution': 93 } },
  { id: 276, name: 'Pedri', team: 'FC Barcelona', age: 23, position: 'CM', archetype: 'Puppeteer', image: '/assets/players/pedri.jpg', rating: 91, traits: { control: 98, transition: 77, pressing: 84, width: 76, tempo: 94, defensiveLoad: 75 }, roleMetrics: { Positioning: 96, 'Decision making': 95, 'Link-up play': 94, 'Final-third impact': 82, 'Press resistance': 96, 'Transition contribution': 79 } },
  { id: 1100, name: 'Florian Wirtz', team: 'Bayer Leverkusen', age: 23, position: 'AM', archetype: 'Magic Wand', image: '/assets/players/florian-wirtz.jpg', rating: 90, traits: { control: 91, transition: 90, pressing: 80, width: 82, tempo: 89, defensiveLoad: 67 }, roleMetrics: { Positioning: 89, 'Decision making': 91, 'Link-up play': 93, 'Final-third impact': 92, 'Press resistance': 88, 'Transition contribution': 87 } },
  { id: 874, name: 'Vitinha', team: 'Paris Saint-Germain', age: 26, position: 'CM', archetype: 'Controller', image: '/assets/players/vitinha.jpg', rating: 89, traits: { control: 95, transition: 78, pressing: 86, width: 74, tempo: 93, defensiveLoad: 81 }, roleMetrics: { Positioning: 94, 'Decision making': 93, 'Link-up play': 94, 'Final-third impact': 79, 'Press resistance': 94, 'Transition contribution': 80 } },
  { id: 762, name: 'Lamine Yamal', team: 'FC Barcelona', age: 18, position: 'RW', archetype: 'Paintbrush', image: '/assets/players/lamine-yamal.jpg', rating: 88, traits: { control: 88, transition: 96, pressing: 72, width: 98, tempo: 91, defensiveLoad: 54 }, roleMetrics: { Positioning: 84, 'Decision making': 88, 'Link-up play': 86, 'Final-third impact': 96, 'Press resistance': 91, 'Transition contribution': 93 } },
  { id: 278, name: 'Vinícius Júnior', team: 'Real Madrid', age: 25, position: 'LW', archetype: 'Dagger', image: '/assets/players/vinicius-junior.jpg', rating: 93, traits: { control: 82, transition: 99, pressing: 69, width: 96, tempo: 95, defensiveLoad: 48 }, roleMetrics: { Positioning: 87, 'Decision making': 85, 'Link-up play': 82, 'Final-third impact': 98, 'Press resistance': 89, 'Transition contribution': 99 } },
  { id: 521, name: 'Kylian Mbappé', team: 'Real Madrid', age: 27, position: 'CF / LW', archetype: 'Fox', image: '/assets/players/kylian-mbappe.jpg', rating: 94, traits: { control: 80, transition: 99, pressing: 62, width: 90, tempo: 98, defensiveLoad: 42 }, roleMetrics: { Positioning: 95, 'Decision making': 91, 'Link-up play': 79, 'Final-third impact': 99, 'Press resistance': 86, 'Transition contribution': 99 } },
  { id: 9091, name: 'Anthony Gordon', team: 'Newcastle United', age: 25, position: 'LW / RW / AM', archetype: 'Transition Monster', image: '/assets/players/gordon.jpg', rating: 86, traits: { control: 78, transition: 95, pressing: 91, width: 92, tempo: 94, defensiveLoad: 73 }, roleMetrics: { Positioning: 83, 'Decision making': 81, 'Link-up play': 79, 'Final-third impact': 87, 'Press resistance': 76, 'Transition contribution': 96 } },
];

const ROLE_MAP = {
  'Box Crasher': ['Advanced 8', 'Roaming midfielder', 'Second-wave creator'],
  Puppeteer: ['Controller', 'Deep-lying playmaker', 'Interior organiser'],
  'Magic Wand': ['Advanced playmaker', 'Free 10', 'Wide creator'],
  Controller: ['Deep-lying playmaker', 'Tempo controller', 'Press escape valve'],
  Paintbrush: ['Wide creator', 'Inside forward', 'Touchline isolator'],
  Dagger: ['Inside forward', 'Transition monster', 'Wide outlet'],
  Fox: ['Poacher', 'Channel runner', 'Transition finisher'],
  'Transition Monster': ['Left-wing runner', 'Right-wing outlet', 'Inside-left presser'],
};

function average(values) {
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function compatibility(player, team) {
  const dimensions = ['control', 'transition', 'pressing', 'width', 'tempo', 'defensiveLoad'];
  const scores = dimensions.map(key => 100 - Math.abs((player.traits[key] ?? 75) - (team.traits[key] ?? 75)));
  const raw = average(scores);
  const roleBoost = player.archetype === 'Puppeteer' && team.philosophy.toLowerCase().includes('control') ? 4
    : player.archetype === 'Box Crasher' && team.traits.transition > 88 ? 3
      : player.archetype === 'Paintbrush' && team.traits.width > 88 ? 3 : 0;
  return Math.min(97, Math.max(58, raw + roleBoost));
}

function verdictFor(score) {
  if (score >= 90) return 'Elite fit';
  if (score >= 84) return 'Excellent fit';
  if (score >= 78) return 'Very good fit';
  if (score >= 70) return 'Good fit';
  return 'Conditional fit';
}

export function buildSystemFitReport(player, team) {
  const score = compatibility(player, team);
  const breakdown = [
    ['Role compatibility', Math.min(97, score + 4)],
    ['System demands', Math.min(96, score + 1)],
    ['Possession value', Math.round((player.traits.control + team.traits.control) / 2)],
    ['Transition value', Math.round((player.traits.transition + team.traits.transition) / 2)],
    ['Pressing match', Math.round((player.traits.pressing + team.traits.pressing) / 2)],
    ['Development ceiling', Math.min(96, player.age <= 23 ? player.rating + 3 : player.rating)],
  ].map(([label, value]) => ({ label, value }));

  const alternativeFits = SYSTEM_TEAMS
    .map(candidate => ({ ...candidate, score: compatibility(player, candidate), verdict: verdictFor(compatibility(player, candidate)) }))
    .sort((a, b) => b.score - a.score);

  const strengths = [
    `${player.name}'s ${player.archetype.toLowerCase()} profile gives ${team.short} another route through pressure.`,
    `${team.philosophy} rewards his strongest actions without forcing him into a generic midfield role.`,
    `The strongest signal is ${breakdown.sort((a,b) => b.value - a.value)[0].label.toLowerCase()} at ${breakdown.sort((a,b) => b.value - a.value)[0].value}.`,
  ];
  const risks = [
    player.traits.defensiveLoad < team.traits.defensiveLoad ? 'Defensive cover must be protected by the surrounding midfield structure.' : 'The workload is manageable, but role clarity matters against deep blocks.',
    player.traits.width < team.traits.width ? 'He should not be asked to provide the team width by himself.' : 'His wide influence works best when paired with an overlapping runner.',
  ];
  const conclusion = score >= 84
    ? `${player.name} improves ${team.short} because the profile changes the attack without breaking the structure. The fit is not about squeezing him into every phase. It is about giving his decisive actions the right platform.`
    : `${player.name} can work at ${team.short}, but the system would need to bend around his best actions. The talent is obvious. The role design is the real question.`;

  return {
    generatedAt: new Date().toISOString(),
    player,
    team,
    score,
    verdict: verdictFor(score),
    breakdown,
    rolePulse: Object.entries(player.roleMetrics).map(([label, value]) => ({ label, value })),
    alternativeFits,
    primaryRoles: ROLE_MAP[player.archetype] ?? ['Hybrid role', 'Flexible starter', 'Rotation option'],
    strengths,
    risks,
    conclusion,
  };
}

export function buildPlayerComparison(primary, challenger, team) {
  const first = buildSystemFitReport(primary, team);
  const second = buildSystemFitReport(challenger, team);
  const labels = ['control', 'transition', 'pressing', 'width', 'tempo', 'defensiveLoad'];
  const dimensions = labels.map(label => ({
    label: label === 'defensiveLoad' ? 'defensive load' : label,
    primary: primary.traits[label],
    challenger: challenger.traits[label],
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
      ? `${primary.name} and ${challenger.name} land level, but they solve different problems.`
      : `${first.score > second.score ? primary.name : challenger.name} grades higher for ${team.short}. That does not make the other player worse. It changes what the team becomes.`,
  };
}

export function searchLocalTeams(query = '') {
  const needle = query.trim().toLowerCase();
  if (!needle) return SYSTEM_TEAMS.slice(0, 6);
  return SYSTEM_TEAMS.filter(team => `${team.name} ${team.country} ${team.league}`.toLowerCase().includes(needle)).slice(0, 8);
}

export function searchLocalPlayers(query = '') {
  const needle = query.trim().toLowerCase();
  if (!needle) return SYSTEM_PLAYERS.slice(0, 6);
  return SYSTEM_PLAYERS.filter(player => `${player.name} ${player.team} ${player.position} ${player.archetype}`.toLowerCase().includes(needle)).slice(0, 8);
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
      { role: 'LW', label: 'PRIMARY', score: 92, x: 18, y: 22 },
      { role: 'RW', label: 'SECONDARY', score: 84, x: 82, y: 22 },
      { role: 'L8', label: 'GAME-STATE OPTION', score: 78, x: 34, y: 48 },
    ],
    talkingPoints: [
      'Left wing: attacks the back line while the opposite flank holds width.',
      'Right wing: gives the team a direct outlet when the game becomes stretched.',
      'Inside-left role: useful as a pressing and transition option, not as the permanent controller.',
    ],
  },
];
