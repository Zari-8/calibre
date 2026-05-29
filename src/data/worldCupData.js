/**
 * World Cup Data
 * ─────────────────────────────────────────────────────────────────
 * This is the admin-friendly data structure for the World Cup page.
 * Update these arrays to curate content without touching any React code.
 *
 * WORLD CUP 2026: USA / Canada / Mexico — June 11 to July 19, 2026
 * NAV APPEARS: 7 days before kickoff (June 4, 2026)
 */

// ── CONFIG ────────────────────────────────────────────────────────
export const WC_CONFIG = {
  kickoff:     '2026-06-11T18:00:00Z', // Opening match UTC
  navThreshold: 7,                      // Days before kickoff nav appears
  edition:     'FIFA World Cup 2026',
  hosts:       ['USA', 'Canada', 'Mexico'],
};

// ── LIVE MOMENTS ─────────────────────────────────────────────────
// Admin: add objects to this array to populate the live feed.
// Shown in reverse-chronological order.
export const liveMoments = [
  {
    id:       'moment-001',
    time:     '2026-06-11T20:14:00Z',  // UTC time of moment
    match:    'Mexico vs Ecuador',
    label:    '⚡ GOAL',
    text:     'Raúl Jiménez opens the tournament with a towering header. 1-0.',
    type:     'goal',   // goal | red_card | var | milestone | upset | stat
    featured: true,
  },
  // Add more moments here as the tournament progresses.
  // Example structure:
  // {
  //   id:       'moment-002',
  //   time:     '2026-06-12T18:30:00Z',
  //   match:    'Argentina vs ...',
  //   label:    '🔴 RED CARD',
  //   text:     '...',
  //   type:     'red_card',
  //   featured: false,
  // },
];

// ── BREAKOUT STARS ────────────────────────────────────────────────
// Admin: update ratings and notes as the tournament progresses.
export const breakoutStars = [
  {
    id:        'bs-001',
    name:      'Lamine Yamal',
    age:       18,
    nation:    'Spain',
    flag:      '🇪🇸',
    role:      'Wide Creator',
    club:      'FC Barcelona',
    image:     '/assets/players/lamine-yamal.jpg',
    wcRating:  91,
    trend:     '+9',
    matches:   2,
    goals:     1,
    assists:   3,
    note:      'Already the most dangerous wide player in the tournament. Defenders have no answer.',
    featured:  true,
  },
  {
    id:        'bs-002',
    name:      'Ibrahim Musa',
    age:       19,
    nation:    'Nigeria',
    flag:      '🇳🇬',
    role:      'Wide Creator',
    club:      'Remo Stars',
    image:     '/assets/players/ibrahim-musa.jpg',
    wcRating:  79,
    trend:     '+12',
    matches:   2,
    goals:     2,
    assists:   1,
    note:      'The tournament's biggest unknown turned its most electric debut. Europe is watching.',
    featured:  true,
  },
  {
    id:        'bs-003',
    name:      'Arda Güler',
    age:       20,
    nation:    'Turkey',
    flag:      '🇹🇷',
    role:      'Advanced Playmaker',
    club:      'Real Madrid',
    image:     '/assets/players/gordon.jpg', // replace with arda-guler.jpg when available
    wcRating:  84,
    trend:     '+7',
    matches:   2,
    goals:     1,
    assists:   2,
    note:      'The heir to Özil's creative throne. Two assists and a goal in his first World Cup.',
    featured:  false,
  },
];

// ── ICONIC EDITIONS ───────────────────────────────────────────────
// Historical World Cup editions — seeded with real data.
export const iconicEditions = [
  {
    year:     1970,
    host:     'Mexico',
    winner:   'Brazil',
    flag:     '🇧🇷',
    theme:    'The Beautiful Game at its peak',
    summary:  'Pelé, Jairzinho, Tostão and Rivelino produced the most aesthetically complete football the world had seen. Brazil won all six games. The 4-1 final against Italy remains a benchmark.',
    players:  ['Pelé', 'Gerd Müller', 'Bobby Moore'],
    moment:   'Pelé\'s header vs Czechoslovakia — and Gordon Banks\'s save to deny it.',
    calibreScore: 98,
  },
  {
    year:     1986,
    host:     'Mexico',
    winner:   'Argentina',
    flag:     '🇦🇷',
    theme:    'The Diego Maradona Show',
    summary:  'One man carried a nation to the title. The Hand of God and the Goal of the Century in the same match against England. No individual has dominated a tournament like this before or since.',
    players:  ['Diego Maradona', 'Gary Lineker', 'Michel Platini'],
    moment:   'The 60-metre slalom through England\'s defence. Five players beaten. Still the greatest goal.',
    calibreScore: 97,
  },
  {
    year:     1998,
    host:     'France',
    winner:   'France',
    flag:     '🇫🇷',
    theme:    'Zidane\'s coronation',
    summary:  'France built on home advantage with a squad of remarkable depth. Zidane\'s two headers in the final against Brazil cemented a legacy. Ronaldo\'s mysterious collapse the morning of the final remains one of football\'s great unanswered stories.',
    players:  ['Zinedine Zidane', 'Ronaldo', 'Davor Šuker'],
    moment:   'Zidane rising to head home Petit\'s corner. 2-0. France were world champions.',
    calibreScore: 94,
  },
  {
    year:     2002,
    host:     'South Korea / Japan',
    winner:   'Brazil',
    flag:     '🇧🇷',
    theme:    'R9\'s redemption',
    summary:  'Ronaldo returned from two years of injury and neurological mystery to win the Golden Boot and score twice in the final. The greatest individual redemption arc in World Cup history.',
    players:  ['Ronaldo', 'Rivaldo', 'Oliver Kahn'],
    moment:   'Ronaldo\'s double in the final. 2-0 against Germany. The smile said everything.',
    calibreScore: 93,
  },
  {
    year:     2010,
    host:     'South Africa',
    winner:   'Spain',
    flag:     '🇪🇸',
    theme:    'Tiki-taka rewrites the game',
    summary:  'Spain won with the lowest goals-per-game average of any champion but the highest passing accuracy. Iniesta\'s extra-time winner in the final against Netherlands proved that control could be as devastating as pace.',
    players:  ['Andrés Iniesta', 'Wesley Sneijder', 'David Villa'],
    moment:   'Iniesta\'s 116th-minute volley. A nation\'s first World Cup. He removed his shirt to reveal "Dani Jarque. Siempre con nosotros."',
    calibreScore: 96,
  },
  {
    year:     2018,
    host:     'Russia',
    winner:   'France',
    flag:     '🇫🇷',
    theme:    'Mbappé announces himself',
    summary:  'France won with a squad averaging 26 years old. Mbappé became the second teenager after Pelé to score in a World Cup final. Modric won the Golden Ball in a Croatia side that reached the final on guts alone.',
    players:  ['Kylian Mbappé', 'Luka Modric', 'Antoine Griezmann'],
    moment:   'Mbappé\'s 65th-minute strike to make it 4-1. At 19. Against Croatia. In a final.',
    calibreScore: 92,
  },
  {
    year:     2022,
    host:     'Qatar',
    winner:   'Argentina',
    flag:     '🇦🇷',
    theme:    'Messi\'s destiny fulfilled',
    summary:  'The greatest individual in the game\'s history finally held the trophy he was born to lift. A final of almost unbearable drama — 3-3 after extra time, decided on penalties. Mbappé\'s hat-trick was the finest losing performance in a final.',
    players:  ['Lionel Messi', 'Kylian Mbappé', 'Emi Martínez'],
    moment:   'Messi lifting the trophy. 36 years of watching Maradona\'s ghost finally answered.',
    calibreScore: 99,
  },
];

// ── ICONIC GOALS ─────────────────────────────────────────────────
export const iconicGoals = [
  { year:1986, scorer:'Diego Maradona',    nation:'Argentina', flag:'🇦🇷', vs:'England',     label:'The Goal of the Century', description:'60 metres. Five players beaten. 11 touches. The greatest individual goal in the history of the sport.' },
  { year:1970, scorer:'Carlos Alberto',    nation:'Brazil',    flag:'🇧🇷', vs:'Italy',       label:'The Perfect Team Goal',   description:'Every outfield player touched the ball. Alberto arriving late to slot home. Football\'s purest expression of collective art.' },
  { year:2002, scorer:'Ronaldinho',        nation:'Brazil',    flag:'🇧🇷', vs:'England',     label:'The Lob That Silenced Seaman', description:'Forty-five metres. Clipped perfectly. Seaman backpedalling, helpless. Still cannot be explained.' },
  { year:1958, scorer:'Pelé',             nation:'Brazil',    flag:'🇧🇷', vs:'Sweden',      label:'The Boy King\'s Final',   description:'A seventeen-year-old chest control and volley in a World Cup final. The sport\'s origin myth.' },
  { year:2006, scorer:'Zinedine Zidane',  nation:'France',    flag:'🇫🇷', vs:'Italy',       label:'The Panenka',             description:'In a World Cup final. On a penalty. Against Buffon. Zidane chipped it down the middle with his head bowed. Arrogance as art.' },
  { year:2014, scorer:'James Rodríguez',  nation:'Colombia',  flag:'🇨🇴', vs:'Uruguay',     label:'The Chest and Volley',    description:'The goal that made a nation fall in love with a World Cup. A left-foot volley from the edge of the area after a chest trap. 38 metres.' },
];

// ── PLAYER OF THE TOURNAMENT HISTORY ─────────────────────────────
export const tournamentPlayers = [
  { year:2022, player:'Lionel Messi',      flag:'🇦🇷', award:'Golden Ball' },
  { year:2018, player:'Luka Modric',       flag:'🇭🇷', award:'Golden Ball' },
  { year:2014, player:'Lionel Messi',      flag:'🇦🇷', award:'Golden Ball' },
  { year:2010, player:'Diego Forlán',      flag:'🇺🇾', award:'Golden Ball' },
  { year:2006, player:'Zinedine Zidane',   flag:'🇫🇷', award:'Golden Ball' },
  { year:2002, player:'Oliver Kahn',       flag:'🇩🇪', award:'Golden Ball' },
  { year:1998, player:'Ronaldo',           flag:'🇧🇷', award:'Golden Ball' },
  { year:1994, player:'Romário',           flag:'🇧🇷', award:'Golden Ball' },
  { year:1990, player:'Salvatore Schillaci', flag:'🇮🇹', award:'Golden Boot' },
  { year:1986, player:'Diego Maradona',    flag:'🇦🇷', award:'Golden Ball' },
];
