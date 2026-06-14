/**
 * generateStatsBombData.mjs
 * Calibre – StatsBomb Data Pre-computation Script
 * ─────────────────────────────────────────────────────────────────
 * Run this script to regenerate the static JSON files in
 * public/data/statsbomb/ whenever you want fresh StatsBomb data.
 *
 * Usage (from project root):
 *   node scripts/generateStatsBombData.mjs
 *
 * Output goes to: public/data/statsbomb/
 * Files are committed to the repo so Vercel serves them statically.
 *
 * StatsBomb Open Data is free under CC-BY-SA 4.0.
 * Attribution: "Data provided by StatsBomb via Statsbomb Open Data"
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dir, '../public/data/statsbomb');
const BASE = 'https://raw.githubusercontent.com/statsbomb/open-data/master/data';

// ── Competition registry ──────────────────────────────────────────
const COMPETITIONS = [
  { name: 'Euro 2024',               competition_id: 55,   season_id: 282, gender: 'male',   has360: true  },
  { name: 'AFCON 2023',              competition_id: 1267, season_id: 107, gender: 'male',   has360: true  },
  { name: 'World Cup 2022',          competition_id: 43,   season_id: 106, gender: 'male',   has360: true  },
  { name: "Women's World Cup 2023",  competition_id: 72,   season_id: 107, gender: 'female', has360: true  },
  { name: "Women's Euro 2025",       competition_id: 53,   season_id: 315, gender: 'female', has360: true  },
  { name: 'Copa America 2024',       competition_id: 223,  season_id: 282, gender: 'male',   has360: false },
  { name: 'Bundesliga 2023/24',      competition_id: 9,    season_id: 281, gender: 'male',   has360: true  },
  { name: 'Ligue 1 2022/23',         competition_id: 7,    season_id: 235, gender: 'male',   has360: true  },
  { name: 'MLS 2023',                competition_id: 44,   season_id: 107, gender: 'male',   has360: true  },
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}

function aggregate(events) {
  const players = {};
  for (const ev of events) {
    if (!ev.player) continue;
    const pid = ev.player.id;
    if (!players[pid]) {
      players[pid] = {
        id: pid, name: ev.player.name, team: ev.team?.name || '',
        goals: 0, shots: 0, xg: 0, assists: 0, key_passes: 0,
        passes: 0, pass_complete: 0, carries: 0,
        dribbles: 0, dribbles_won: 0, duels: 0, duels_won: 0,
        pressures: 0, interceptions: 0, blocks: 0,
      };
    }
    const p = players[pid];
    const t = ev.type?.name;
    if (t === 'Pass') {
      p.passes++;
      if (!ev.pass?.outcome) p.pass_complete++;
      if (ev.pass?.goal_assist) p.assists++;
      if (ev.pass?.shot_assist) p.key_passes++;
    }
    if (t === 'Shot') {
      p.shots++;
      if (ev.shot?.outcome?.name === 'Goal' && ev.shot?.type?.name !== 'Own Goal') p.goals++;
      p.xg += ev.shot?.statsbomb_xg || 0;
    }
    if (t === 'Carry') p.carries++;
    if (t === 'Dribble') {
      p.dribbles++;
      if (ev.dribble?.outcome?.name === 'Complete') p.dribbles_won++;
    }
    if (t === 'Duel') {
      p.duels++;
      if (ev.duel?.outcome?.name?.includes('Won')) p.duels_won++;
    }
    if (t === 'Pressure') p.pressures++;
    if (t === 'Interception') p.interceptions++;
    if (t === 'Block') p.blocks++;
  }
  return players;
}

async function processCompetition(comp) {
  const label = `${comp.name} (${comp.competition_id}/${comp.season_id})`;
  console.log(`\n▶ ${label}`);
  const matches = await fetchJSON(`${BASE}/matches/${comp.competition_id}/${comp.season_id}.json`);
  console.log(`  ${matches.length} matches`);

  const all = {};
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    process.stdout.write(`  [${i+1}/${matches.length}] match ${m.match_id}\r`);
    try {
      const events = await fetchJSON(`${BASE}/events/${m.match_id}.json`);
      const mp = aggregate(events);
      for (const [pid, s] of Object.entries(mp)) {
        if (!all[pid]) { all[pid] = { ...s, matches: 1 }; continue; }
        all[pid].matches++;
        for (const k of ['goals','shots','xg','assists','key_passes','passes','pass_complete',
                          'carries','dribbles','dribbles_won','duels','duels_won','pressures','interceptions','blocks']) {
          all[pid][k] = (all[pid][k] || 0) + (s[k] || 0);
        }
      }
      await sleep(50);
    } catch (e) {
      console.error(`\n  Error match ${m.match_id}: ${e.message}`);
    }
  }

  const players = Object.values(all)
    .filter(p => p.matches > 0)
    .map(p => ({
      id: p.id, name: p.name, team: p.team, matches: p.matches,
      goals: p.goals, assists: p.assists, xg: +p.xg.toFixed(2), shots: p.shots,
      key_passes: p.key_passes,
      pass_accuracy: p.passes > 0 ? Math.round(p.pass_complete / p.passes * 100) : 0,
      dribble_success: p.dribbles > 0 ? Math.round(p.dribbles_won / p.dribbles * 100) : 0,
      duel_success: p.duels > 0 ? Math.round(p.duels_won / p.duels * 100) : 0,
      pressures: p.pressures, interceptions: p.interceptions,
    }))
    .sort((a, b) => (b.goals + b.assists) - (a.goals + a.assists));

  return {
    competition: comp.name, competition_id: comp.competition_id, season_id: comp.season_id,
    gender: comp.gender, has360: comp.has360, total_matches: matches.length,
    generated_at: new Date().toISOString(), players,
  };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const index = [];

  for (const comp of COMPETITIONS) {
    try {
      const data = await processCompetition(comp);
      const fileId = `sb_${comp.competition_id}_${comp.season_id}`;
      const outPath = join(OUT_DIR, `${fileId}.json`);
      writeFileSync(outPath, JSON.stringify(data, null, 2));
      console.log(`\n  ✓ ${outPath.split('/').pop()} (${data.players.length} players)`);
      index.push({ id: fileId, name: comp.name, competition_id: comp.competition_id,
                   season_id: comp.season_id, gender: comp.gender, has360: comp.has360,
                   total_matches: data.total_matches, total_players: data.players.length,
                   generated_at: data.generated_at });
    } catch (e) {
      console.error(`\n✗ FAILED: ${comp.name} — ${e.message}`);
    }
  }

  writeFileSync(join(OUT_DIR, 'sb_index.json'), JSON.stringify(index, null, 2));
  console.log('\n✓ Complete. Files written to public/data/statsbomb/');
  console.log('  Commit these files to your repo for Vercel to serve them statically.');
}

main().catch(console.error);
