export type Player = {
  id: string;
  name: string;
  club: string;
  nation: string;
  age: number;
  role: string;
  archetype: string;
  icon: string;
  control: number;
  impact: number;
  creation: number;
  pressing: number;
  box: number;
  transition: number;
  verdict: string;
};

export const players: Player[] = [
  { id:'pedri', name:'Pedri', club:'Barcelona', nation:'Spain', age:23, role:'Interior / Controller', archetype:'Puppeteer', icon:'🧵', control:96, impact:78, creation:91, pressing:73, box:58, transition:76, verdict:'Pedri does his damage before the highlight. He protects the system, cleans the rhythm, and makes chaos look unnecessary.' },
  { id:'bellingham', name:'Jude Bellingham', club:'Real Madrid', nation:'England', age:22, role:'Box-crashing 8/10', archetype:'Meteor', icon:'☄️', control:80, impact:95, creation:83, pressing:86, box:94, transition:90, verdict:'Jude attacks the game. He turns pressure into arrivals, and arrivals into scorelines.' },
  { id:'vini', name:'Vinícius Jr', club:'Real Madrid', nation:'Brazil', age:25, role:'Left-sided chaos winger', archetype:'Dagger', icon:'🗡️', control:66, impact:94, creation:87, pressing:72, box:84, transition:96, verdict:'Vini breaks structure. He does not just beat his man; he makes the whole defensive plan start lying.' },
  { id:'mbappe', name:'Kylian Mbappé', club:'Real Madrid', nation:'France', age:27, role:'Elite space punisher', archetype:'Fox', icon:'🦊', control:63, impact:97, creation:79, pressing:61, box:95, transition:98, verdict:'Mbappé punishes space. The danger is not always in the dribble. Sometimes it is in the second you lose body position.' },
  { id:'yamal', name:'Lamine Yamal', club:'Barcelona', nation:'Spain', age:18, role:'Wide creator', archetype:'Paintbrush', icon:'🎨', control:84, impact:89, creation:95, pressing:70, box:76, transition:88, verdict:'Yamal is already bending defensive choices. The pass, the pause, the shot threat — defenders are guessing before he moves.' },
  { id:'wirtz', name:'Florian Wirtz', club:'Bayer Leverkusen', nation:'Germany', age:23, role:'Advanced playmaker', archetype:'Magic Wand', icon:'🪄', control:88, impact:88, creation:93, pressing:78, box:79, transition:86, verdict:'Wirtz connects imagination to execution. He is not just creative; he makes the final third feel pre-solved.' },
  { id:'bonmati', name:'Aitana Bonmatí', club:'Barcelona Femeni', nation:'Spain', age:28, role:'Controller / creator', archetype:'Puppeteer', icon:'🧵', control:97, impact:86, creation:95, pressing:82, box:72, transition:80, verdict:'Aitana is control with incision. She does not dominate by volume alone; she changes the angle of the game.' },
  { id:'caicedo', name:'Linda Caicedo', club:'Real Madrid Femenino', nation:'Colombia', age:21, role:'Inside forward', archetype:'Dagger', icon:'🗡️', control:74, impact:90, creation:85, pressing:76, box:84, transition:92, verdict:'Linda carries threat like a live wire. Give her a broken defensive shape and she turns it into panic.' },
  { id:'osimhen', name:'Victor Osimhen', club:'Galatasaray', nation:'Nigeria', age:27, role:'Vertical striker', archetype:'Lighthouse', icon:'🔦', control:55, impact:91, creation:62, pressing:82, box:96, transition:88, verdict:'Osimhen changes how a back line breathes. Even when he is not scoring, defenders are managing fear.' }
];

export const debates = [
  { title:'Hot Potato of the Week', question:'Should women footballers get equal pay?', heat:94, verdict:'The lazy answer is “same revenue, same pay.” The better question is whether federations are rewarding performance, history, market creation, or institutional neglect.' },
  { title:'GOAT War', question:'Messi vs Ronaldo: peak, longevity, or total football?', heat:99, verdict:'Goals matter. Creation matters. Finals matter. But the real argument is attacking gravity: how much of the whole game bent around one player.' },
  { title:'System Trial', question:'Is ter Stegen truly finished?', heat:83, verdict:'Keeper decline is not only shot-stopping. It is confidence, build-up risk, defensive line height, and whether the system still trusts the first pass.' },
  { title:'Legacy Trial', question:'Rodri vs Busquets: who owns the 6?', heat:90, verdict:'Rodri gives you domination with duel power. Busquets gave you control by erasing danger before it looked like danger.' }
];

export const competitions = [
  { name:'World Cup', signal:'Breakout player watch', teams:'Brazil, Spain, France, Nigeria, Colombia', verdict:'The tournament will not just crown stars. It will reprice them.' },
  { name:'Champions League', signal:'System-fit pressure', teams:'Madrid, City, Barça, Bayern', verdict:'The knockout rounds expose who is platformed by structure and who survives without it.' },
  { name:'AFCON pipeline', signal:'Talent market heat', teams:'Nigeria, Senegal, Morocco, Ghana', verdict:'European clubs are not just buying players. They are buying physical profiles the market still undervalues.' }
];

export const talents = [
  { name:'Lamine Yamal', region:'Europe', category:'Creator', gender:'Men', upside:98, note:'Already elite at bending defensive choices.' },
  { name:'Linda Caicedo', region:'South America', category:'Inside Forward', gender:'Women', upside:94, note:'Explosive, direct, and dangerous in broken games.' },
  { name:'Clinton Jephta', region:'Africa', category:'Wide Threat', gender:'Men', upside:82, note:'Prototype slot for African scouting pipeline.' },
  { name:'Rinsola Babajide', region:'Africa', category:'Forward', gender:'Women', upside:84, note:'Nigeria-first traction angle with women’s football inclusion.' },
  { name:'Endrick', region:'South America', category:'Striker', gender:'Men', upside:91, note:'Still more projection than proof, but the tools are loud.' },
  { name:'Vicky López', region:'Europe', category:'Creator', gender:'Women', upside:90, note:'Technical separator with Barça ecosystem advantage.' }
];

export function getPlayer(id: string) {
  return players.find(p => p.id === id) ?? players[0];
}

export function compareVerdict(a: Player, b: Player) {
  const gapControl = a.control - b.control;
  const gapImpact = a.impact - b.impact;
  if (Math.abs(gapControl) > Math.abs(gapImpact)) {
    return `${a.name} vs ${b.name} is really a control question. ${gapControl > 0 ? a.name : b.name} gives the system more rhythm protection. ${gapControl > 0 ? b.name : a.name} may still create the louder moments, but the game changes shape depending on which problem you want solved.`;
  }
  return `${a.name} vs ${b.name} is not just a talent argument. ${gapImpact > 0 ? a.name : b.name} bends the scoreline harder. ${gapImpact > 0 ? b.name : a.name} may give you more structure, but one profile attacks the game while the other stabilizes it.`;
}
