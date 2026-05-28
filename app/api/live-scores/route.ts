import { NextResponse } from 'next/server';

type ScoreItem = {
  label: string;
  detail: string;
  status: 'LIVE' | 'FT' | 'SCHEDULED' | 'DEMO';
};

const demoScores: ScoreItem[] = [
  { label: 'Bayern', detail: "2 - 1 Dortmund 87'", status: 'DEMO' },
  { label: 'Arsenal', detail: '3 - 0 Newcastle FT', status: 'DEMO' },
  { label: 'Real Madrid', detail: '1 - 1 Barcelona FT', status: 'DEMO' },
  { label: 'Man City vs Tottenham', detail: 'Today 17:30', status: 'DEMO' },
  { label: 'PSG vs Monaco', detail: 'Today 21:00', status: 'DEMO' }
];

export async function GET() {
  const apiKey = process.env.API_FOOTBALL_KEY || process.env.FOOTBALL_API_KEY;
  const apiHost = process.env.API_FOOTBALL_HOST || process.env.FOOTBALL_API_HOST || 'v3.football.api-sports.io';

  if (!apiKey) {
    return NextResponse.json({
      mode: 'demo',
      updatedAt: new Date().toISOString(),
      scores: demoScores
    });
  }

  try {
    const response = await fetch('https://v3.football.api-sports.io/fixtures?live=all', {
      headers: {
        'x-apisports-key': apiKey,
        'x-rapidapi-host': apiHost
      },
      next: { revalidate: 60 }
    });

    if (!response.ok) {
      throw new Error(`Football API returned ${response.status}`);
    }

    const data = await response.json();
    const scores: ScoreItem[] = (data.response || []).slice(0, 8).map((fixture: any) => {
      const home = fixture.teams?.home?.name || 'Home';
      const away = fixture.teams?.away?.name || 'Away';
      const homeGoals = fixture.goals?.home ?? 0;
      const awayGoals = fixture.goals?.away ?? 0;
      const elapsed = fixture.fixture?.status?.elapsed;
      const short = fixture.fixture?.status?.short || 'LIVE';
      return {
        label: home,
        detail: `${homeGoals} - ${awayGoals} ${away} ${elapsed ? `${elapsed}'` : short}`,
        status: 'LIVE'
      };
    });

    return NextResponse.json({
      mode: scores.length ? 'live' : 'no-live-fixtures',
      updatedAt: new Date().toISOString(),
      scores: scores.length ? scores : demoScores
    });
  } catch (error) {
    return NextResponse.json({
      mode: 'fallback',
      updatedAt: new Date().toISOString(),
      scores: demoScores
    });
  }
}
