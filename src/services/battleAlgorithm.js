/**
 * Battle Algorithm
 * ────────────────
 * Scores every candidate player pair and returns the best matchup for today.
 *
 * Score = (debateHeat × 0.40) + (formScore × 0.35) + (engagementScore × 0.25)
 *
 * debateHeat    — derived from vote counts + vote velocity in rateBattles mock data
 *                 (replace with Supabase query when DB is live)
 * formScore     — derived from API Football standings form string (W/D/L)
 * engagementScore — approximated from page view proxy in mock data (debateIndex field)
 *
 * The algorithm runs once per session and caches the result for 24h in localStorage.
 */

import { rateBattles, players } from '../data/calibreData.js';
import { getStandings, LEAGUE_IDS, CURRENT_SEASON } from './apiFootball.js';

const CACHE_KEY = 'calibre_battle_of_day';
const DAY_MS    = 24 * 60 * 60 * 1000;

// ── Form string parser ───────────────────────────────────────────
// API Football returns form as "WWDLW" — convert to 0-100 score
function parseForm(formStr = '') {
  if (!formStr) return 50;
  const map = { W: 100, D: 50, L: 0 };
  const vals = formStr.split('').map(c => map[c] ?? 50);
  // Weight recent games more heavily
  const weights = [0.35, 0.25, 0.20, 0.12, 0.08];
  return vals.slice(0, 5).reduce((sum, v, i) => sum + v * (weights[i] ?? 0.1), 0);
}

// ── Debate heat scorer ───────────────────────────────────────────
// Uses vote count + heat field from mock data
// Replace rateBattles with live DB data when Supabase is wired in
function debateHeatScore(battle) {
  const voteNum = parseInt(String(battle.votes).replace(/[^0-9]/g, ''), 10) || 0;
  const heat    = battle.heat || 50;
  // Normalise vote count to 0-100 (cap at 500K)
  const voteScore = Math.min(100, (voteNum / 500000) * 100);
  return (heat * 0.6) + (voteScore * 0.4);
}

// ── Engagement proxy ─────────────────────────────────────────────
// Uses debateIndex from player profile as engagement proxy
// until real page-view analytics are wired in
function engagementScore(playerA, playerB) {
  const a = playerA?.debateIndex ?? 50;
  const b = playerB?.debateIndex ?? 50;
  return (a + b) / 2;
}

// ── Main algorithm ───────────────────────────────────────────────
export async function pickDailyBattle() {
  // Check cache first
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const { ts, battle } = JSON.parse(cached);
      if (Date.now() - ts < DAY_MS) return battle;
    }
  } catch { /* ignore */ }

  // Fetch form data for top leagues — use Premier League + La Liga for battle candidates
  let laLigaStandings = null;
  let plStandings     = null;
  try {
    [laLigaStandings, plStandings] = await Promise.all([
      getStandings(LEAGUE_IDS['La Liga']),
      getStandings(LEAGUE_IDS['Premier League']),
    ]);
  } catch { /* proceed with fallback */ }

  // Build form map from standings: { teamName: formScore }
  const formMap = {};
  const allStandings = [...(laLigaStandings || []), ...(plStandings || [])];
  for (const entry of allStandings) {
    formMap[entry.team?.name] = parseForm(entry.form);
  }

  // Score every battle candidate
  const scored = rateBattles.map(battle => {
    const [nameA, nameB] = battle.title.split(' vs ');
    const playerA = players.find(p => p.name.toLowerCase().includes(nameA?.toLowerCase().trim()));
    const playerB = players.find(p => p.name.toLowerCase().includes(nameB?.toLowerCase().trim()));

    const heat       = debateHeatScore(battle);
    const formA      = formMap[playerA?.team] ?? 50;
    const formB      = formMap[playerB?.team] ?? 50;
    const form       = (formA + formB) / 2;
    const engagement = engagementScore(playerA, playerB);

    const totalScore = (heat * 0.40) + (form * 0.35) + (engagement * 0.25);

    return { battle, playerA, playerB, totalScore, heat, form, engagement };
  });

  // Sort descending by total score
  scored.sort((a, b) => b.totalScore - a.totalScore);
  const winner = scored[0];

  const result = {
    battle:  winner.battle,
    playerA: winner.playerA,
    playerB: winner.playerB,
    scores: {
      heat:       Math.round(winner.heat),
      form:       Math.round(winner.form),
      engagement: Math.round(winner.engagement),
      total:      Math.round(winner.totalScore),
    },
  };

  // Cache for 24h
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), battle: result }));
  } catch { /* ignore */ }

  return result;
}

/** Clear the cached battle (call this when new vote data comes in) */
export function invalidateBattleCache() {
  localStorage.removeItem(CACHE_KEY);
}
