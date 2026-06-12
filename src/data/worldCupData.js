/**
 * World Cup Data
 * ─────────────────────────────────────────────────────────────────
 * Admin-friendly data structure. Update these arrays to curate
 * content without touching any React code.
 *
 * WORLD CUP 2026: USA / Canada / Mexico — June 11 to July 19, 2026
 * NAV APPEARS: 7 days before kickoff (June 4, 2026)
 */

// ── CONFIG ────────────────────────────────────────────────────────
export const WC_CONFIG = {
  kickoff:      '2026-06-11T18:00:00Z',
  navThreshold: 7,
  edition:      'FIFA World Cup 2026',
  hosts:        ['USA', 'Canada', 'Mexico'],
};

// ── LIVE MOMENTS ─────────────────────────────────────────────────
// Admin: add objects here to populate the live feed.
export const liveMoments = [
  {
    id:       'moment-001',
    time:     '2026-06-11T20:14:00Z',
    match:    'Mexico vs Ecuador',
    label:    'GOAL',
    text:     'Raul Jimenez opens the tournament with a towering header. 1-0.',
    type:     'goal',
    featured: true,
  },
];

// ── BREAKOUT STARS ────────────────────────────────────────────────
export const breakoutStars = [
  {
    id:       'bs-001',
    name:     'Lamine Yamal',
    apiPlayerId: 386828,
    age:      18,
    nation:   'Spain',
    flag:     '🇪🇸',
    role:     'Wide Creator',
    club:     'FC Barcelona',
    image:    '/assets/players/lamine-yamal.jpg',
    wcRating: 91,
    trend:    '+9',
    matches:  2,
    goals:    1,
    assists:  3,
    note:     'Already the most dangerous wide player in the tournament. Defenders have no answer.',
    featured: true,
  },
  {
    id:       'bs-003',
    name:     'Arda Güler',
    apiPlayerId: 291964,
    age:      20,
    nation:   'Turkey',
    flag:     '🇹🇷',
    role:     'Advanced Playmaker',
    club:     'Real Madrid',
    image:    '/assets/players/gordon.jpg',
    wcRating: 84,
    trend:    '+7',
    matches:  2,
    goals:    1,
    assists:  2,
    note:     'The heir to Ozil creative throne. Two assists and a goal in his first World Cup.',
    featured: false,
  },
];

// ── ICONIC EDITIONS ───────────────────────────────────────────────
export const iconicEditions = [
  {
    year:         1970,
    host:         'Mexico',
    winner:       'Brazil',
    flag:         '🇧🇷',
    theme:        'The Beautiful Game at its peak',
    summary:      'Pele, Jairzinho, Tostao and Rivelino produced the most aesthetically complete football the world had seen. Brazil won all six games. The 4-1 final against Italy remains a benchmark.',
    players:      ['Pele', 'Gerd Muller', 'Bobby Moore'],
    moment:       'Pele header vs Czechoslovakia — and Gordon Banks save to deny it.',
    calibreScore: 98,
  },
  {
    year:         1986,
    host:         'Mexico',
    winner:       'Argentina',
    flag:         '🇦🇷',
    theme:        'The Diego Maradona Show',
    summary:      'One man carried a nation to the title. The Hand of God and the Goal of the Century in the same match against England. No individual has dominated a tournament like this before or since.',
    players:      ['Diego Maradona', 'Gary Lineker', 'Michel Platini'],
    moment:       'The 60-metre slalom through England defence. Five players beaten. Still the greatest goal.',
    calibreScore: 97,
  },
  {
    year:         1998,
    host:         'France',
    winner:       'France',
    flag:         '🇫🇷',
    theme:        "Zidane's coronation",
    summary:      "France built on home advantage with a squad of remarkable depth. Zidane's two headers in the final against Brazil cemented a legacy. Ronaldo's mysterious collapse the morning of the final remains one of football's great unanswered stories.",
    players:      ['Zinedine Zidane', 'Ronaldo', 'Davor Suker'],
    moment:       "Zidane rising to head home Petit's corner. 2-0. France were world champions.",
    calibreScore: 94,
  },
  {
    year:         2002,
    host:         'South Korea / Japan',
    winner:       'Brazil',
    flag:         '🇧🇷',
    theme:        "R9's redemption",
    summary:      'Ronaldo returned from two years of injury and neurological mystery to win the Golden Boot and score twice in the final. The greatest individual redemption arc in World Cup history.',
    players:      ['Ronaldo', 'Rivaldo', 'Oliver Kahn'],
    moment:       "Ronaldo's double in the final. 2-0 against Germany. The smile said everything.",
    calibreScore: 93,
  },
  {
    year:         2010,
    host:         'South Africa',
    winner:       'Spain',
    flag:         '🇪🇸',
    theme:        'Tiki-taka rewrites the game',
    summary:      "Spain won with the lowest goals-per-game average of any champion but the highest passing accuracy. Iniesta's extra-time winner in the final against Netherlands proved that control could be as devastating as pace.",
    players:      ['Andres Iniesta', 'Wesley Sneijder', 'David Villa'],
    moment:       "Iniesta's 116th-minute volley. A nation's first World Cup. He removed his shirt: Dani Jarque. Siempre con nosotros.",
    calibreScore: 96,
  },
  {
    year:         2018,
    host:         'Russia',
    winner:       'France',
    flag:         '🇫🇷',
    theme:        'Mbappe announces himself',
    summary:      'France won with a squad averaging 26 years old. Mbappe became the second teenager after Pele to score in a World Cup final. Modric won the Golden Ball in a Croatia side that reached the final on guts alone.',
    players:      ['Kylian Mbappe', 'Luka Modric', 'Antoine Griezmann'],
    moment:       "Mbappe's 65th-minute strike to make it 4-1. At 19. Against Croatia. In a final.",
    calibreScore: 92,
  },
  {
    year:         2022,
    host:         'Qatar',
    winner:       'Argentina',
    flag:         '🇦🇷',
    theme:        "Messi's destiny fulfilled",
    summary:      "The greatest individual in the game's history finally held the trophy he was born to lift. A final of almost unbearable drama — 3-3 after extra time, decided on penalties. Mbappe's hat-trick was the finest losing performance in a final.",
    players:      ['Lionel Messi', 'Kylian Mbappe', 'Emi Martinez'],
    moment:       "Messi lifting the trophy. 36 years of watching Maradona's ghost finally answered.",
    calibreScore: 99,
  },
];

// ── ICONIC GOALS ─────────────────────────────────────────────────
export const iconicGoals = [
  { year: 1986, scorer: 'Diego Maradona',   nation: 'Argentina', flag: '🇦🇷', vs: 'England',  label: 'The Goal of the Century',      description: '60 metres. Five players beaten. 11 touches. The greatest individual goal in the history of the sport.' },
  { year: 1970, scorer: 'Carlos Alberto',   nation: 'Brazil',    flag: '🇧🇷', vs: 'Italy',    label: 'The Perfect Team Goal',        description: "Every outfield player touched the ball. Alberto arriving late to slot home. Football's purest expression of collective art." },
  { year: 2002, scorer: 'Ronaldinho',       nation: 'Brazil',    flag: '🇧🇷', vs: 'England',  label: 'The Lob That Silenced Seaman', description: 'Forty-five metres. Clipped perfectly. Seaman backpedalling, helpless. Still cannot be explained.' },
  { year: 1958, scorer: 'Pele',             nation: 'Brazil',    flag: '🇧🇷', vs: 'Sweden',   label: "The Boy King's Final",         description: 'A seventeen-year-old chest control and volley in a World Cup final. The origin myth of the sport.' },
  { year: 2006, scorer: 'Zinedine Zidane',  nation: 'France',    flag: '🇫🇷', vs: 'Italy',    label: 'The Panenka',                  description: 'In a World Cup final. On a penalty. Against Buffon. Zidane chipped it down the middle with his head bowed. Arrogance as art.' },
  { year: 2014, scorer: 'James Rodriguez', nation: 'Colombia',  flag: '🇨🇴', vs: 'Uruguay',  label: 'The Chest and Volley',         description: 'The goal that made a nation fall in love with a World Cup. A left-foot volley from the edge of the area after a chest trap. 38 metres.' },
];

// ── PLAYER OF THE TOURNAMENT HISTORY ─────────────────────────────
export const tournamentPlayers = [
  { year: 2022, player: 'Lionel Messi',       flag: '🇦🇷', award: 'Golden Ball' },
  { year: 2018, player: 'Luka Modric',        flag: '🇭🇷', award: 'Golden Ball' },
  { year: 2014, player: 'Lionel Messi',       flag: '🇦🇷', award: 'Golden Ball' },
  { year: 2010, player: 'Diego Forlan',       flag: '🇺🇾', award: 'Golden Ball' },
  { year: 2006, player: 'Zinedine Zidane',    flag: '🇫🇷', award: 'Golden Ball' },
  { year: 2002, player: 'Oliver Kahn',        flag: '🇩🇪', award: 'Golden Ball' },
  { year: 1998, player: 'Ronaldo',            flag: '🇧🇷', award: 'Golden Ball' },
  { year: 1994, player: 'Romario',            flag: '🇧🇷', award: 'Golden Ball' },
  { year: 1990, player: 'Salvatore Schillaci',flag: '🇮🇹', award: 'Golden Boot' },
  { year: 1986, player: 'Diego Maradona',     flag: '🇦🇷', award: 'Golden Ball' },
];

// ── WORLD CUP FACTS ───────────────────────────────────────────────
// Admin: add/edit facts freely. category options:
// tournament | goals | players | hosts | records | curiosities
export const wcFacts = [
  // TOURNAMENT FACTS
  { id: 'f-001', category: 'tournament', emoji: '🏆', fact: 'Brazil have won the World Cup 5 times — more than any other nation.', tags: ['Brazil', 'records'] },
  { id: 'f-002', category: 'tournament', emoji: '🌍', fact: 'The 2026 World Cup will be the first to feature 48 teams, up from 32. It is also the first co-hosted by three nations.', tags: ['2026', 'format'] },
  { id: 'f-003', category: 'tournament', emoji: '📅', fact: 'The World Cup has been held every four years since 1930, except 1942 and 1946 due to World War II.', tags: ['history'] },
  { id: 'f-004', category: 'tournament', emoji: '🎯', fact: 'Germany and Brazil have each appeared in the most World Cup semi-finals — 13 times each.', tags: ['Germany', 'Brazil', 'records'] },
  { id: 'f-005', category: 'tournament', emoji: '🤝', fact: 'European nations have won 12 of the 22 World Cups played. South American nations have won 9.', tags: ['stats'] },

  // GOALS
  { id: 'f-006', category: 'goals', emoji: '⚽', fact: "Just Fontaine scored 13 goals at the 1958 World Cup — still the record for a single tournament. France finished third.", tags: ['1958', 'France', 'records'] },
  { id: 'f-007', category: 'goals', emoji: '💥', fact: 'The highest-scoring World Cup game was Austria 7-5 Switzerland in 1954. 12 goals in 90 minutes.', tags: ['1954', 'records'] },
  { id: 'f-008', category: 'goals', emoji: '🎯', fact: "Miroslav Klose is the all-time leading World Cup scorer with 16 goals across four tournaments for Germany.", tags: ['Germany', 'records', 'Klose'] },
  { id: 'f-009', category: 'goals', emoji: '⚡', fact: "Hakan Sukur scored the fastest World Cup goal in history — 11 seconds into Turkey vs South Korea in 2002.", tags: ['2002', 'Turkey', 'records'] },
  { id: 'f-010', category: 'goals', emoji: '🚀', fact: "Pele is the only player to win three World Cup winner medals (1958, 1962, 1970). He scored his first at age 17.", tags: ['Pele', 'Brazil', 'records'] },

  // PLAYERS
  { id: 'f-011', category: 'players', emoji: '👑', fact: "Lothar Matthaus played in five World Cups (1982-1998) and holds the record for most World Cup appearances: 25 games.", tags: ['Germany', 'records', 'Matthaus'] },
  { id: 'f-012', category: 'players', emoji: '🧤', fact: "Goalkeeper Peter Shilton played in 17 World Cup matches for England — the most by any English player.", tags: ['England', 'records'] },
  { id: 'f-013', category: 'players', emoji: '🌟', fact: "Ronaldo (Brazil) won the Golden Ball at his worst World Cup (1998) and the Golden Boot at his best (2002). Context is everything.", tags: ['Ronaldo', 'Brazil'] },
  { id: 'f-014', category: 'players', emoji: '🦁', fact: "Eusebio scored 9 goals at the 1966 World Cup, leading Portugal to third place. He cried on the pitch after their semi-final loss to England.", tags: ['Portugal', '1966', 'Eusebio'] },
  { id: 'f-015', category: 'players', emoji: '🎭', fact: "Paolo Maldini never won a World Cup despite being arguably the best defender of his generation. Italy reached the final in 1994 — and lost on penalties.", tags: ['Italy', 'Maldini'] },

  // HOST CITIES
  { id: 'f-016', category: 'hosts', emoji: '🏟️', fact: "The Maracana in Rio hosted the 1950 World Cup final (the Maracanazo) with an estimated 200,000 spectators — the largest crowd in football history.", tags: ['Brazil', '1950', 'stadiums'] },
  { id: 'f-017', category: 'hosts', emoji: '🌆', fact: "Mexico is the only country to have hosted the World Cup twice before 2026 — in 1970 and 1986. Both times Argentina won the trophy.", tags: ['Mexico', 'history'] },
  { id: 'f-018', category: 'hosts', emoji: '🏙️', fact: "The 2026 World Cup will be played across 16 stadiums in 3 countries. New York/New Jersey will host the final at MetLife Stadium.", tags: ['2026', 'USA'] },
  { id: 'f-019', category: 'hosts', emoji: '🌍', fact: "South Africa in 2010 was the first World Cup held on the African continent. The vuvuzela became its defining sound.", tags: ['2010', 'Africa'] },
  { id: 'f-020', category: 'hosts', emoji: '🕌', fact: "The 2022 World Cup in Qatar was the first held in the Middle East and the first played in November-December to avoid summer heat.", tags: ['2022', 'Qatar'] },

  // RECORDS & CURIOSITIES
  { id: 'f-021', category: 'records', emoji: '📊', fact: "The 1994 World Cup in the USA was the most-watched sporting event in history at the time — 3.6 billion viewers globally.", tags: ['1994', 'USA', 'records'] },
  { id: 'f-022', category: 'records', emoji: '🔴', fact: "The most red cards in a single World Cup match: the Netherlands vs Portugal in 2006 produced 4 red cards and 16 yellow cards. Referee Valentin Ivanov was widely criticised.", tags: ['2006', 'records'] },
  { id: 'f-023', category: 'records', emoji: '🤯', fact: "West Germany beat Hungary 3-2 in the 1954 final despite losing 3-8 to the same team in the group stage. The Miracle of Bern.", tags: ['1954', 'Germany', 'Hungary'] },
  { id: 'f-024', category: 'records', emoji: '😮', fact: "North Korea shocked Italy 1-0 at the 1966 World Cup — one of the biggest upsets in the tournament's history. Italian players were pelted with rotten tomatoes on return home.", tags: ['1966', 'upsets'] },
  { id: 'f-025', category: 'curiosities', emoji: '🐙', fact: "Paul the Octopus correctly predicted all 8 of Germany's match outcomes at the 2010 World Cup, including their semi-final loss to Spain.", tags: ['2010', 'curiosities'] },
  { id: 'f-026', category: 'curiosities', emoji: '🌧️', fact: "The entire 1950 World Cup was played without a knockout final. Brazil only needed a draw in the last game against Uruguay to win — and lost 1-2. The Maracanazo.", tags: ['1950', 'Brazil', 'curiosities'] },
  { id: 'f-027', category: 'curiosities', emoji: '🇩🇰', fact: "Denmark's Harald Nielsen scored 4 goals at the 1966 World Cup despite Denmark not qualifying — he played for the USA. Players could represent any nation then.", tags: ['1966', 'curiosities'] },
  { id: 'f-028', category: 'curiosities', emoji: '🎵', fact: "Shakira's Waka Waka (2010 World Cup anthem) remains the most-watched music video in YouTube history from a World Cup. Over 3 billion views.", tags: ['2010', 'culture'] },
];
