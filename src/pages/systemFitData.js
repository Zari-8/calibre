export const SYSTEM_TEAMS = [
  // ── Premier League ──
  { id: 50, name: 'Manchester City', short: 'Man City', country: 'England', league: 'Premier League', formation: '4-3-3', philosophy: 'Territorial control', intensity: 'High', lineHeight: 'High', crest: 'MC', accent: '#6cabdd', secondary: '#1c2c5b', traits: { control: 96, transition: 80, pressing: 90, width: 86, tempo: 88, defensiveLoad: 79 } },
  { id: 42, name: 'Arsenal', short: 'Arsenal', country: 'England', league: 'Premier League', formation: '4-3-3', philosophy: 'Structured pressure', intensity: 'High', lineHeight: 'High', crest: 'ARS', accent: '#ef0107', secondary: '#ffffff', traits: { control: 88, transition: 84, pressing: 92, width: 84, tempo: 85, defensiveLoad: 83 } },
  { id: 40, name: 'Liverpool', short: 'Liverpool', country: 'England', league: 'Premier League', formation: '4-3-3', philosophy: 'Transition pressure', intensity: 'Very high', lineHeight: 'High', crest: 'LFC', accent: '#c8102e', secondary: '#ffffff', traits: { control: 82, transition: 96, pressing: 94, width: 84, tempo: 94, defensiveLoad: 80 } },
  { id: 49, name: 'Chelsea', short: 'Chelsea', country: 'England', league: 'Premier League', formation: '4-2-3-1', philosophy: 'Vertical width', intensity: 'High', lineHeight: 'High', crest: 'CHE', accent: '#034694', secondary: '#ffffff', traits: { control: 80, transition: 88, pressing: 85, width: 89, tempo: 86, defensiveLoad: 74 } },
  { id: 47, name: 'Tottenham Hotspur', short: 'Spurs', country: 'England', league: 'Premier League', formation: '4-3-3', philosophy: 'High-line verticality', intensity: 'Very high', lineHeight: 'Very high', crest: 'TOT', accent: '#132257', secondary: '#ffffff', traits: { control: 78, transition: 92, pressing: 90, width: 86, tempo: 93, defensiveLoad: 66 } },
  { id: 34, name: 'Newcastle United', short: 'Newcastle', country: 'England', league: 'Premier League', formation: '4-3-3', philosophy: 'Aggressive duels', intensity: 'High', lineHeight: 'Medium', crest: 'NEW', accent: '#241f20', secondary: '#ffffff', traits: { control: 74, transition: 86, pressing: 88, width: 82, tempo: 84, defensiveLoad: 82 } },

  // ── La Liga ──
  { id: 529, name: 'FC Barcelona', short: 'Barcelona', country: 'Spain', league: 'La Liga', formation: '4-3-3', philosophy: 'Positional control', intensity: 'High', lineHeight: 'High', crest: 'FCB', accent: '#a50044', secondary: '#ffd700', traits: { control: 94, transition: 78, pressing: 86, width: 88, tempo: 84, defensiveLoad: 76 } },
  { id: 541, name: 'Real Madrid', short: 'Real Madrid', country: 'Spain', league: 'La Liga', formation: '4-3-1-2', philosophy: 'Vertical dominance', intensity: 'High', lineHeight: 'Medium', crest: 'RM', accent: '#00529f', secondary: '#ffd700', traits: { control: 85, transition: 94, pressing: 79, width: 82, tempo: 91, defensiveLoad: 72 } },
  { id: 530, name: 'Atlético Madrid', short: 'Atlético', country: 'Spain', league: 'La Liga', formation: '4-4-2', philosophy: 'Compact defensive block', intensity: 'Medium', lineHeight: 'Low', crest: 'ATM', accent: '#cb3524', secondary: '#ffffff', traits: { control: 68, transition: 80, pressing: 74, width: 70, tempo: 72, defensiveLoad: 95 } },
  { id: 531, name: 'Athletic Club', short: 'Athletic', country: 'Spain', league: 'La Liga', formation: '4-2-3-1', philosophy: 'Direct intensity', intensity: 'High', lineHeight: 'Medium', crest: 'ATH', accent: '#ee2523', secondary: '#ffffff', traits: { control: 72, transition: 84, pressing: 86, width: 80, tempo: 82, defensiveLoad: 80 } },
  { id: 533, name: 'Villarreal', short: 'Villarreal', country: 'Spain', league: 'La Liga', formation: '4-4-2', philosophy: 'Patient possession', intensity: 'Medium', lineHeight: 'Medium', crest: 'VIL', accent: '#ffe667', secondary: '#005187', traits: { control: 82, transition: 76, pressing: 72, width: 78, tempo: 78, defensiveLoad: 74 } },
  { id: 548, name: 'Real Sociedad', short: 'Real Sociedad', country: 'Spain', league: 'La Liga', formation: '4-3-3', philosophy: 'Positional rotations', intensity: 'High', lineHeight: 'Medium', crest: 'RSO', accent: '#143c8b', secondary: '#ffffff', traits: { control: 84, transition: 78, pressing: 82, width: 80, tempo: 80, defensiveLoad: 76 } },

  // ── Bundesliga ──
  { id: 157, name: 'Bayern München', short: 'Bayern', country: 'Germany', league: 'Bundesliga', formation: '4-2-3-1', philosophy: 'Front-foot overloads', intensity: 'High', lineHeight: 'High', crest: 'FCB', accent: '#dc052d', secondary: '#ffffff', traits: { control: 87, transition: 90, pressing: 88, width: 90, tempo: 91, defensiveLoad: 77 } },
  { id: 168, name: 'Bayer Leverkusen', short: 'Leverkusen', country: 'Germany', league: 'Bundesliga', formation: '3-4-3', philosophy: 'Fluid overloads', intensity: 'High', lineHeight: 'High', crest: 'B04', accent: '#e32221', secondary: '#000000', traits: { control: 88, transition: 86, pressing: 84, width: 88, tempo: 86, defensiveLoad: 78 } },
  { id: 165, name: 'Borussia Dortmund', short: 'Dortmund', country: 'Germany', league: 'Bundesliga', formation: '4-2-3-1', philosophy: 'Vertical transitions', intensity: 'High', lineHeight: 'High', crest: 'BVB', accent: '#fde100', secondary: '#000000', traits: { control: 80, transition: 92, pressing: 82, width: 86, tempo: 90, defensiveLoad: 70 } },
  { id: 173, name: 'RB Leipzig', short: 'Leipzig', country: 'Germany', league: 'Bundesliga', formation: '4-2-2-2', philosophy: 'Press and counter', intensity: 'Very high', lineHeight: 'High', crest: 'RBL', accent: '#dd0741', secondary: '#ffffff', traits: { control: 78, transition: 94, pressing: 93, width: 80, tempo: 90, defensiveLoad: 76 } },
  { id: 172, name: 'VfB Stuttgart', short: 'Stuttgart', country: 'Germany', league: 'Bundesliga', formation: '4-2-3-1', philosophy: 'Aggressive width', intensity: 'High', lineHeight: 'High', crest: 'VFB', accent: '#e30613', secondary: '#ffffff', traits: { control: 79, transition: 85, pressing: 84, width: 87, tempo: 85, defensiveLoad: 72 } },
  { id: 169, name: 'Eintracht Frankfurt', short: 'Frankfurt', country: 'Germany', league: 'Bundesliga', formation: '3-4-3', philosophy: 'Physical transition', intensity: 'High', lineHeight: 'Medium', crest: 'SGE', accent: '#e1000f', secondary: '#000000', traits: { control: 74, transition: 87, pressing: 83, width: 84, tempo: 83, defensiveLoad: 75 } },

  // ── Serie A ──
  { id: 505, name: 'Inter', short: 'Inter', country: 'Italy', league: 'Serie A', formation: '3-5-2', philosophy: 'Automated rotations', intensity: 'Medium', lineHeight: 'Medium', crest: 'INT', accent: '#00529f', secondary: '#000000', traits: { control: 84, transition: 86, pressing: 78, width: 91, tempo: 82, defensiveLoad: 91 } },
  { id: 496, name: 'Juventus', short: 'Juventus', country: 'Italy', league: 'Serie A', formation: '3-5-2', philosophy: 'Controlled solidity', intensity: 'Medium', lineHeight: 'Medium', crest: 'JUV', accent: '#000000', secondary: '#ffffff', traits: { control: 80, transition: 80, pressing: 74, width: 84, tempo: 76, defensiveLoad: 88 } },
  { id: 489, name: 'AC Milan', short: 'Milan', country: 'Italy', league: 'Serie A', formation: '4-2-3-1', philosophy: 'Transition balance', intensity: 'Medium', lineHeight: 'Medium', crest: 'MIL', accent: '#fb090b', secondary: '#000000', traits: { control: 80, transition: 84, pressing: 78, width: 82, tempo: 80, defensiveLoad: 80 } },
  { id: 492, name: 'Napoli', short: 'Napoli', country: 'Italy', league: 'Serie A', formation: '4-3-3', philosophy: 'Possession tempo', intensity: 'High', lineHeight: 'Medium', crest: 'NAP', accent: '#12a0d7', secondary: '#ffffff', traits: { control: 86, transition: 82, pressing: 82, width: 84, tempo: 84, defensiveLoad: 78 } },
  { id: 499, name: 'Atalanta', short: 'Atalanta', country: 'Italy', league: 'Serie A', formation: '3-4-1-2', philosophy: 'Man-marking press', intensity: 'Very high', lineHeight: 'High', crest: 'ATA', accent: '#1d71b8', secondary: '#000000', traits: { control: 76, transition: 90, pressing: 94, width: 86, tempo: 88, defensiveLoad: 78 } },
  { id: 497, name: 'AS Roma', short: 'Roma', country: 'Italy', league: 'Serie A', formation: '3-5-2', philosophy: 'Pragmatic structure', intensity: 'Medium', lineHeight: 'Medium', crest: 'ROM', accent: '#8e1116', secondary: '#f0bc42', traits: { control: 76, transition: 82, pressing: 78, width: 82, tempo: 78, defensiveLoad: 84 } },

  // ── Ligue 1 ──
  { id: 85, name: 'Paris Saint-Germain', short: 'PSG', country: 'France', league: 'Ligue 1', formation: '4-3-3', philosophy: 'Fluid possession', intensity: 'High', lineHeight: 'High', crest: 'PSG', accent: '#004170', secondary: '#e30613', traits: { control: 90, transition: 89, pressing: 86, width: 92, tempo: 89, defensiveLoad: 73 } },
  { id: 81, name: 'Marseille', short: 'Marseille', country: 'France', league: 'Ligue 1', formation: '4-3-3', philosophy: 'High-press intensity', intensity: 'High', lineHeight: 'High', crest: 'OM', accent: '#2faee0', secondary: '#ffffff', traits: { control: 78, transition: 86, pressing: 90, width: 82, tempo: 86, defensiveLoad: 74 } },
  { id: 91, name: 'AS Monaco', short: 'Monaco', country: 'France', league: 'Ligue 1', formation: '4-2-3-1', philosophy: 'Vertical youth', intensity: 'High', lineHeight: 'High', crest: 'ASM', accent: '#e63312', secondary: '#ffffff', traits: { control: 78, transition: 88, pressing: 82, width: 84, tempo: 86, defensiveLoad: 72 } },
  { id: 79, name: 'Lille', short: 'Lille', country: 'France', league: 'Ligue 1', formation: '4-4-2', philosophy: 'Compact counter', intensity: 'Medium', lineHeight: 'Medium', crest: 'LIL', accent: '#e01e13', secondary: '#ffffff', traits: { control: 74, transition: 84, pressing: 80, width: 78, tempo: 80, defensiveLoad: 82 } },
  { id: 80, name: 'Olympique Lyonnais', short: 'Lyon', country: 'France', league: 'Ligue 1', formation: '4-3-3', philosophy: 'Possession width', intensity: 'Medium', lineHeight: 'Medium', crest: 'OL', accent: '#1b1464', secondary: '#ffffff', traits: { control: 80, transition: 80, pressing: 76, width: 84, tempo: 80, defensiveLoad: 72 } },
  { id: 84, name: 'OGC Nice', short: 'Nice', country: 'France', league: 'Ligue 1', formation: '4-3-3', philosophy: 'Defensive structure', intensity: 'Medium', lineHeight: 'Low', crest: 'NIC', accent: '#c2122e', secondary: '#000000', traits: { control: 74, transition: 78, pressing: 76, width: 76, tempo: 74, defensiveLoad: 84 } },

  // ── Eredivisie ──
  { id: 194, name: 'Ajax', short: 'Ajax', country: 'Netherlands', league: 'Eredivisie', formation: '4-3-3', philosophy: 'Development possession', intensity: 'High', lineHeight: 'High', crest: 'AJX', accent: '#d2122e', secondary: '#ffffff', traits: { control: 86, transition: 82, pressing: 87, width: 85, tempo: 86, defensiveLoad: 70 } },
  { id: 197, name: 'PSV Eindhoven', short: 'PSV', country: 'Netherlands', league: 'Eredivisie', formation: '4-2-3-1', philosophy: 'Front-foot dominance', intensity: 'High', lineHeight: 'High', crest: 'PSV', accent: '#ed1c24', secondary: '#ffffff', traits: { control: 86, transition: 86, pressing: 88, width: 88, tempo: 88, defensiveLoad: 72 } },
  { id: 209, name: 'Feyenoord', short: 'Feyenoord', country: 'Netherlands', league: 'Eredivisie', formation: '4-3-3', philosophy: 'Pressing tempo', intensity: 'High', lineHeight: 'High', crest: 'FEY', accent: '#e30613', secondary: '#ffffff', traits: { control: 82, transition: 84, pressing: 86, width: 84, tempo: 86, defensiveLoad: 74 } },
  { id: 201, name: 'AZ Alkmaar', short: 'AZ', country: 'Netherlands', league: 'Eredivisie', formation: '4-3-3', philosophy: 'Positional development', intensity: 'High', lineHeight: 'Medium', crest: 'AZ', accent: '#e2001a', secondary: '#ffffff', traits: { control: 82, transition: 78, pressing: 82, width: 80, tempo: 80, defensiveLoad: 72 } },
  { id: 415, name: 'FC Twente', short: 'Twente', country: 'Netherlands', league: 'Eredivisie', formation: '4-2-3-1', philosophy: 'Balanced possession', intensity: 'Medium', lineHeight: 'Medium', crest: 'TWE', accent: '#e2001a', secondary: '#ffffff', traits: { control: 78, transition: 78, pressing: 78, width: 78, tempo: 78, defensiveLoad: 74 } },
  { id: 200, name: 'FC Utrecht', short: 'Utrecht', country: 'Netherlands', league: 'Eredivisie', formation: '4-3-3', philosophy: 'Direct pressure', intensity: 'High', lineHeight: 'Medium', crest: 'UTR', accent: '#e2001a', secondary: '#000000', traits: { control: 74, transition: 82, pressing: 82, width: 78, tempo: 80, defensiveLoad: 76 } },

  // ── Belgian Pro League ──
  { id: 554, name: 'Club Brugge', short: 'Club Brugge', country: 'Belgium', league: 'Belgian Pro League', formation: '4-2-3-1', philosophy: 'Aggressive progression', intensity: 'High', lineHeight: 'Medium', crest: 'CB', accent: '#0071c8', secondary: '#000000', traits: { control: 77, transition: 85, pressing: 82, width: 83, tempo: 84, defensiveLoad: 76 } },
  { id: 733, name: 'Anderlecht', short: 'Anderlecht', country: 'Belgium', league: 'Belgian Pro League', formation: '4-3-3', philosophy: 'Possession identity', intensity: 'Medium', lineHeight: 'Medium', crest: 'AND', accent: '#5d2d7e', secondary: '#ffffff', traits: { control: 80, transition: 76, pressing: 78, width: 80, tempo: 78, defensiveLoad: 72 } },
  { id: 742, name: 'KRC Genk', short: 'Genk', country: 'Belgium', league: 'Belgian Pro League', formation: '4-3-3', philosophy: 'Attacking transitions', intensity: 'High', lineHeight: 'High', crest: 'GNK', accent: '#0066b3', secondary: '#ffffff', traits: { control: 78, transition: 86, pressing: 82, width: 84, tempo: 84, defensiveLoad: 72 } },
  { id: 1393, name: 'Union Saint-Gilloise', short: 'Union SG', country: 'Belgium', league: 'Belgian Pro League', formation: '3-5-2', philosophy: 'Compact verticality', intensity: 'High', lineHeight: 'Medium', crest: 'USG', accent: '#ffd200', secondary: '#003d7c', traits: { control: 74, transition: 86, pressing: 82, width: 82, tempo: 82, defensiveLoad: 80 } },
  { id: 740, name: 'Royal Antwerp', short: 'Antwerp', country: 'Belgium', league: 'Belgian Pro League', formation: '4-3-3', philosophy: 'Balanced pressing', intensity: 'Medium', lineHeight: 'Medium', crest: 'ANT', accent: '#d2122e', secondary: '#ffffff', traits: { control: 76, transition: 80, pressing: 78, width: 78, tempo: 78, defensiveLoad: 76 } },
  { id: 631, name: 'KAA Gent', short: 'Gent', country: 'Belgium', league: 'Belgian Pro League', formation: '4-2-3-1', philosophy: 'Direct width', intensity: 'Medium', lineHeight: 'Medium', crest: 'GNT', accent: '#0a3d8f', secondary: '#ffffff', traits: { control: 74, transition: 80, pressing: 78, width: 82, tempo: 78, defensiveLoad: 74 } },

  // ── Primeira Liga ──
  { id: 211, name: 'Benfica', short: 'Benfica', country: 'Portugal', league: 'Primeira Liga', formation: '4-2-3-1', philosophy: 'Possession press', intensity: 'High', lineHeight: 'High', crest: 'SLB', accent: '#da020e', secondary: '#ffffff', traits: { control: 86, transition: 84, pressing: 86, width: 86, tempo: 86, defensiveLoad: 76 } },
  { id: 212, name: 'FC Porto', short: 'Porto', country: 'Portugal', league: 'Primeira Liga', formation: '4-4-2', philosophy: 'Aggressive structure', intensity: 'High', lineHeight: 'Medium', crest: 'POR', accent: '#00428c', secondary: '#ffffff', traits: { control: 80, transition: 84, pressing: 84, width: 80, tempo: 82, defensiveLoad: 82 } },
  { id: 228, name: 'Sporting CP', short: 'Sporting', country: 'Portugal', league: 'Primeira Liga', formation: '3-4-3', philosophy: 'Wing-back overloads', intensity: 'High', lineHeight: 'High', crest: 'SCP', accent: '#008057', secondary: '#ffffff', traits: { control: 84, transition: 84, pressing: 84, width: 90, tempo: 84, defensiveLoad: 78 } },
  { id: 217, name: 'SC Braga', short: 'Braga', country: 'Portugal', league: 'Primeira Liga', formation: '4-4-2', philosophy: 'Transition counter', intensity: 'Medium', lineHeight: 'Medium', crest: 'BRA', accent: '#e30613', secondary: '#ffffff', traits: { control: 76, transition: 84, pressing: 80, width: 78, tempo: 80, defensiveLoad: 76 } },
  { id: 224, name: 'Vitória SC', short: 'Vitória', country: 'Portugal', league: 'Primeira Liga', formation: '4-3-3', philosophy: 'Pressing energy', intensity: 'Medium', lineHeight: 'Medium', crest: 'VIT', accent: '#ffffff', secondary: '#000000', traits: { control: 72, transition: 80, pressing: 82, width: 78, tempo: 78, defensiveLoad: 74 } },
  { id: 242, name: 'Famalicão', short: 'Famalicão', country: 'Portugal', league: 'Primeira Liga', formation: '4-3-3', philosophy: 'Possession build', intensity: 'Medium', lineHeight: 'Medium', crest: 'FAM', accent: '#1f4ba0', secondary: '#ffffff', traits: { control: 76, transition: 76, pressing: 76, width: 78, tempo: 76, defensiveLoad: 72 } },

  // ── Brasileirão ──
  { id: 127, name: 'Flamengo', short: 'Flamengo', country: 'Brazil', league: 'Brasileirão', formation: '4-3-3', philosophy: 'Possession flair', intensity: 'High', lineHeight: 'Medium', crest: 'FLA', accent: '#c52613', secondary: '#000000', traits: { control: 84, transition: 84, pressing: 82, width: 86, tempo: 84, defensiveLoad: 74 } },
  { id: 121, name: 'Palmeiras', short: 'Palmeiras', country: 'Brazil', league: 'Brasileirão', formation: '4-2-3-1', philosophy: 'Intense pressing', intensity: 'Very high', lineHeight: 'High', crest: 'PAL', accent: '#006437', secondary: '#ffffff', traits: { control: 80, transition: 86, pressing: 90, width: 84, tempo: 86, defensiveLoad: 80 } },
  { id: 120, name: 'Botafogo', short: 'Botafogo', country: 'Brazil', league: 'Brasileirão', formation: '4-2-3-1', philosophy: 'Transition speed', intensity: 'High', lineHeight: 'High', crest: 'BOT', accent: '#000000', secondary: '#ffffff', traits: { control: 78, transition: 88, pressing: 84, width: 82, tempo: 86, defensiveLoad: 76 } },
  { id: 124, name: 'Fluminense', short: 'Fluminense', country: 'Brazil', league: 'Brasileirão', formation: '4-2-3-1', philosophy: 'Possession patience', intensity: 'Medium', lineHeight: 'Medium', crest: 'FLU', accent: '#870a28', secondary: '#006437', traits: { control: 84, transition: 76, pressing: 80, width: 80, tempo: 78, defensiveLoad: 76 } },
  { id: 126, name: 'São Paulo', short: 'São Paulo', country: 'Brazil', league: 'Brasileirão', formation: '3-4-3', philosophy: 'Structured build', intensity: 'Medium', lineHeight: 'Medium', crest: 'SAO', accent: '#fe0000', secondary: '#000000', traits: { control: 80, transition: 78, pressing: 78, width: 82, tempo: 78, defensiveLoad: 80 } },
  { id: 119, name: 'Internacional', short: 'Internacional', country: 'Brazil', league: 'Brasileirão', formation: '4-2-3-1', philosophy: 'Compact pressure', intensity: 'Medium', lineHeight: 'Medium', crest: 'INT', accent: '#e5050f', secondary: '#ffffff', traits: { control: 78, transition: 80, pressing: 82, width: 80, tempo: 80, defensiveLoad: 80 } },
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

// ─────────────────────────────────────────────────────────────────────────
// Transfer-window spotlight engine (v1)
//
// Seeded fit-scenario storylines. `buzz` is the interim selection signal.
// Pass a live engagement map { [storylineId]: votes + comments } from
// debate_votes / forum_posts to pickTransferStoryline() to rank the spotlight
// by what's actually most-debated on Calibre. The card's analysis (verdict,
// talking points, lineup) is GENERATED from buildSystemFitReport — never
// hardcoded — and the player photo comes from the real registry row.
// ─────────────────────────────────────────────────────────────────────────
export const TRANSFER_STORYLINES = [
  { id: 'olise-madrid', playerName: 'Michael Olise', query: 'Olise',   fromClub: 'Bayern München',        toTeamId: 541, window: 'TRANSFER WINDOW SPOTLIGHT', status: 'FIT SCENARIO', buzz: 88, signal: 'most-debated transfer on Calibre this week' },
  { id: 'vitinha-city', playerName: 'Vitinha',       query: 'Vitinha', fromClub: 'Paris Saint-Germain',   toTeamId: 50,  window: 'TRANSFER WINDOW SPOTLIGHT', status: 'FIT SCENARIO', buzz: 82, signal: 'most-debated transfer on Calibre this week' },
  { id: 'cubarsi-city', playerName: 'Pau Cubarsí',   query: 'Cubarsí', fromClub: 'FC Barcelona',          toTeamId: 50,  window: 'TRANSFER WINDOW SPOTLIGHT', status: 'FIT SCENARIO', buzz: 79, signal: 'most-debated transfer on Calibre this week' },
];

const WEEK_INDEX = () => { const d = new Date(); const j = new Date(d.getFullYear(), 0, 1); return Math.floor((d - j) / 604800000); };

// Selection signal: pass live engagement to rank by Calibre's own debate volume;
// otherwise rank by seeded buzz and rotate weekly across the top three.
export function pickTransferStoryline(storylines = TRANSFER_STORYLINES, engagement = null) {
  if (!storylines || !storylines.length) return null;
  if (engagement && Object.keys(engagement).length) {
    return [...storylines].sort((a, b) => (engagement[b.id] || 0) - (engagement[a.id] || 0))[0];
  }
  const byBuzz = [...storylines].sort((a, b) => (b.buzz || 0) - (a.buzz || 0));
  const pool = byBuzz.slice(0, 3);
  return pool[WEEK_INDEX() % pool.length] || byBuzz[0];
}

function lineupForPlayer(player, score) {
  const t = `${player.position || ''} ${player.bucket || ''}`.toLowerCase();
  const s = Math.round(score);
  const tier = n => Math.max(58, s - n);
  if (/gk|keeper/.test(t)) return [{ role: 'GK', label: 'PRIMARY', score: s, x: 50, y: 90 }];
  if (/\bcb\b|centre|center|\bdef\b|back/.test(t)) return [
    { role: 'CB', label: 'PRIMARY', score: s, x: 50, y: 80 },
    { role: 'LCB', label: 'SECONDARY', score: tier(6), x: 34, y: 78 },
    { role: 'DM', label: 'GAME-STATE OPTION', score: tier(12), x: 50, y: 62 }];
  if (/\bdm\b|defensive mid/.test(t)) return [
    { role: 'DM', label: 'PRIMARY', score: s, x: 50, y: 66 },
    { role: 'CM', label: 'SECONDARY', score: tier(6), x: 50, y: 50 },
    { role: 'CB', label: 'GAME-STATE OPTION', score: tier(12), x: 50, y: 80 }];
  if (/\bam\b|attacking mid|\b10\b/.test(t)) return [
    { role: 'AM', label: 'PRIMARY', score: s, x: 50, y: 34 },
    { role: 'L8', label: 'SECONDARY', score: tier(6), x: 34, y: 50 },
    { role: 'RW', label: 'GAME-STATE OPTION', score: tier(12), x: 80, y: 22 }];
  if (/lw|rw|wing|wide/.test(t)) return [
    { role: 'LW', label: 'PRIMARY', score: s, x: 18, y: 20 },
    { role: 'RW', label: 'SECONDARY', score: tier(7), x: 82, y: 20 },
    { role: 'L8', label: 'GAME-STATE OPTION', score: tier(13), x: 34, y: 54 }];
  if (/st|cf|fwd|att|striker|forward/.test(t)) return [
    { role: 'ST', label: 'PRIMARY', score: s, x: 50, y: 14 },
    { role: 'SS', label: 'SECONDARY', score: tier(6), x: 50, y: 30 },
    { role: 'LW', label: 'GAME-STATE OPTION', score: tier(12), x: 20, y: 22 }];
  return [
    { role: 'CM', label: 'PRIMARY', score: s, x: 50, y: 52 },
    { role: 'AM', label: 'SECONDARY', score: tier(6), x: 50, y: 34 },
    { role: 'L8', label: 'GAME-STATE OPTION', score: tier(12), x: 34, y: 50 }];
}

function cleanArchetype(player) {
  const a = String(player.archetype || '');
  if (a && !/registry profile|provisional/i.test(a)) return a;
  const t = `${player.position || ''} ${player.bucket || ''}`.toLowerCase();
  if (/gk|keeper/.test(t)) return 'Goalkeeper';
  if (/\bcb\b|\bdef\b|back/.test(t)) return 'Defender';
  if (/lw|rw|wing|wide/.test(t)) return 'Wide forward';
  if (/st|cf|fwd|att|striker|forward/.test(t)) return 'Forward';
  if (/\bdm\b|\b6\b/.test(t)) return 'Deep midfielder';
  if (/\bam\b|\b10\b/.test(t)) return 'Attacking midfielder';
  return 'Midfielder';
}

// Generate the full spotlight card from a real player + destination team.
export function buildTransferSpotlight(player, team, storyline = {}) {
  if (!player || !team) return null;
  const archetype = cleanArchetype(player);
  const p = { ...player, archetype };
  const report = buildSystemFitReport(p, team);
  const score = report.score;
  const last = String(player.name || '').split(' ').slice(-1)[0];
  const article = /^[aeiou]/i.test(report.verdict) ? 'An' : 'A';
  const topSignal = [...report.breakdown].sort((a, b) => b.value - a.value)[0];
  return {
    window: storyline.window || 'TRANSFER WINDOW SPOTLIGHT',
    status: storyline.status || 'FIT SCENARIO',
    score,
    headline: `${player.name} to ${team.short}: does ${team.philosophy.toLowerCase()} fit?`,
    dek: `${article} ${report.verdict.toLowerCase()} on the model. ${team.philosophy} asks specific things of a ${archetype.toLowerCase()} — this is where ${last} would start and what it changes.`,
    verdict: report.conclusion,
    talkingPoints: [report.strengths[0], report.strengths[2], report.risks[0]].filter(Boolean),
    lineup: lineupForPlayer(p, score),
    sourceNote: `Auto-generated by Calibre System Fit · strongest signal: ${topSignal.label.toLowerCase()} (${topSignal.value}). Selected by ${storyline.signal || 'most-debated transfer on Calibre this week'}.`,
  };
}
