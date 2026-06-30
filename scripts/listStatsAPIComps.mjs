import { readFileSync, existsSync } from 'fs';

for (const f of ['.env', '.env.local']) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [key, ...rest] = trimmed.split('=');
    process.env[key.trim()] ??= rest.join('=').trim().replace(/^["']|["']$/g, '');
  }
}

const API_KEY = process.env.STATSAPI_KEY;
if (!API_KEY) {
  console.error('Missing STATSAPI_KEY');
  process.exit(1);
}

const targets = [
  'Premier League',
  'LaLiga',
  'La Liga',
  'Bundesliga',
  'Serie A',
  'Ligue 1',
  'Eredivisie',
  'Portugal',
  'Brasile',
  'Brazil',
  'MLS',
  'Champions League',
  'CAF',
  'Saudi',
  'Major League Soccer'
];

async function getJson(url) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${API_KEY}`, Accept: 'application/json' }
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

let page = 1;
let all = [];

while (true) {
  const url = `https://api.thestatsapi.com/api/football/competitions?page=${page}`;
  const json = await getJson(url);
  const rows = json.data || [];
  all.push(...rows);

  const totalPages = json.meta?.total_pages || 1;
  if (page >= totalPages) break;
  page++;
}

console.log(`Total competitions loaded: ${all.length}\n`);

for (const c of all) {
  const name = c.name || '';
  const country = c.country || '';
  const haystack = `${name} ${country}`;

  if (targets.some(t => haystack.toLowerCase().includes(t.toLowerCase()))) {
    console.log(
      `${c.id} | ${name} | ${country || 'n/a'} | team_stats:${c.has_team_stats} | player_stats:${c.has_player_stats} | xG:${c.xg_available}`
    );
  }
}
