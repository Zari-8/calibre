export const CALIBRE_WEIGHTS = {
  performance: 0.35,
  consistency: 0.20,
  form: 0.20,
  impact: 0.15,
  trajectory: 0.10
};

export const LEAGUE_MULTIPLIERS = {
  "Premier League": 1.00,
  "La Liga": 0.99,
  "Bundesliga": 0.98,
  "Serie A": 0.97,
  "Ligue 1": 0.94,
  "Eredivisie": 0.88,
  "Portuguese League": 0.86,
  "Championship": 0.84,
  "Belgian Pro League": 0.82,
  "Brazil Serie A": 0.87,
  "Argentina Primera": 0.85,
  "MLS": 0.76,
  "Saudi Pro League": 0.78,
  "South African PSL": 0.70,
  "NPFL": 0.68,
  "Zimbabwe PSL": 0.62,
  "NWSL": 0.76,
  "WSL": 0.82
};

export function clampScore(score) {
  return Math.max(0, Math.min(100, score));
}

export function calculateCalibreRating(player) {
  const baseScore =
    player.performance * CALIBRE_WEIGHTS.performance +
    player.consistency * CALIBRE_WEIGHTS.consistency +
    player.form * CALIBRE_WEIGHTS.form +
    player.impact * CALIBRE_WEIGHTS.impact +
    player.trajectory * CALIBRE_WEIGHTS.trajectory;

  const leagueMultiplier = LEAGUE_MULTIPLIERS[player.league] || 0.75;
  return Math.round(clampScore(baseScore * leagueMultiplier));
}

export function getNextStepProjection(player) {
  const leagueMultiplier = LEAGUE_MULTIPLIERS[player.league] || 0.75;
  const rating = player.calibreRating ?? calculateCalibreRating(player);
  const trajectory = player.trajectory || 0;
  const age = player.age || 99;
  const minutesShare = player.minutesShare || 0;

  if (age > 23) return null;

  if (rating >= 82 && trajectory >= 85 && leagueMultiplier < 0.75) {
    return {
      level: "European development move",
      suggestedLeagues: ["Belgian Pro League", "Eredivisie", "Danish Superliga"],
      reason: "High trajectory and strong age-adjusted output suggest he is ready for a better development environment.",
      caution: "Avoid jumping straight into a top-five league bench role."
    };
  }

  if (rating >= 78 && trajectory >= 80 && leagueMultiplier < 0.82) {
    return {
      level: "Belgian Pro League / Eredivisie watchlist",
      suggestedLeagues: ["Belgian Pro League", "Eredivisie", "Portuguese League"],
      reason: "Profile is outgrowing current league difficulty and needs more demanding senior minutes.",
      caution: "Move should protect role fit and minutes, not just badge prestige."
    };
  }

  if (rating >= 74 && trajectory >= 78 && leagueMultiplier < 0.70) {
    return {
      level: "Step-up league minutes",
      suggestedLeagues: ["Championship", "Scandinavia", "South African PSL"],
      reason: "Strong local dominance with a rising curve; next test should increase pace and physical demand.",
      caution: "Needs translation check against higher-tempo opposition."
    };
  }

  if (rating >= 70 && minutesShare < 45) {
    return {
      level: "Loan move recommended",
      suggestedLeagues: ["Senior minutes first", "Role-stable loan", "Development club"],
      reason: "Talent signal is visible, but minutes are too low for reliable projection.",
      caution: "Do not overrate training-ground reputation without match volume."
    };
  }

  if (rating >= 70 && trajectory >= 75) {
    return {
      level: "Stay and dominate current league first",
      suggestedLeagues: [player.league || "Current league"],
      reason: "Trajectory is promising, but the next move should wait until dominance is clearer.",
      caution: "Needs consistency before a harder league move."
    };
  }

  return {
    level: "Monitor development curve",
    suggestedLeagues: ["Current league"],
    reason: "Useful talent signal, but not enough evidence for a strong next-step recommendation yet.",
    caution: "Track minutes, form and role stability."
  };
}

export function calculateDebateIndex(playerA, playerB) {
  const ratingGap = Math.abs((playerA.calibreRating || 0) - (playerB.calibreRating || 0));
  const similarScore = ratingGap <= 2 ? 35 : ratingGap <= 5 ? 20 : 8;
  const reputationGap = Math.abs((playerA.marketBuzz || 0) - (playerB.marketBuzz || 0));
  const statsGap = Math.abs((playerA.performance || 0) - (playerB.performance || 0));
  const overratedTrigger = reputationGap > 15 && statsGap < 6 ? 30 : 0;

  const underdogTrigger =
    (playerA.calibreRating > playerB.calibreRating && playerA.marketBuzz < playerB.marketBuzz) ||
    (playerB.calibreRating > playerA.calibreRating && playerB.marketBuzz < playerA.marketBuzz)
      ? 25
      : 0;

  return Math.min(100, 35 + similarScore + overratedTrigger + underdogTrigger);
}

export function getDebateLabel(score) {
  if (score >= 85) return "Explosive Debate";
  if (score >= 70) return "Strong Debate";
  if (score >= 55) return "Good Debate";
  return "Low Heat";
}
