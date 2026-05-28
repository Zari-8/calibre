import { calculateCalibreRating, getNextStepProjection } from "./calibreEngine.js";

const rawPlayers = [
  { name: "Pedri", club: "Barcelona", league: "La Liga", age: 23, archetype: "Controller", performance: 88, consistency: 91, form: 84, impact: 78, trajectory: 82, marketBuzz: 90, minutesShare: 78 },
  { name: "Jude Bellingham", club: "Real Madrid", league: "La Liga", age: 22, archetype: "Box Crasher", performance: 90, consistency: 86, form: 88, impact: 92, trajectory: 85, marketBuzz: 96, minutesShare: 82 },
  { name: "Anthony Gordon", club: "Newcastle", league: "Premier League", age: 25, archetype: "Wide Transition Runner", performance: 82, consistency: 78, form: 86, impact: 80, trajectory: 77, marketBuzz: 79, minutesShare: 74 },
  { name: "Lamine Yamal", club: "Barcelona", league: "La Liga", age: 18, archetype: "Wide Creator", performance: 86, consistency: 78, form: 88, impact: 83, trajectory: 96, marketBuzz: 98, minutesShare: 67 },
  { name: "João Neves", club: "PSG", league: "Ligue 1", age: 21, archetype: "Deep-Lying Playmaker", performance: 84, consistency: 86, form: 83, impact: 72, trajectory: 88, marketBuzz: 84, minutesShare: 71 },
  { name: "Divine Mukasa", club: "Man City U21", league: "Premier League", age: 18, archetype: "Advanced Playmaker", performance: 73, consistency: 65, form: 79, impact: 66, trajectory: 89, marketBuzz: 69, minutesShare: 33 },
  { name: "Daniel Daga", club: "Enyimba", league: "NPFL", age: 18, archetype: "Pressing Engine", performance: 82, consistency: 76, form: 81, impact: 71, trajectory: 90, marketBuzz: 62, minutesShare: 66 },
  { name: "Bill Antonio", club: "KV Mechelen", league: "Belgian Pro League", age: 22, archetype: "Inside Forward", performance: 74, consistency: 70, form: 76, impact: 73, trajectory: 81, marketBuzz: 58, minutesShare: 51 }
];

export const players = rawPlayers.map(player => {
  const calibreRating = calculateCalibreRating(player);
  return { ...player, calibreRating, nextStep: getNextStepProjection({ ...player, calibreRating }) };
});

export const battles = [
  { a: players[0], b: players[1], question: "Who owns the midfield?", votes: 12458 },
  { a: players[3], b: players[1], question: "Who carries the next era?", votes: 24700 },
  { a: players[4], b: players[0], question: "Who controls pressure better?", votes: 18300 }
];

export const leagues = [
  { name: "Premier League", country: "England", multiplier: 1.00, players: 18420, debateHeat: 96, topPlayer: "Haaland" },
  { name: "La Liga", country: "Spain", multiplier: 0.99, players: 16110, debateHeat: 94, topPlayer: "Bellingham" },
  { name: "Serie A", country: "Italy", multiplier: 0.97, players: 14280, debateHeat: 87, topPlayer: "Lautaro" },
  { name: "Bundesliga", country: "Germany", multiplier: 0.98, players: 13990, debateHeat: 86, topPlayer: "Musiala" },
  { name: "NPFL", country: "Nigeria", multiplier: 0.68, players: 3560, debateHeat: 74, topPlayer: "Daniel Daga" },
  { name: "Zimbabwe PSL", country: "Zimbabwe", multiplier: 0.62, players: 1480, debateHeat: 63, topPlayer: "Rising U21" },
  { name: "WSL", country: "England", multiplier: 0.82, players: 2150, debateHeat: 79, topPlayer: "Lauren James" }
];

export const archetypes = [
  { name: "Controller", icon: "♟", meaning: "tempo, press resistance, circulation" },
  { name: "Deep-Lying Playmaker", icon: "⌁", meaning: "metronome passing and build-up control" },
  { name: "Advanced Playmaker", icon: "✦", meaning: "final-third invention" },
  { name: "Pressing Engine", icon: "🚂", meaning: "volume, intensity, defensive disruption" },
  { name: "Inside Forward", icon: "†", meaning: "wide threat into goal zones" },
  { name: "Target Man", icon: "⌂", meaning: "aerial dominance and reference play" },
  { name: "False Nine", icon: "◭", meaning: "drops, links and manipulates centre-backs" },
  { name: "Poacher", icon: "🦊", meaning: "box movement and finishing economy" }
];

export const apiStatus = {
  mode: "local mock data",
  note: "Swap mockData.js for API calls when keys are ready. The UI and routing stay the same."
};
