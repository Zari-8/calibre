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
  ],
  'Top Tournaments': [
    { name: 'Champions League', country: 'Europe', logo: 'UCL', id: 2, table: false, stage: 'Knockout Stage', hero: 'The highest-pressure club tournament', teams: ['Real Madrid', 'Paris Saint-Germain', 'Bayern München', 'FC Barcelona', 'Inter'], scorerRows: [['K. Mbappé', 'Real Madrid', 11], ['H. Kane', 'Bayern München', 10], ['Raphinha', 'FC Barcelona', 9], ['O. Dembélé', 'PSG', 8], ['L. Martínez', 'Inter', 7]], creatorRows: [['L. Yamal', 'FC Barcelona', 7], ['Vitinha', 'PSG', 6], ['J. Bellingham', 'Real Madrid', 5], ['J. Musiala', 'Bayern München', 5], ['N. Barella', 'Inter', 4]] },
    { name: 'Europa League', country: 'Europe', logo: 'UEL', id: 3, table: false, stage: 'Knockout Stage', hero: 'The tournament for clubs with unfinished business', teams: ['Tottenham', 'Athletic Club', 'Roma', 'Lazio', 'Lyon'], scorerRows: [['N. Williams', 'Athletic Club', 8], ['S. Heung-min', 'Tottenham', 7], ['P. Dybala', 'Roma', 7], ['A. Lacazette', 'Lyon', 6], ['M. Zaccagni', 'Lazio', 6]], creatorRows: [['J. Maddison', 'Tottenham', 6], ['N. Williams', 'Athletic Club', 5], ['P. Dybala', 'Roma', 5], ['R. Cherki', 'Lyon', 5], ['L. Pellegrini', 'Roma', 4]] },
    { name: 'Club World Cup', country: 'World', logo: 'CWC', id: null, table: false, stage: 'Tournament Hub', hero: 'Global club hierarchy under one spotlight', teams: ['Real Madrid', 'Manchester City', 'Flamengo', 'Al-Hilal', 'Mamelodi Sundowns'], scorerRows: [['K. Mbappé', 'Real Madrid', 0], ['E. Haaland', 'Manchester City', 0], ['Pedro', 'Flamengo', 0], ['M. Leonardo', 'Al-Hilal', 0], ['L. Ribeiro', 'Sundowns', 0]], creatorRows: [['J. Bellingham', 'Real Madrid', 0], ['P. Foden', 'Manchester City', 0], ['G. Arrascaeta', 'Flamengo', 0], ['S. Al-Dawsari', 'Al-Hilal', 0], ['T. Zwane', 'Sundowns', 0]] },
    { name: 'Africa Cup of Nations', country: 'Africa', logo: 'AFCON', id: null, table: false, stage: 'Tournament Hub', hero: 'National-team pressure with continental stakes', teams: ['Nigeria', 'Morocco', 'Senegal', 'Egypt', 'Ivory Coast'], scorerRows: [['V. Osimhen', 'Nigeria', 0], ['B. Díaz', 'Morocco', 0], ['S. Mané', 'Senegal', 0], ['M. Salah', 'Egypt', 0], ['S. Haller', 'Ivory Coast', 0]], creatorRows: [['A. Lookman', 'Nigeria', 0], ['A. Hakimi', 'Morocco', 0], ['I. Sarr', 'Senegal', 0], ['M. Salah', 'Egypt', 0], ['S. Adingra', 'Ivory Coast', 0]] },
  ],
  'Domestic Cups': [
    { name: 'FA Cup', country: 'England', logo: 'FAC', id: 45, table: false, stage: 'Cup Rounds', hero: 'One bad night and the season changes', teams: ['Manchester City', 'Arsenal', 'Liverpool', 'Chelsea', 'Manchester United'], scorerRows: [['E. Haaland', 'Manchester City', 5], ['B. Saka', 'Arsenal', 4], ['M. Salah', 'Liverpool', 4], ['C. Palmer', 'Chelsea', 3], ['B. Fernandes', 'Manchester United', 3]], creatorRows: [['K. De Bruyne', 'Manchester City', 4], ['M. Ødegaard', 'Arsenal', 3], ['T. Alexander-Arnold', 'Liverpool', 3], ['C. Palmer', 'Chelsea', 3], ['B. Fernandes', 'Manchester United', 2]] },
    { name: 'Copa del Rey', country: 'Spain', logo: 'CDR', id: 143, table: false, stage: 'Cup Rounds', hero: 'Spanish knockout football, no soft landings', teams: ['FC Barcelona', 'Real Madrid', 'Athletic Club', 'Real Sociedad', 'Atlético Madrid'], scorerRows: [['Raphinha', 'FC Barcelona', 5], ['K. Mbappé', 'Real Madrid', 5], ['N. Williams', 'Athletic Club', 4], ['M. Oyarzabal', 'Real Sociedad', 3], ['J. Álvarez', 'Atlético Madrid', 3]], creatorRows: [['L. Yamal', 'FC Barcelona', 5], ['Pedri', 'FC Barcelona', 4], ['J. Bellingham', 'Real Madrid', 3], ['N. Williams', 'Athletic Club', 3], ['A. Griezmann', 'Atlético Madrid', 3]] },
    { name: 'Coppa Italia', country: 'Italy', logo: 'CIT', id: 137, table: false, stage: 'Cup Rounds', hero: 'Tactical margins with a trophy on the line', teams: ['Inter', 'Juventus', 'AC Milan', 'Atalanta', 'Napoli'], scorerRows: [['L. Martínez', 'Inter', 4], ['D. Vlahović', 'Juventus', 4], ['R. Leão', 'AC Milan', 3], ['A. Lookman', 'Atalanta', 3], ['R. Lukaku', 'Napoli', 3]], creatorRows: [['N. Barella', 'Inter', 3], ['K. Yıldız', 'Juventus', 3], ['C. Pulisic', 'AC Milan', 2], ['C. De Ketelaere', 'Atalanta', 2], ['S. McTominay', 'Napoli', 2]] },
    { name: 'DFB-Pokal', country: 'Germany', logo: 'DFB', id: 81, table: false, stage: 'Cup Rounds', hero: 'German knockout football at full speed', teams: ['Bayern München', 'Bayer Leverkusen', 'Dortmund', 'RB Leipzig', 'Stuttgart'], scorerRows: [['H. Kane', 'Bayern München', 5], ['F. Wirtz', 'Leverkusen', 4], ['S. Guirassy', 'Dortmund', 4], ['L. Openda', 'RB Leipzig', 3], ['D. Undav', 'Stuttgart', 3]], creatorRows: [['F. Wirtz', 'Leverkusen', 4], ['J. Musiala', 'Bayern München', 3], ['J. Brandt', 'Dortmund', 3], ['X. Simons', 'RB Leipzig', 3], ['C. Führich', 'Stuttgart', 2]] },
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
  'Top Tournaments': ['Who owns the Champions League pressure moments?', 'Does the Club World Cup change club hierarchy?', 'Which national-team profile travels best in knockout football?'],
  'Domestic Cups': ['Do cup games still expose squad depth better than league tables?', 'Which giant is most vulnerable to one bad night?', 'Are domestic cups underrated development minutes?'],
  "Women's Football": ['Should women’s football have a separate Calibre benchmark?', 'Which women’s league has the strongest talent pipeline?', 'Who is the next global women’s football superstar?'],
};
