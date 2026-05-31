/**
 * useBattle hook
 * Runs the battle algorithm and returns the winning matchup.
 * Falls back to first rateBattle if algorithm fails.
 */
import { useState, useEffect } from 'react';
import { pickDailyBattle } from '../services/battleAlgorithm.js';
import { rateBattles, players } from '../data/calibreData.js';

export function useBattle() {
  const fallback = {
    battle:  rateBattles[0],
    playerA: players[0],
    playerB: players[1],
    scores:  null,
  };

  const [result, setResult]   = useState(fallback);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    pickDailyBattle()
      .then(r => { if (r) setResult(r); })
      .catch(() => { /* keep fallback */ })
      .finally(() => setLoading(false));
  }, []);

  return { ...result, loading };
}
