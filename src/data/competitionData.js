const portraits = [
  '/assets/players/kylian-mbappe.jpg',
  '/assets/players/lamine-yamal.jpg',
  '/assets/players/pedri.jpg',
  '/assets/players/vitinha.jpg',
  '/assets/players/florian-wirtz.jpg',
];

function standings(names) {
  return names.map((team, index) => ({
    pos: index + 1,
    team,
    P: 34 - (index % 2),
    W: 24 - index,
    D: 6 + (index % 3),
    L: 4 + index,
    GD: `+${42 - index * 5}`,
    pts: 78 - index * 4,
    form: index % 2 ? ['W', 'D', 'W', 'W', 'L'] : ['W', 'W', 'D', 'W', 'W'],
  }));
}

function scorers(rows) {
  return rows.map(([name, team, goals], index) => ({ pos: index + 1, name, team, goals, img: portraits[index % portraits.length] }));
}

function creators(rows) {
  return rows.map(([name, team, assists], index) => ({ pos: index + 1, name, team, assists, img: portraits[(index + 2) % portraits.length] }));
}

export const COMPETITION_GROUPS = {
  'Top Leagues': [
    { name: 'Premier League', country: 'England', logo: 'ENG', id: 39, table: true, stage: 'Matchday 38', hero: 'The pressure cooker', teams: ['Liverpool', 'Arsenal', 'Manchester City', 'Chelsea', 'Newcastle'], scorerRows: [['E. Haaland', 'Manchester City', 27], ['M. Salah', 'Liverpool', 24], ['A. Isak', 'Newcastle', 21], ['C. Palmer', 'Chelsea', 18], ['B. Saka', 'Arsenal', 16]], creatorRows: [['B. Saka', 'Arsenal', 13], ['K. De Bruyne', 'Manchester City', 12], ['M. Ødegaard', 'Arsenal', 11], ['C. Palmer', 'Chelsea', 10], ['D. Szoboszlai', 'Liverpool', 9]] },
    { name: 'La Liga', country: 'Spain', logo: 'ESP', id: 140, table: true, stage: 'Matchday 38', hero: 'Control, chaos and technical power', teams: ['FC Barcelona', 'Real Madrid', 'Atlético Madrid', 'Athletic Club', 'Real Sociedad'], scorerRows: [['K. Mbappé', 'Real Madrid', 29], ['R. Lewandowski', 'FC Barcelona', 24], ['V. Júnior', 'Real Madrid', 19], ['L. Yamal', 'FC Barcelona', 16], ['J. Álvarez', 'Atlético Madrid', 15]], creatorRows: [['L. Yamal', 'FC Barcelona', 15], ['Pedri', 'FC Barcelona', 11], ['J. Bellingham', 'Real Madrid', 10], ['Raphinha', 'FC Barcelona', 10], ['N. Williams', 'Athletic Club', 9]] },
    { name: 'Bundesliga', country: 'Germany', logo: 'GER', id: 78, table: true, stage: 'Matchday 34', hero: 'Tempo, pressure and transition volume', teams: ['Bayern München', 'Bayer Leverkusen', 'Borussia Dortmund', 'RB Leipzig', 'Eintracht Frankfurt'], scorerRows: [['H. Kane', 'Bayern München', 28], ['S. Guirassy', 'Dortmund', 22], ['V. Boniface', 'Leverkusen', 18], ['L. Openda', 'RB Leipzig', 17], ['J. Musiala', 'Bayern München', 14]], creatorRows: [['F. Wirtz', 'Leverkusen', 14], ['J. Musiala', 'Bayern München', 12], ['X. Simons', 'RB Leipzig', 10], ['J. Brandt', 'Dortmund', 9], ['A. Grimaldo', 'Leverkusen', 9]] },
    { name: 'Serie A', country: 'Italy', logo: 'ITA', id: 135, table: true, stage: 'Matchday 38', hero: 'Structure and tactical leverage', teams: ['Inter', 'Napoli', 'Atalanta', 'Juventus', 'AC Milan'], scorerRows: [['L. Martínez', 'Inter', 22], ['M. Retegui', 'Atalanta', 20], ['D. Vlahović', 'Juventus', 18], ['R. Lukaku', 'Napoli', 16], ['M. Thuram', 'Inter', 15]], creatorRows: [['N. Barella', 'Inter', 11], ['C. Pulisic', 'AC Milan', 10], ['A. Lookman', 'Atalanta', 9], ['K. Kvaratskhelia', 'Napoli', 9], ['T. Koopmeiners', 'Juventus', 8]] },
    { name: 'Ligue 1', country: 'France', logo: 'FRA', id: 61, table: true, stage: 'Matchday 34', hero: 'Youth pipeline and elite upside', teams: ['Paris Saint-Germain', 'Monaco', 'Marseille', 'Lille', 'Lyon'], scorerRows: [['O. Dembélé', 'PSG', 22], ['J. David', 'Lille', 19], ['M. Greenwood', 'Marseille', 18], ['B. Barcola', 'PSG', 15], ['A. Lacazette', 'Lyon', 14]], creatorRows: [['Vitinha', 'PSG', 12], ['O. Dembélé', 'PSG', 11], ['A. Golovin', 'Monaco', 10], ['R. Cherki', 'Lyon', 10], ['E. Zhegrova', 'Lille', 9]] },
    { name: 'Eredivisie', country: 'Netherlands', logo: 'NED', id: 88, table: true, stage: 'Matchday 34', hero: 'Development football with real export value', teams: ['PSV Eindhoven', 'Ajax', 'Feyenoord', 'AZ Alkmaar', 'FC Twente'], scorerRows: [['L. de Jong', 'PSV', 23], ['S. Giménez', 'Feyenoord', 21], ['B. Brobbey', 'Ajax', 18], ['V. Pavlidis', 'AZ', 17], ['R. Pepi', 'PSV', 15]], creatorRows: [['J. Veerman', 'PSV', 13], ['S. Berghuis', 'Ajax', 11], ['C. Stengs', 'Feyenoord', 10], ['Y. Sugawara', 'AZ', 9], ['N. Lang', 'PSV', 8]] },
    { name: 'Belgian Pro League', country: 'Belgium', logo: 'BEL', id: 144, table: true, stage: 'Championship Round', hero: 'A launchpad league for the next move', teams: ['Club Brugge', 'Union SG', 'Genk', 'Anderlecht', 'Gent'], scorerRows: [['T. Arokodare', 'Genk', 20], ['G. Nilsson', 'Club Brugge', 16], ['K. Dolberg', 'Anderlecht', 15], ['M. Amoura', 'Union SG', 14], ['H. Cuypers', 'Gent', 13]], creatorRows: [['H. Vanaken', 'Club Brugge', 12], ['B. El Khannouss', 'Genk', 10], ['C. Puertas', 'Union SG', 9], ['Y. Verschaeren', 'Anderlecht', 8], ['A. Hjulsager', 'Gent', 8]] },

    { name: 'Primeira Liga', country: 'Portugal', logo: 'POR', id: 94, table: true, stage: 'Matchday 34', hero: 'Technical development with a direct route to Europe', teams: ['Sporting CP', 'Benfica', 'Porto', 'Braga', 'Vitória SC'], scorerRows: [['V. Gyökeres', 'Sporting CP', 28], ['S. Pavlidis', 'Benfica', 19], ['Samu Aghehowa', 'Porto', 17], ['Bruma', 'Braga', 14], ['F. Trincão', 'Sporting CP', 12]], creatorRows: [['P. Gonçalves', 'Sporting CP', 12], ['Á. Di María', 'Benfica', 10], ['F. Trincão', 'Sporting CP', 9], ['R. Horta', 'Braga', 8], ['Pepê', 'Porto', 8]] },
    { name: 'Brasileirão Série A', country: 'Brazil', logo: 'BRA', id: 71, table: true, stage: 'League Season', hero: 'South American pressure, talent and tactical invention', teams: ['Flamengo', 'Palmeiras', 'Botafogo', 'Atlético Mineiro', 'Fluminense'], scorerRows: [['Pedro', 'Flamengo', 18], ['Estêvão', 'Palmeiras', 15], ['Tiquinho', 'Botafogo', 14], ['Hulk', 'Atlético Mineiro', 13], ['J. Arias', 'Fluminense', 11]], creatorRows: [['G. Arrascaeta', 'Flamengo', 12], ['Raphael Veiga', 'Palmeiras', 10], ['J. Arias', 'Fluminense', 10], ['Luiz Henrique', 'Botafogo', 8], ['Paulinho', 'Atlético Mineiro', 8]] },
  ],
  'Top Tournaments': [
    { name: 'Champions League', country: 'Europe', logo: 'UCL', id: 2, table: false, stage: 'Knockout Stage', hero: 'The highest-pressure club tournament', teams: ['Real Madrid', 'Paris Saint-Germain', 'Bayern München', 'FC Barcelona', 'Inter'], scorerRows: [['K. Mbappé', 'Real Madrid', 11], ['H. Kane', 'Bayern München', 10], ['Raphinha', 'FC Barcelona', 9], ['O. Dembélé', 'PSG', 8], ['L. Martínez', 'Inter', 7]], creatorRows: [['L. Yamal', 'FC Barcelona', 7], ['Vitinha', 'PSG', 6], ['J. Bellingham', 'Real Madrid', 5], ['J. Musiala', 'Bayern München', 5], ['N. Barella', 'Inter', 4]] },
    { name: 'Europa League', country: 'Europe', logo: 'UEL', id: 3, table: false, stage: 'Knockout Stage', hero: 'The tournament for clubs with unfinished business', teams: ['Tottenham', 'Athletic Club', 'Roma', 'Lazio', 'Lyon'], scorerRows: [['N. Williams', 'Athletic Club', 8], ['S. Heung-min', 'Tottenham', 7], ['P. Dybala', 'Roma', 7], ['A. Lacazette', 'Lyon', 6], ['M. Zaccagni', 'Lazio', 6]], creatorRows: [['J. Maddison', 'Tottenham', 6], ['N. Williams', 'Athletic Club', 5], ['P. Dybala', 'Roma', 5], ['R. Cherki', 'Lyon', 5], ['L. Pellegrini', 'Roma', 4]] },
    { name: 'Europa Conference League', country: 'Europe', logo: 'UECL', id: 848, table: false, stage: 'Knockout Stage', hero: 'European nights for clubs building the next chapter', teams: ['Chelsea', 'Fiorentina', 'Real Betis', 'Rapid Wien', 'Djurgården'], scorerRows: [['N. Jackson', 'Chelsea', 7], ['M. Kean', 'Fiorentina', 6], ['Isco', 'Real Betis', 5], ['D. Beljo', 'Rapid Wien', 5], ['T. Gulliksen', 'Djurgården', 4]], creatorRows: [['C. Palmer', 'Chelsea', 5], ['Isco', 'Real Betis', 5], ['R. Sottil', 'Fiorentina', 4], ['M. Seidl', 'Rapid Wien', 4], ['T. Gulliksen', 'Djurgården', 3]] },
    { name: 'Copa Libertadores', country: 'South America', logo: 'LIB', id: 13, table: false, stage: 'Continental Tournament', hero: 'South American club football at its most intense', teams: ['Flamengo', 'Palmeiras', 'River Plate', 'Boca Juniors', 'Botafogo'], scorerRows: [['Pedro', 'Flamengo', 7], ['Estêvão', 'Palmeiras', 6], ['M. Borja', 'River Plate', 6], ['E. Cavani', 'Boca Juniors', 5], ['Tiquinho', 'Botafogo', 5]], creatorRows: [['G. Arrascaeta', 'Flamengo', 6], ['Raphael Veiga', 'Palmeiras', 5], ['N. de la Cruz', 'River Plate', 4], ['K. Zenón', 'Boca Juniors', 4], ['Luiz Henrique', 'Botafogo', 4]] },
    { name: 'CAF Champions League', country: 'Africa', logo: 'CAF', id: 12, table: false, stage: 'Continental Tournament', hero: 'Africa’s elite clubs under continental pressure', teams: ['Al Ahly', 'Mamelodi Sundowns', 'Espérance', 'Wydad AC', 'TP Mazembe'], scorerRows: [['W. Abou Ali', 'Al Ahly', 6], ['L. Ribeiro', 'Mamelodi Sundowns', 5], ['Y. Belaili', 'Espérance', 5], ['M. Ounajem', 'Wydad AC', 4], ['F. Mayele', 'TP Mazembe', 4]], creatorRows: [['E. Ashour', 'Al Ahly', 5], ['T. Zwane', 'Mamelodi Sundowns', 4], ['Y. Belaili', 'Espérance', 4], ['A. El Amloud', 'Wydad AC', 3], ['G. Likonza', 'TP Mazembe', 3]] },
    { name: 'Club World Cup', country: 'World', logo: 'CWC', id: null, table: false, stage: 'Tournament Hub', hero: 'Global club hierarchy under one spotlight', teams: ['Real Madrid', 'Manchester City', 'Flamengo', 'Al-Hilal', 'Mamelodi Sundowns'], scorerRows: [['K. Mbappé', 'Real Madrid', 0], ['E. Haaland', 'Manchester City', 0], ['Pedro', 'Flamengo', 0], ['M. Leonardo', 'Al-Hilal', 0], ['L. Ribeiro', 'Sundowns', 0]], creatorRows: [['J. Bellingham', 'Real Madrid', 0], ['P. Foden', 'Manchester City', 0], ['G. Arrascaeta', 'Flamengo', 0], ['S. Al-Dawsari', 'Al-Hilal', 0], ['T. Zwane', 'Sundowns', 0]] },
  ],
  'Domestic Cups': [
    { name: 'FA Cup', country: 'England', logo: 'FAC', id: 45, table: false, stage: 'Cup Rounds', hero: 'One bad night and the season changes', teams: ['Manchester City', 'Arsenal', 'Liverpool', 'Chelsea', 'Manchester United'], scorerRows: [['E. Haaland', 'Manchester City', 5], ['B. Saka', 'Arsenal', 4], ['M. Salah', 'Liverpool', 4], ['C. Palmer', 'Chelsea', 3], ['B. Fernandes', 'Manchester United', 3]], creatorRows: [['K. De Bruyne', 'Manchester City', 4], ['M. Ødegaard', 'Arsenal', 3], ['T. Alexander-Arnold', 'Liverpool', 3], ['C. Palmer', 'Chelsea', 3], ['B. Fernandes', 'Manchester United', 2]] },
    { name: 'Copa del Rey', country: 'Spain', logo: 'CDR', id: 143, table: false, stage: 'Cup Rounds', hero: 'Spanish knockout football, no soft landings', teams: ['FC Barcelona', 'Real Madrid', 'Athletic Club', 'Real Sociedad', 'Atlético Madrid'], scorerRows: [['Raphinha', 'FC Barcelona', 5], ['K. Mbappé', 'Real Madrid', 5], ['N. Williams', 'Athletic Club', 4], ['M. Oyarzabal', 'Real Sociedad', 3], ['J. Álvarez', 'Atlético Madrid', 3]], creatorRows: [['L. Yamal', 'FC Barcelona', 5], ['Pedri', 'FC Barcelona', 4], ['J. Bellingham', 'Real Madrid', 3], ['N. Williams', 'Athletic Club', 3], ['A. Griezmann', 'Atlético Madrid', 3]] },
    { name: 'Coppa Italia', country: 'Italy', logo: 'CIT', id: 137, table: false, stage: 'Cup Rounds', hero: 'Tactical margins with a trophy on the line', teams: ['Inter', 'Juventus', 'AC Milan', 'Atalanta', 'Napoli'], scorerRows: [['L. Martínez', 'Inter', 4], ['D. Vlahović', 'Juventus', 4], ['R. Leão', 'AC Milan', 3], ['A. Lookman', 'Atalanta', 3], ['R. Lukaku', 'Napoli', 3]], creatorRows: [['N. Barella', 'Inter', 3], ['K. Yıldız', 'Juventus', 3], ['C. Pulisic', 'AC Milan', 2], ['C. De Ketelaere', 'Atalanta', 2], ['S. McTominay', 'Napoli', 2]] },
    { name: 'DFB-Pokal', country: 'Germany', logo: 'DFB', id: 81, table: false, stage: 'Cup Rounds', hero: 'German knockout football at full speed', teams: ['Bayern München', 'Bayer Leverkusen', 'Dortmund', 'RB Leipzig', 'Stuttgart'], scorerRows: [['H. Kane', 'Bayern München', 5], ['F. Wirtz', 'Leverkusen', 4], ['S. Guirassy', 'Dortmund', 4], ['L. Openda', 'RB Leipzig', 3], ['D. Undav', 'Stuttgart', 3]], creatorRows: [['F. Wirtz', 'Leverkusen', 4], ['J. Musiala', 'Bayern München', 3], ['J. Brandt', 'Dortmund', 3], ['X. Simons', 'RB Leipzig', 3], ['C. Führich', 'Stuttgart', 2]] },

    { name: 'Coupe de France', country: 'France', logo: 'CDF', id: 66, table: false, stage: 'Cup Rounds', hero: 'French knockout football with no protection for the favourites', teams: ['Paris Saint-Germain', 'Marseille', 'Lyon', 'Monaco', 'Lille'], scorerRows: [['O. Dembélé', 'PSG', 5], ['M. Greenwood', 'Marseille', 4], ['R. Cherki', 'Lyon', 4], ['B. Embolo', 'Monaco', 3], ['J. David', 'Lille', 3]], creatorRows: [['Vitinha', 'PSG', 4], ['A. Golovin', 'Monaco', 3], ['R. Cherki', 'Lyon', 3], ['M. Greenwood', 'Marseille', 2], ['E. Zhegrova', 'Lille', 2]] },
    { name: 'KNVB Cup', country: 'Netherlands', logo: 'KNVB', id: 90, table: false, stage: 'Cup Rounds', hero: 'Dutch knockout football, development pressure included', teams: ['PSV Eindhoven', 'Ajax', 'Feyenoord', 'AZ Alkmaar', 'FC Twente'], scorerRows: [['R. Pepi', 'PSV', 5], ['B. Brobbey', 'Ajax', 4], ['S. Giménez', 'Feyenoord', 4], ['V. Pavlidis', 'AZ', 3], ['S. Steijn', 'FC Twente', 3]], creatorRows: [['J. Veerman', 'PSV', 4], ['S. Berghuis', 'Ajax', 3], ['C. Stengs', 'Feyenoord', 3], ['Y. Sugawara', 'AZ', 2], ['M. Vlap', 'FC Twente', 2]] },
    { name: 'Belgian Cup', country: 'Belgium', logo: 'BEC', id: 147, table: false, stage: 'Cup Rounds', hero: 'Belgian knockout football and pathway pressure', teams: ['Club Brugge', 'Union SG', 'Genk', 'Anderlecht', 'Gent'], scorerRows: [['T. Arokodare', 'Genk', 5], ['G. Nilsson', 'Club Brugge', 4], ['K. Dolberg', 'Anderlecht', 4], ['M. Amoura', 'Union SG', 3], ['H. Cuypers', 'Gent', 3]], creatorRows: [['H. Vanaken', 'Club Brugge', 4], ['B. El Khannouss', 'Genk', 3], ['C. Puertas', 'Union SG', 3], ['Y. Verschaeren', 'Anderlecht', 2], ['A. Hjulsager', 'Gent', 2]] },
    { name: 'Taça de Portugal', country: 'Portugal', logo: 'TDP', id: 96, table: false, stage: 'Cup Rounds', hero: 'Portuguese cup football with export-market pressure', teams: ['Sporting CP', 'Benfica', 'Porto', 'Braga', 'Vitória SC'], scorerRows: [['V. Gyökeres', 'Sporting CP', 6], ['S. Pavlidis', 'Benfica', 5], ['Samu Aghehowa', 'Porto', 4], ['Bruma', 'Braga', 3], ['J. Mendes', 'Vitória SC', 3]], creatorRows: [['P. Gonçalves', 'Sporting CP', 4], ['Á. Di María', 'Benfica', 4], ['F. Trincão', 'Sporting CP', 3], ['R. Horta', 'Braga', 3], ['Pepê', 'Porto', 2]] },
    { name: 'Copa do Brasil', country: 'Brazil', logo: 'CDB', id: 73, table: false, stage: 'Cup Rounds', hero: 'Brazilian knockout football with continental-level pressure', teams: ['Flamengo', 'Palmeiras', 'Botafogo', 'Atlético Mineiro', 'Fluminense'], scorerRows: [['Pedro', 'Flamengo', 6], ['Estêvão', 'Palmeiras', 5], ['Tiquinho', 'Botafogo', 4], ['Hulk', 'Atlético Mineiro', 4], ['J. Arias', 'Fluminense', 3]], creatorRows: [['G. Arrascaeta', 'Flamengo', 5], ['Raphael Veiga', 'Palmeiras', 4], ['J. Arias', 'Fluminense', 4], ['Luiz Henrique', 'Botafogo', 3], ['Paulinho', 'Atlético Mineiro', 3]] },
  ],
  "Women's Football": [
    { name: "Women's Super League", country: 'England', logo: 'WSL', id: null, table: false, stage: 'League Hub', hero: 'The English women’s game under a bigger spotlight', teams: ['Chelsea Women', 'Arsenal Women', 'Manchester City Women', 'Manchester United Women', 'Brighton Women'], scorerRows: [['K. Shaw', 'Manchester City Women', 19], ['A. Russo', 'Arsenal Women', 16], ['L. James', 'Chelsea Women', 14], ['E. Toone', 'Manchester United Women', 11], ['N. Parris', 'Brighton Women', 10]], creatorRows: [['L. Hemp', 'Manchester City Women', 12], ['C. Reiten', 'Chelsea Women', 11], ['B. Mead', 'Arsenal Women', 10], ['E. Toone', 'Manchester United Women', 9], ['F. Kirby', 'Brighton Women', 8]] },
    { name: "Women's Champions League", country: 'Europe', logo: 'UWCL', id: null, table: false, stage: 'Knockout Stage', hero: 'Europe’s elite women’s clubs, same pressure', teams: ['FC Barcelona Femení', 'Chelsea Women', 'Lyon Féminin', 'Arsenal Women', 'Bayern Women'], scorerRows: [['A. Putellas', 'Barcelona Femení', 8], ['C. Graham Hansen', 'Barcelona Femení', 7], ['L. James', 'Chelsea Women', 6], ['K. Diani', 'Lyon Féminin', 6], ['A. Russo', 'Arsenal Women', 5]], creatorRows: [['A. Bonmatí', 'Barcelona Femení', 7], ['C. Graham Hansen', 'Barcelona Femení', 6], ['C. Reiten', 'Chelsea Women', 5], ['D. Marozsán', 'Lyon Féminin', 5], ['B. Mead', 'Arsenal Women', 4]] },
    { name: 'Liga F', country: 'Spain', logo: 'LIGAF', id: null, table: false, stage: 'League Hub', hero: 'Technical dominance and the Barcelona benchmark', teams: ['FC Barcelona Femení', 'Real Madrid Femenino', 'Atlético Femenino', 'Levante Women', 'Real Sociedad Women'], scorerRows: [['E. Pajor', 'Barcelona Femení', 22], ['A. Putellas', 'Barcelona Femení', 17], ['L. Caicedo', 'Real Madrid Femenino', 14], ['S. Ajibade', 'Atlético Femenino', 12], ['N. Eizagirre', 'Real Sociedad Women', 10]], creatorRows: [['A. Bonmatí', 'Barcelona Femení', 15], ['C. Graham Hansen', 'Barcelona Femení', 13], ['L. Caicedo', 'Real Madrid Femenino', 10], ['S. Ajibade', 'Atlético Femenino', 8], ['N. Eizagirre', 'Real Sociedad Women', 7]] },
    { name: 'NWSL', country: 'United States', logo: 'NWSL', id: null, table: false, stage: 'League Hub', hero: 'Athletic depth, parity and major-market energy', teams: ['Orlando Pride', 'Washington Spirit', 'Portland Thorns', 'Gotham FC', 'Kansas City Current'], scorerRows: [['B. Banda', 'Orlando Pride', 18], ['T. Rodman', 'Washington Spirit', 14], ['S. Smith', 'Portland Thorns', 13], ['E. González', 'Gotham FC', 12], ['T. Chawinga', 'Kansas City Current', 11]], creatorRows: [['M. Marta', 'Orlando Pride', 10], ['T. Rodman', 'Washington Spirit', 9], ['S. Smith', 'Portland Thorns', 8], ['R. Lavelle', 'Gotham FC', 8], ['D. DiBernardo', 'Kansas City Current', 7]] },
  ],
};

export function snapshotFor(competition) {
  return {
    standings: standings(competition.teams),
    scorers: scorers(competition.scorerRows),
    creators: creators(competition.creatorRows),
  };
}

export const COMPETITION_DEBATES = {
  'Top Leagues': ['Is the Premier League still the best league, or simply the loudest?', 'Does La Liga still produce the smartest midfielders?', 'Which league is Europe sleeping on?'],
  'Top Tournaments': ['Who owns the Champions League pressure moments?', 'Does the Club World Cup change club hierarchy?', 'Which continental competition produces the hardest away nights?'],
  'Domestic Cups': ['Do cup games still expose squad depth better than league tables?', 'Which giant is most vulnerable to one bad night?', 'Are domestic cups underrated development minutes?'],
  "Women's Football": ['Should women’s football have a separate Calibre benchmark?', 'Which women’s league has the strongest talent pipeline?', 'Who is the next global women’s football superstar?'],
};

const MATCH_OVERRIDES = {
  'Premier League': {
    home: 'Arsenal', away: 'Liverpool', competition: 'Premier League', badge: 'FEATURED LEAGUE MATCH',
    homeShape: '4-3-3', awayShape: '4-2-3-1', kickoff: 'Kick-off loads from live fixture feed',
    headline: 'Can Arsenal protect the centre without losing their press?',
    pregame: 'This is a control-versus-transition game. Arsenal want the match pinned in Liverpool territory. Liverpool want the first clean escape to turn into a sprint at the back line.',
    keyDuel: 'Arsenal left interior vs Liverpool right-sided press escape', tempo: 'High', xg: '2.7 combined', btts: 'Live context', threat: 'Transition-heavy',
  },
  'La Liga': {
    home: 'FC Barcelona', away: 'Real Madrid', competition: 'La Liga', badge: 'FEATURED CLÁSICO MODEL',
    homeShape: '4-3-3', awayShape: '4-3-1-2', kickoff: 'Kick-off loads from live fixture feed',
    headline: 'Does control survive the first Madrid counter?',
    pregame: 'Barcelona want to own the ball and squeeze the pitch. Madrid do not need long spells. They need one broken line and one clean runway. The argument is not possession. It is whether possession becomes protection.',
    keyDuel: 'Barcelona rest defence vs Madrid transition runners', tempo: 'Elastic', xg: '3.1 combined', btts: 'Strong context', threat: 'Space behind the line',
  },
  'Champions League': {
    home: 'Paris Saint-Germain', away: 'Real Madrid', competition: 'Champions League', badge: 'FEATURED KNOCKOUT MATCH',
    homeShape: '4-3-3', awayShape: '4-3-1-2', kickoff: 'Kick-off loads from live fixture feed',
    headline: 'Who controls the pressure moments when the game stops behaving?',
    pregame: 'PSG want to make the ball move faster than the pressure. Madrid are comfortable waiting for the game to become unstable. The match could be decided by which midfield survives the first twenty minutes without losing its nerve.',
    keyDuel: 'PSG controller zone vs Madrid second-wave runners', tempo: 'High variance', xg: '2.9 combined', btts: 'Strong context', threat: 'Late box arrivals',
  },
  "Women's Super League": {
    home: 'Chelsea Women', away: 'Arsenal Women', competition: "Women's Super League", badge: 'FEATURED WSL MATCH',
    homeShape: '4-2-3-1', awayShape: '4-3-3', kickoff: 'Kick-off loads from live fixture feed',
    headline: 'Can Arsenal play through the first wave without giving Chelsea the game state?',
    pregame: 'Chelsea want pressure, turnovers and repeat attacks. Arsenal want the match slowed down enough for their creators to find the second action. The first clean midfield exit matters more than the first shot.',
    keyDuel: 'Arsenal build-up exit vs Chelsea counterpress', tempo: 'Fast', xg: '2.5 combined', btts: 'Live context', threat: 'Counterpress recoveries',
  },
};

function slugify(value = '') {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function featuredMatchFor(competition) {
  const fallback = MATCH_OVERRIDES[competition.name] || {
    home: competition.teams[0], away: competition.teams[1], competition: competition.name,
    badge: 'FEATURED MATCH PREVIEW', homeShape: '4-3-3', awayShape: '4-2-3-1',
    kickoff: 'Kick-off loads from live fixture feed',
    headline: `Where does ${competition.name} create its decisive advantage?`,
    pregame: 'The featured-match layer turns the competition hub into a conversation page. It frames the tactical question before kick-off and keeps the same thread alive after full time.',
    keyDuel: 'Central progression vs transition protection', tempo: 'Model pending', xg: 'API pending', btts: 'API pending', threat: 'API pending',
  };
  return { ...fallback, slug: slugify(`${fallback.competition}-${fallback.home}-${fallback.away}`), source: 'snapshot' };
}
