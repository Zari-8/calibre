import { playerTraits, POSITION_BASELINES } from '../services/playerTraits.js';

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

// ── Team universe ──────────────────────────────────────────────────
// The pool the picker's local search and the alternative-fit ranking scan.
// Defaults to the hand-authored SYSTEM_TEAMS, but SystemFit registers the
// MERGED set (every measured derived_team_profiles club + hand-authored
// overrides) once the derived cache loads — so all teams in the DB are
// selectable and rankable, not just the 54. Falls back to SYSTEM_TEAMS if
// registration hasn't happened yet, so nothing ever regresses to empty.
let TEAM_UNIVERSE = SYSTEM_TEAMS;
export function registerTeamUniverse(teams) {
  if (Array.isArray(teams) && teams.length) TEAM_UNIVERSE = teams;
}
export function getTeamUniverse() {
  return TEAM_UNIVERSE;
}

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

// ── Canonical System Fit scorer ────────────────────────────────────
// One formula, used by BOTH the System Fit page (buildSystemFitReport) and the
// Transfers page (computeSystemFit), so the same player x club scores identically
// on both. Traits come from the shared engine in services/playerTraits.js.
//
// v2: weighted, punishing distance. The old version averaged six
// (100 - |gap|) terms and clamped to 58..97 — which made every player
// score 80s-90s for every team (especially when traits were missing and
// defaulted to 75-vs-75 = a perfect 100 on that axis). The new version:
//   - weights the identity axes (control/transition/pressing) heaviest
//   - uses squared distance so big tactical gaps are punished hard
//   - spans 32..99 so good and bad fits actually separate
//   - returns null when there's no real data to score on (see fitDetail)

const FIT_DIMS = ['control', 'transition', 'pressing', 'width', 'tempo', 'defensiveLoad'];
const FIT_WEIGHTS = { control: 1.4, transition: 1.3, pressing: 1.3, width: 0.9, tempo: 0.8, defensiveLoad: 1.1 };

// ── FIT v3 — directional supply axes + adaptation-risk haircut ─────────
// See docs/system-fit-v3-proposal.md. Three ideas, layered on top of the
// v2 weighted-distance base:
//
// (a) Directional supply axes. control/tempo are TEAM-PROVIDED quantities —
//     a team's aggregate control is a collective property (the whole side
//     circulating the ball), not something one player personally registers.
//     A team AT OR ABOVE the player here is a benefit (it feeds him more of
//     that resource than his individual numbers show) and must never be
//     penalized the way a genuine mismatch is. Only a shortfall — the player
//     wanting MORE than the team supplies (a controller stranded at a direct
//     side) — counts, via a one-sided hinge on the gap. This is the fix for
//     the original bug: Barcelona's control:94 no longer manufactures a
//     penalty against a Barcelona player whose individual control reads 88.
// (b) Native anchor. A player at his current club is a proven fit by
//     evidence, not projection — floored high (93) rather than scored purely
//     on trait alignment, which used to treat a homegrown player like a
//     cold transfer.
// (c) Adaptation-risk haircut. For every OTHER club, subtract a capped
//     penalty proportional to how far that destination's style (transition/
//     pressing/width/defensiveLoad — the axes that must genuinely match)
//     departs from the player's ORIGIN club's style. This is the
//     environmental-jump risk: a stylistically-plausible but radically
//     different dressing room/system still gets marked down for the real
//     adjustment risk, even when the raw trait alignment looks fine.
//
// v4 update — resolved by real-data backtest (Haaland's and Griezmann's
// actual per-90 stats at their actual current clubs, both undisputed elite
// fits): "collective vs individual" isn't a fixed property of an axis, it's
// a property of axis-times-ROLE. A lone striker's pressing, width, and
// defensive workload really are supplied by the rest of a well-built team —
// his job is to finish what they create, not to personally generate those
// three things — and treating them as symmetric was scoring Haaland's real
// stats a 32 ("Poor fit") at Man City. A winger's pressing is NOT the same:
// his job in most systems genuinely includes the press trigger on the
// touchline, so it stays a symmetric, must-genuinely-match axis for the
// WIDE bucket (this is the honest reading of Yamal's real friction at a
// high-press club — that one's a genuine tactical cost, not a category
// error). So the ATT bucket gets the wider hinge; other buckets keep the
// original control/tempo-only default until similarly backtested.
const SUPPLY_AXES = new Set(['control', 'tempo']);
const SUPPLY_AXES_ATT = new Set([...SUPPLY_AXES, 'pressing', 'width', 'defensiveLoad']);
const STYLE_AXES = ['transition', 'pressing', 'width', 'defensiveLoad'];
const STYLE_AXES_ATT = ['transition']; // the only axis a lone striker must personally match environment-to-environment
const ADAPT_SLOPE = 0.5;   // haircut points per point of average style departure from origin
const ADAPT_CAP = 12;      // max points the adaptation-risk term can remove

// Native floor is now evidence-conditioned (v4), not a blanket override —
// backtest evidence (Coutinho/Griezmann/Isco, all real, all documented poor
// fits while nominally "at" the club) showed a hard floor is wrong exactly
// when it matters: it can't distinguish "still fits" from "system has moved
// past him." Full proven-fit credit (93) requires the RAW trait-alignment
// score to first clear a sanity threshold; below that, a smaller, capped
// bonus credits roster stability without asserting "Elite," and the raw
// number is surfaced in the report (see fitDetail's `rawAlignment`) rather
// than hidden — a native player whose alignment has quietly collapsed is
// exactly the signal worth showing, not suppressing.
const NATIVE_FLOOR = 93;
const NATIVE_FLOOR_THRESHOLD = 58;   // raw alignment must clear this for full native credit
const NATIVE_PARTIAL_BONUS = 14;     // roster-stability credit when alignment is below threshold
const NATIVE_PARTIAL_CAP = 80;       // capped below "Elite"/"Strong" territory — signals drift, doesn't hide it

// Specialist-profile detection (v4) — a player whose traits deviate sharply
// from his position's typical baseline (a pure poacher, a pure destroyer)
// is exactly the case where a resemblance-style score is least trustworthy;
// worth flagging explicitly rather than presenting with false confidence.
// Threshold picked from Haaland's real computed traits vs the ATT baseline
// (RMS deviation ~15.7) — a first-pass cut, not a rigorously tuned value.
const SPECIALIST_RMS_THRESHOLD = 14;

// Does this team carry a real tactical profile (curated or derived),
// as opposed to a generic API placeholder with no traits?
function teamHasProfile(team) {
  return !!(team && team.traits && Object.keys(team.traits).length >= 4);
}

// Raw weighted-distance score from two trait sets. Assumes both are real.
// Supply axes use a one-sided hinge — only a shortfall (player wants more
// than the team/template supplies) counts; a team that gives MORE than the
// player individually shows is a benefit, never a penalty. Style axes stay
// full symmetric distance. `bucket` widens the supply set for the ATT
// bucket (see SUPPLY_AXES_ATT above); omitted/other buckets keep the
// original control/tempo-only default, so role/formation-template scoring
// (which doesn't pass a bucket) is unchanged.
function rawFit(traits, teamTraits, bucket) {
  const supply = bucket === 'ATT' ? SUPPLY_AXES_ATT : SUPPLY_AXES;
  let acc = 0, wsum = 0;
  for (const k of FIT_DIMS) {
    const p = traits[k] ?? 70;
    const t = teamTraits[k] ?? 70;
    const d = supply.has(k) ? Math.max(0, p - t) : Math.abs(p - t);
    acc += FIT_WEIGHTS[k] * (d * d);
    wsum += FIT_WEIGHTS[k];
  }
  const rmsd = Math.sqrt(acc / wsum);            // ~0..50 in "points"
  const score = Math.round(99 - rmsd * 2.0 - (rmsd * rmsd) / 40);
  return Math.max(32, Math.min(99, score));
}

// Shared club-name normalizer for exact-match club identity checks
// (isCurrentClub, originTeamFor). Strips accents BEFORE the a-z filter —
// found via the backtest against real registry data: the old version here
// filtered straight to [a-z] with no accent-folding step, so "Atlético
// Madrid" (SYSTEM_TEAMS' hand-authored name, é) normalized to "atlticomadrid"
// while the real DB value "Atletico Madrid" (no accent, as commonly stored)
// normalized to "atleticomadrid" — one character apart, never equal. That
// silently broke isCurrentClub() AND originTeamFor() for Atlético specifically
// (and any other accented club name stored unaccented in the registry): the
// native floor never engaged and the adaptation-risk origin lookup always
// came back null, for a real player at his real, current club. Confirmed
// with Griezmann's actual per-90 stats at his actual current club (Atlético)
// scoring as an unfloored raw fit instead of a recognized native one.
function normClubName(s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // fold accents (e-acute -> e, etc.)
    .toLowerCase()
    .replace(/\b(fc|cf|sc|ac|afc|cp|club|de|the)\b/g, '')
    .replace(/[^a-z]/g, '');
}

// Find the player's current club in the team universe, so we can measure
// how far a destination departs from where he actually plays now. Exact
// normalized-name match only (same rule as isCurrentClub below, for the
// same prefix-collision reasons — "Inter" must not match "Inter Miami").
function originTeamFor(player) {
  if (!player?.team) return null;
  const p = normClubName(player.team);
  if (!p) return null;
  return TEAM_UNIVERSE.find(t => [t?.name, t?.short].map(normClubName).filter(Boolean).some(n => n === p)) || null;
}

// Average absolute departure between two teams' STYLE axes, converted to a
// capped haircut. Returns 0 (no penalty) when the origin club is unknown —
// we skip the adaptation-risk term rather than guessing at it. `bucket`
// narrows the style-axes set to just `transition` for ATT, consistent with
// rawFit's hinge above — a lone striker doesn't personally have to close an
// environment's pressing/width/defensiveLoad gap, so a destination
// departing from his origin on those axes isn't HIS adaptation risk.
function adaptationRisk(originTraits, destTraits, bucket) {
  if (!originTraits || !destTraits) return 0;
  const axes = bucket === 'ATT' ? STYLE_AXES_ATT : STYLE_AXES;
  let acc = 0;
  for (const k of axes) acc += Math.abs((originTraits[k] ?? 70) - (destTraits[k] ?? 70));
  const avgDeparture = acc / axes.length;
  return Math.min(ADAPT_CAP, avgDeparture * ADAPT_SLOPE);
}

// Backwards-compatible signature: returns a number. Used by existing call
// sites that expect a plain score. Falls back to a neutral 70 only when a
// real score genuinely can't be computed (so old call sites never crash),
// but the page should prefer fitDetail() which exposes confidence.
export function systemFitScore(traits, team) {
  const tt = (team && team.traits) || {};
  if (!traits || !teamHasProfile(team)) return 70;
  return rawFit(traits, tt);
}

// Richer result: score + confidence + the dimensional gaps that drive it.
// confidence: 'high' (real player traits + real team profile),
//             'team' (player ok, team has no profile),
//             'player' (team ok, player has no match data),
//             'none'  (neither).
// hasStats tells us whether the player's traits are backed by match data.
export function fitDetail(player, team, hasStats) {
  const pt = player?.traits || {};
  const realTeam = teamHasProfile(team);
  const realPlayer = !!hasStats && pt && Object.keys(pt).length >= 4;

  if (!realPlayer && !realTeam) {
    return { score: null, confidence: 'none',
      note: 'Neither this player nor this club has enough data to compute a tactical fit yet.' };
  }
  if (!realPlayer) {
    return { score: null, confidence: 'player',
      note: 'This player has no match data yet, so tactical fit cannot be computed. Rating and profile fill in once he logs minutes in a covered competition.' };
  }
  if (!realTeam) {
    return { score: null, confidence: 'team',
      note: 'This club has no tactical profile yet (outside the covered leagues), so fit cannot be computed against it.' };
  }

  const tt = team.traits;
  const bucket = playerBucket(player);
  const rawAlignment = rawFit(pt, tt, bucket);
  let score = rawAlignment;

  // v3/v4: native club is a proven fit, evidence-conditioned; every other
  // club takes an adaptation-risk haircut proportional to how far it
  // departs in STYLE from where the player actually plays now. Applied here
  // (not just in buildSystemFitReport) so the System Fit page and the
  // Transfers page — both of which route through this function — see the
  // identical number for the same player x club, per this module's
  // one-formula guarantee.
  const nativeClub = isCurrentClub(player, team);
  if (nativeClub) {
    // Full proven-fit credit only when the raw alignment itself still
    // clears a sanity bar. Below that, a smaller capped bonus for roster
    // stability — NOT a blanket 93 — so a genuinely declining native fit
    // (Isco/Coutinho pattern) shows up as declining rather than being
    // hidden behind a confident "Elite fit."
    score = rawAlignment >= NATIVE_FLOOR_THRESHOLD
      ? Math.max(rawAlignment, NATIVE_FLOOR)
      : Math.min(NATIVE_PARTIAL_CAP, rawAlignment + NATIVE_PARTIAL_BONUS);
  } else {
    const origin = originTeamFor(player);
    const haircut = adaptationRisk(origin?.traits, tt, bucket);
    score = Math.max(32, Math.round(score - haircut));
  }

  // Specialist-profile check: how far this player's real traits deviate
  // from what's typical for his position. A big deviation (a pure poacher,
  // a pure destroyer) is exactly the case where a resemblance-style score
  // is least trustworthy — worth flagging explicitly rather than presenting
  // with false confidence (see buildSystemFitReport's caveat copy).
  const baseline = POSITION_BASELINES[bucket] || POSITION_BASELINES.MID;
  let devAcc = 0;
  for (const k of FIT_DIMS) devAcc += Math.pow((pt[k] ?? 70) - (baseline[k] ?? 70), 2);
  const specialistProfile = Math.sqrt(devAcc / FIT_DIMS.length) >= SPECIALIST_RMS_THRESHOLD;

  // Per-axis gap detail, for the read. Reflects the raw trait gap (not the
  // hinge/haircut-adjusted score) so the breakdown still shows the honest
  // per-axis distance driving the read.
  const gaps = FIT_DIMS.map(k => ({
    axis: k,
    player: pt[k] ?? 70,
    team: tt[k] ?? 70,
    gap: (pt[k] ?? 70) - (tt[k] ?? 70),
  }));
  return { score, confidence: 'high', note: null, gaps, nativeClub, bucket, rawAlignment, specialistProfile };
}

function compatibility(player, team) {
  return systemFitScore(player.traits, team);
}

// Used by the Transfers page. Derives the player's traits from the shared engine,
// scores them with the canonical formula, and returns the sub-metrics the
// Transfers system-fit readout consumes.
export function computeSystemFit(player, team) {
  if (!player || !team) return null;
  // Prefer traits already attached to the player (what buildSystemFitReport
  // reads via fitDetail's `pt = player?.traits || {}`) and only derive fresh
  // ones when they're missing. This call site used to unconditionally
  // re-run playerTraits(player) even when player.traits was already set —
  // harmless for real DB/API players (playerTraits is deterministic over the
  // same underlying stat fields, so it reproduced the same numbers), but for
  // the hand-authored SYSTEM_PLAYERS seed/demo records (which carry a
  // curated `traits` object but none of the raw per-90 fields playerTraits
  // needs), it silently threw away the curated vector and fell back to a
  // generic position-baseline guess — so the same seed player scored
  // differently here than on the System Fit page, contradicting this
  // module's "same formula on both pages" guarantee below.
  const hasRealTraits = player.traits && Object.keys(player.traits).length >= 4;
  const traits = hasRealTraits ? player.traits : playerTraits(player).traits;
  const tt = team.traits || {};
  // v3: route through fitDetail (not the bare systemFitScore fallback) so
  // the Transfers page picks up the native floor + adaptation-risk haircut
  // too — previously this call site skipped both, so the same player x club
  // could score differently here than on the System Fit page, contradicting
  // this module's "same formula on both pages" guarantee above.
  const detail = fitDetail({ ...player, traits }, team, player?._hasStats !== false);
  return {
    score: detail.score ?? systemFitScore(traits, team),
    traits,
    teamTraits: tt,
    pressing: Math.round(((traits.pressing ?? 70) + (tt.pressing ?? 70)) / 2),
    transition: Math.round(((traits.transition ?? 70) + (tt.transition ?? 70)) / 2),
    boxThreat: Math.round(((traits.width ?? 70) + (tt.tempo ?? 70)) / 2),
  };
}

// Human-readable label for a positional bucket, used in specialist-profile copy.
const BUCKET_LABEL = { GK: 'goalkeeper', DEF: 'centre-back', FB: 'full-back', DM: 'defensive midfielder', MID: 'midfielder', WIDE: 'winger', ATT: 'striker' };
function bucketLabel(bucket) {
  return BUCKET_LABEL[bucket] || 'player';
}

function verdictFor(score) {
  if (score >= 86) return 'Elite fit';
  if (score >= 76) return 'Strong fit';
  if (score >= 64) return 'Workable fit';
  if (score >= 50) return 'Compromise fit';
  return 'Poor fit';
}

// Human-readable axis labels for the read.
const AXIS_LABEL = {
  control: 'possession control',
  transition: 'vertical transition',
  pressing: 'pressing intensity',
  width: 'natural width',
  tempo: 'ball-circulation tempo',
  defensiveLoad: 'defensive workload',
};

// Build strengths/risks from the real per-axis gaps, so two different
// players (or the same player at two clubs) get genuinely different reads.
function readFromGaps(player, team, gaps) {
  // sort by where the player most exceeds the team (strengths) and most
  // falls short (risks)
  const sorted = [...gaps].sort((a, b) => b.gap - a.gap);
  const aligned = [...gaps].sort((a, b) => Math.abs(a.gap) - Math.abs(b.gap));

  const topStrength = sorted[0];
  const matched = aligned[0];
  const shortfall = sorted[sorted.length - 1];

  const strengths = [];
  if (topStrength.gap > 6) {
    strengths.push(`${player.name} brings clearly more ${AXIS_LABEL[topStrength.axis]} than ${team.short} currently has — a dimension he upgrades on arrival.`);
  } else {
    strengths.push(`${player.name} matches ${team.short}'s level across the board without a single weak axis — a clean, low-friction profile fit.`);
  }
  strengths.push(`The tightest alignment is ${AXIS_LABEL[matched.axis]} (he sits ${Math.abs(matched.gap)} pts from the team baseline), so that part of the game needs no adjustment.`);

  const risks = [];
  if (shortfall.gap < -8) {
    risks.push(`He trails ${team.short}'s demands on ${AXIS_LABEL[shortfall.axis]} by ${Math.abs(shortfall.gap)} pts — the system would have to cover that gap around him.`);
  } else {
    risks.push(`No axis is a serious mismatch; the main question is role design rather than profile.`);
  }
  if (player.traits.defensiveLoad < team.traits.defensiveLoad - 8) {
    risks.push(`His defensive workload runs below what ${team.short} asks, so the surrounding structure must shield that.`);
  } else if (player.traits.width < team.traits.width - 8) {
    risks.push(`He shouldn't be asked to provide ${team.short}'s width by himself — pair him with an overlapping runner.`);
  } else {
    risks.push(`Against deep blocks his decisive actions need a clear, defined role rather than a roaming brief.`);
  }

  return { strengths, risks };
}

// A player at his current club is a proven fit by definition — the engine
// scores on trait alignment alone, which treats a homegrown player like an
// incoming transfer. isCurrentClub lets us floor the score to a native fit.
function isCurrentClub(player, team) {
  const p = normClubName(player?.team);
  if (!p) return false;
  // Exact match only. The old n.includes(p)/p.includes(n) fallback (meant to
  // catch abbreviations like "Man Utd" vs "Manchester United") never actually
  // caught that case — "manutd" isn't a substring of "manchesterunited" either
  // way — but it DID false-positive on any club whose name is a prefix of
  // another: "Inter" is a substring of "Inter Miami", so selecting Inter Milan
  // for a Inter Miami player (e.g. Messi) got floored to a 89+ "native fit"
  // and the false "already embedded in Inter's system" verdict, even though
  // he's never played for that club. Same risk for Real Madrid/Real Sociedad,
  // Racing Club/Racing Santander, Sporting CP/Sporting Gijón, etc. Exact
  // normalized equality is the only safe test here.
  return [team?.name, team?.short].map(normClubName).filter(Boolean).some(n => n === p);
}

export function buildSystemFitReport(player, team) {
  const detail = fitDetail(player, team, player?._hasStats !== false);
  const score = detail.score;
  // v3: native floor + adaptation-risk haircut are both applied inside
  // fitDetail() now (see there), so `score` above is already final —
  // nothing further to layer on here.
  const nativeClub = detail.nativeClub ?? isCurrentClub(player, team);

  // When we can't honestly score (thin player or unprofiled club), return a
  // report that says so rather than inventing an elite verdict. Role fit
  // doesn't need the destination team's profile at all — it's the player's
  // real traits against positional templates — so it's still worth showing
  // here even when team-aggregate fit can't be computed.
  if (score == null) {
    return {
      generatedAt: new Date().toISOString(),
      player, team,
      score: null,
      verdict: 'Insufficient data',
      note: detail.note,
      rawAlignment: null,
      specialistProfile: null,
      specialistNote: null,
      roleFit: player ? scoreRoleFit(player) : [],
      breakdown: [],
      rolePulse: player?.roleMetrics ? Object.entries(player.roleMetrics).map(([label, value]) => ({ label, value })) : [],
      alternativeFits: TEAM_UNIVERSE
        .map(c => {
          const d = fitDetail(player, c, player?._hasStats !== false);
          return { ...c, score: d.score, verdict: d.score == null ? '—' : verdictFor(d.score) };
        })
        .filter(c => c.score != null)
        .sort((a, b) => b.score - a.score),
      primaryRoles: ROLE_MAP[player?.archetype] ?? ['Hybrid role', 'Flexible starter', 'Rotation option'],
      strengths: [],
      risks: [],
      conclusion: detail.note,
    };
  }

  const gaps = detail.gaps;
  // Breakdown now reflects the REAL dimensional alignment, not score+4.
  //
  // 'Overall Role Compatibility' is NOT a peer input alongside the trait-gap
  // rows below it — it's the weighted RMSD across all six FIT_DIMS (rawFit()
  // in this file), so it's the OUTCOME the other rows explain, not a 5th
  // ingredient. It's kept in the list (now clearly labelled and pinned last)
  // so the summary number is still visible in the same breakdown, but it
  // must never be read as "one more score that happened to come out lower."
  //
  // Defensive workload fit was previously missing entirely from this list —
  // rawFit() weighs defensiveLoad same as the other five dimensions, and a
  // large gap there is often the actual reason the overall score comes out
  // well below its visible sub-scores (e.g. a winger with strong possession/
  // transition/pressing/width alignment but a big defensiveLoad gap vs a
  // high-press team). Without this row, that gap only ever surfaced as prose
  // in the risk flags, never as a number — making the overall score look
  // unexplained next to four strong-looking values.
  //
  // Order matters here: several UI call sites slice this array by a fixed
  // count (report.breakdown.slice(0,5) / slice(0,6)) rather than showing all
  // of it, so the six real fit dimensions (overall + the five trait gaps
  // that feed it) are kept first, with 'Development ceiling' — an age/
  // potential note, not actually part of the fit calculation — pushed last
  // so it's the one that drops off a truncated view, not the new row that
  // was the whole point of this fix.
  const breakdown = [
    ['Overall Role Compatibility (weighted)', score],
    ['Possession value', 100 - Math.abs((player.traits.control ?? 70) - (team.traits.control ?? 70))],
    ['Transition value', 100 - Math.abs((player.traits.transition ?? 70) - (team.traits.transition ?? 70))],
    ['Pressing match', 100 - Math.abs((player.traits.pressing ?? 70) - (team.traits.pressing ?? 70))],
    ['Width fit', 100 - Math.abs((player.traits.width ?? 70) - (team.traits.width ?? 70))],
    ['Defensive workload fit', 100 - Math.abs((player.traits.defensiveLoad ?? 70) - (team.traits.defensiveLoad ?? 70))],
    ['Development ceiling', Math.min(96, player.age <= 23 ? player.rating + 3 : player.rating)],
  ].map(([label, value]) => ({ label, value: Math.max(20, Math.min(99, Math.round(value))) }));

  const alternativeFits = TEAM_UNIVERSE
    .map(candidate => {
      // v3: fitDetail() already applies the native floor / adaptation-risk
      // haircut per candidate, so no floor recompute needed here.
      const d = fitDetail(player, candidate, player?._hasStats !== false);
      return { ...candidate, score: d.score, verdict: d.score == null ? '—' : verdictFor(d.score) };
    })
    .filter(c => c.score != null)
    .sort((a, b) => b.score - a.score);

  const { strengths, risks } = readFromGaps(player, team, gaps);

  // Native conclusion now branches on the RAW alignment, not just the
  // native flag — a player whose alignment has genuinely drifted below the
  // floor threshold gets told so, instead of the same confident "embedded,
  // proven fit" line regardless of how far the underlying numbers have
  // moved (the Isco/Coutinho/Araújo pattern: on the books is not the same
  // evidence as still fitting).
  const conclusion = nativeClub
    ? (detail.rawAlignment < NATIVE_FLOOR_THRESHOLD
        ? `${player.name} is officially part of ${team.short}'s squad, but his underlying trait alignment with the CURRENT system has drifted to ${detail.rawAlignment}/100 — worth reading as a possible role or system mismatch rather than a settled, proven fit.`
        : `${player.name} is already embedded in ${team.short}'s system — this reads as a native, proven fit rather than a projection, which is why the profile grades so highly here.`)
    : score >= 76
    ? `${player.name} improves ${team.short} because the profile changes the attack without breaking the structure — the decisive actions get the right platform.`
    : score >= 64
    ? `${player.name} can work at ${team.short}, but the system would have to bend around his best actions. The talent is clear; the role design is the real question.`
    : `${player.name} is a poor structural fit for ${team.short} as currently set up — the tactical demands pull against his strengths rather than with them.`;

  // Specialist-profile caveat: an outlier trait vector (a pure poacher, a
  // pure destroyer) is exactly the case where trait-overlap-with-the-team
  // is the least trustworthy signal — the honest read depends more on
  // whether a coach builds a specific role around him. Surfaced as its own
  // field so the UI can show it as a caveat rather than burying it in prose.
  const specialistNote = detail.specialistProfile
    ? `${player.name}'s profile is a real outlier for a ${bucketLabel(detail.bucket)} — this score is closer to a role-design question than a like-for-like trait comparison. See "Role fit" below for what specific job actually suits him.`
    : null;

  // Role-template fit: the same weighted comparison, run against this
  // player's positional role templates instead of a specific team's
  // aggregate. Surfaced as its own facet (not folded into the headline
  // score) because a low team-aggregate match doesn't mean a bad fit if a
  // coach is willing to build a specific role around him — the Haaland/Pep
  // point, made concrete instead of left as prose.
  const roleFit = scoreRoleFit(player);

  return {
    generatedAt: new Date().toISOString(),
    player, team, score,
    verdict: verdictFor(score),
    rawAlignment: detail.rawAlignment,
    specialistProfile: detail.specialistProfile,
    specialistNote,
    roleFit,
    breakdown,
    rolePulse: Object.entries(player.roleMetrics).map(([label, value]) => ({ label, value })),
    alternativeFits,
    primaryRoles: ROLE_MAP[player.archetype] ?? ['Hybrid role', 'Flexible starter', 'Rotation option'],
    strengths,
    risks,
    conclusion,
  };
}

// Build a comparison verdict specific to the two archetypes and how the swap
// reshapes the side \u2014 not a generic "grades higher" line.
function comparisonVerdict(primary, challenger, team, first, second) {
  const DIMS = [
    ['control', 'possession control'],
    ['transition', 'vertical transition threat'],
    ['pressing', 'press intensity'],
    ['width', 'natural width'],
    ['tempo', 'ball-circulation tempo'],
    ['defensiveLoad', 'defensive coverage'],
  ];
  const teamName = team.short || team.name;
  const list = arr => arr.map(d => d.phrase).join(' and ');

  if (first.score === second.score) {
    const d = DIMS
      .map(([k, phrase]) => ({ phrase, diff: (challenger.traits[k] ?? 75) - (primary.traits[k] ?? 75) }))
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))[0];
    const leansChallenger = d.diff > 0;
    return `${primary.name} (${primary.archetype}) and ${challenger.name} (${challenger.archetype}) both grade ${first.score}% for ${teamName} \u2014 level on the number, but not interchangeable. ${leansChallenger ? challenger.name : primary.name} pulls the side toward ${d.phrase}; pick the other and ${teamName} keeps its current shape. Same fit, different team.`;
  }

  const challengerWins = second.score > first.score;
  const winner = challengerWins ? challenger : primary;
  const loser = challengerWins ? primary : challenger;
  const wScore = challengerWins ? second.score : first.score;
  const lScore = challengerWins ? first.score : second.score;

  const deltas = DIMS.map(([k, phrase]) => ({ phrase, diff: (winner.traits[k] ?? 75) - (loser.traits[k] ?? 75) }));
  const gains = deltas.filter(d => d.diff >= 4).sort((a, b) => b.diff - a.diff).slice(0, 2);
  const losses = deltas.filter(d => d.diff <= -4).sort((a, b) => a.diff - b.diff).slice(0, 2);

  let s = `${winner.name} (${winner.archetype}) fits ${teamName} better \u2014 ${wScore}% to ${lScore}%`;
  if (gains.length) s += `, adding ${list(gains)}`;
  s += `. `;
  if (losses.length) {
    s += `Picking him over ${loser.name} (${loser.archetype}) costs you ${list(losses)}, so ${teamName} becomes a different side \u2014 more ${gains.length ? gains[0].phrase : winner.archetype.toLowerCase()}, less ${losses[0].phrase}. It changes what the team becomes, not just who plays.`;
  } else {
    s += `He clears ${loser.name} (${loser.archetype}) with no real stylistic trade-off \u2014 a cleaner upgrade than a like-for-like swap.`;
  }
  return s;
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
    verdict: comparisonVerdict(primary, challenger, team, first, second),
  };
}

export function searchLocalTeams(query = '') {
  const needle = query.trim().toLowerCase();
  const pool = TEAM_UNIVERSE;
  if (!needle) return pool.slice(0, 6);
  return pool.filter(team => `${team.name} ${team.country} ${team.league}`.toLowerCase().includes(needle)).slice(0, 12);
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

// ── Role & Formation Fit — real trait-comparison scoring, not fabricated ──
// Reuses the exact same weighted-RMSD comparison the team System Fit score
// runs (see rawFit above), applied to positional role and formation trait
// templates instead of a team's trait profile. A player's traits come from
// playerTraits(player) — the same engine used everywhere else — so these
// numbers are genuinely computed from real stats, just scored against a new,
// explicitly-defined set of tactical templates rather than a specific team.
const ROLE_TEMPLATES_BY_BUCKET = {
  ATT: [
    { role: 'Central Striker', traits: { control: 66, transition: 78, pressing: 62, width: 46, tempo: 74, defensiveLoad: 42 } },
    { role: 'Pressing Forward', traits: { control: 62, transition: 84, pressing: 86, width: 58, tempo: 82, defensiveLoad: 58 } },
    { role: 'False 9', traits: { control: 84, transition: 76, pressing: 60, width: 62, tempo: 84, defensiveLoad: 46 } },
    { role: 'Wide Forward', traits: { control: 70, transition: 88, pressing: 60, width: 90, tempo: 86, defensiveLoad: 40 } },
  ],
  WIDE: [
    { role: 'Winger', traits: { control: 76, transition: 88, pressing: 64, width: 92, tempo: 86, defensiveLoad: 44 } },
    { role: 'Inside Forward', traits: { control: 78, transition: 86, pressing: 62, width: 70, tempo: 84, defensiveLoad: 42 } },
    { role: 'Wide Playmaker', traits: { control: 86, transition: 74, pressing: 58, width: 80, tempo: 82, defensiveLoad: 48 } },
  ],
  MID: [
    { role: 'Box-to-Box Midfielder', traits: { control: 82, transition: 82, pressing: 80, width: 62, tempo: 84, defensiveLoad: 72 } },
    { role: 'Advanced Playmaker', traits: { control: 92, transition: 74, pressing: 58, width: 66, tempo: 86, defensiveLoad: 40 } },
    { role: 'Deep-Lying Playmaker', traits: { control: 92, transition: 62, pressing: 66, width: 56, tempo: 78, defensiveLoad: 68 } },
  ],
  DM: [
    { role: 'Anchor', traits: { control: 78, transition: 50, pressing: 78, width: 42, tempo: 62, defensiveLoad: 92 } },
    { role: 'Ball-Winning Midfielder', traits: { control: 68, transition: 66, pressing: 92, width: 50, tempo: 74, defensiveLoad: 88 } },
    { role: 'Deep-Lying Playmaker', traits: { control: 90, transition: 60, pressing: 66, width: 54, tempo: 76, defensiveLoad: 70 } },
  ],
  FB: [
    { role: 'Wing-Back', traits: { control: 70, transition: 86, pressing: 76, width: 94, tempo: 82, defensiveLoad: 74 } },
    { role: 'Inverted Full-Back', traits: { control: 84, transition: 66, pressing: 78, width: 48, tempo: 78, defensiveLoad: 82 } },
    { role: 'Full-Back', traits: { control: 72, transition: 74, pressing: 78, width: 78, tempo: 74, defensiveLoad: 86 } },
  ],
  DEF: [
    { role: 'Ball-Playing Defender', traits: { control: 82, transition: 56, pressing: 68, width: 40, tempo: 62, defensiveLoad: 90 } },
    { role: 'Stopper', traits: { control: 62, transition: 42, pressing: 74, width: 32, tempo: 52, defensiveLoad: 96 } },
  ],
  GK: [
    { role: 'Sweeper Keeper', traits: { control: 72, transition: 46, pressing: 40, width: 36, tempo: 56, defensiveLoad: 88 } },
    { role: 'Shot-Stopper', traits: { control: 58, transition: 30, pressing: 34, width: 22, tempo: 42, defensiveLoad: 92 } },
  ],
};

const FORMATION_TEMPLATES = [
  { formation: '4-3-3', traits: { control: 78, transition: 80, pressing: 76, width: 74, tempo: 80, defensiveLoad: 66 } },
  { formation: '4-2-3-1', traits: { control: 80, transition: 74, pressing: 72, width: 66, tempo: 78, defensiveLoad: 70 } },
  { formation: '3-4-2-1', traits: { control: 76, transition: 82, pressing: 70, width: 80, tempo: 82, defensiveLoad: 62 } },
  { formation: '4-4-2', traits: { control: 68, transition: 78, pressing: 78, width: 76, tempo: 76, defensiveLoad: 72 } },
  { formation: '3-5-2', traits: { control: 80, transition: 72, pressing: 74, width: 62, tempo: 76, defensiveLoad: 74 } },
];

function playerBucket(player) {
  try { return playerTraits(player)?.bucket || 'MID'; } catch { return 'MID'; }
}

/** Scores the player's real traits against each positional-role template for
 * their bucket (e.g. a striker gets Central Striker / Pressing Forward /
 * False 9 / Wide Forward), using the same weighted-RMSD comparison as team
 * System Fit. Returns roles sorted by fit score, highest first. */
export function scoreRoleFit(player) {
  const { traits } = playerTraits(player);
  const bucket = playerBucket(player);
  const templates = ROLE_TEMPLATES_BY_BUCKET[bucket] || ROLE_TEMPLATES_BY_BUCKET.MID;
  return templates
    .map(t => ({ role: t.role, score: rawFit(traits, t.traits) }))
    .sort((a, b) => b.score - a.score);
}

/** Scores the player's real traits against a fixed set of formation trait
 * templates the same way, returning the top 3 formations by fit score. */
export function scoreFormationFit(player) {
  const { traits } = playerTraits(player);
  return FORMATION_TEMPLATES
    .map(t => ({ formation: t.formation, score: rawFit(traits, t.traits) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}
