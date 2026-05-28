import { NextResponse } from 'next/server';
import { players } from '@/lib/data';

export const dynamic = 'force-dynamic';

type ApiFootballPlayer = {
  player?: {
    id?: number;
    name?: string;
    firstname?: string;
    lastname?: string;
    photo?: string;
    nationality?: string;
    age?: number;
  };
  statistics?: Array<{
    team?: { id?: number; name?: string; logo?: string };
    league?: { id?: number; name?: string; logo?: string };
  }>;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const name = searchParams.get('name');
  const season = searchParams.get('season') || process.env.API_FOOTBALL_SEASON || '2025';

  const local = id ? players.find(player => player.id === id) : undefined;
  const queryName = name || local?.name;

  // If there is no API key yet, return the API-ready stored URL from lib/data.
  // This avoids burning API calls during the test run and keeps the frontend stable.
  if (!process.env.API_FOOTBALL_KEY || !queryName) {
    return NextResponse.json({
      mode: 'stored-api-url',
      player: local || null,
      source: local?.photoUrl ? 'stored-api-url' : 'fallback'
    });
  }

  try {
    const url = new URL('https://v3.football.api-sports.io/players');
    url.searchParams.set('search', queryName);
    url.searchParams.set('season', season);

    const response = await fetch(url, {
      headers: {
        'x-apisports-key': process.env.API_FOOTBALL_KEY
      },
      // Cache on Vercel for a week. Player images do not need to refresh every page load.
      next: { revalidate: 60 * 60 * 24 * 7 }
    });

    if (!response.ok) {
      throw new Error(`API-Football returned ${response.status}`);
    }

    const data = await response.json();
    const first: ApiFootballPlayer | undefined = data?.response?.[0];

    const enriched = {
      ...local,
      name: first?.player?.name || local?.name || queryName,
      age: first?.player?.age || local?.age,
      nation: first?.player?.nationality || local?.nation,
      photoUrl: first?.player?.photo || local?.photoUrl,
      club: first?.statistics?.[0]?.team?.name || local?.club,
      teamLogoUrl: first?.statistics?.[0]?.team?.logo || local?.teamLogoUrl,
      imageStatus: first?.player?.photo ? 'api' : local?.imageStatus || 'fallback'
    };

    return NextResponse.json({
      mode: 'live-api',
      player: enriched,
      source: first?.player?.photo ? 'api-football' : 'fallback'
    });
  } catch (error) {
    return NextResponse.json({
      mode: 'api-error-fallback',
      error: error instanceof Error ? error.message : 'Unknown API image error',
      player: local || null,
      source: local?.photoUrl ? 'stored-api-url' : 'fallback'
    });
  }
}
