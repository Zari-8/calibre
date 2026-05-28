'use client';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import { Player } from '@/lib/data';

export function FitRadar({ player }: { player: Player }) {
  const data = [
    { metric: 'Control', value: player.control },
    { metric: 'Impact', value: player.impact },
    { metric: 'Creation', value: player.creation },
    { metric: 'Press', value: player.pressing },
    { metric: 'Box', value: player.box },
    { metric: 'Transition', value: player.transition }
  ];
  return (
    <div style={{height:300}}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data}>
          <PolarGrid />
          <PolarAngleAxis dataKey="metric" />
          <Radar name={player.name} dataKey="value" fillOpacity={0.35} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
