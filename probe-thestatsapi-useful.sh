#!/bin/bash

echo "=========================================="
echo " Calibre TheStatsAPI Real Endpoint Probe"
echo "=========================================="

# Try to load key from .env or .env.local
KEY_NAME=$(grep -hE "STATS|THESTATS|STATSAPI" .env .env.local 2>/dev/null | head -1 | cut -d '=' -f1)
API_KEY=$(grep -hE "STATS|THESTATS|STATSAPI" .env .env.local 2>/dev/null | head -1 | cut -d '=' -f2- | tr -d '"' | tr -d "'")

if [ -z "$API_KEY" ]; then
  echo "❌ No StatsAPI key found in .env or .env.local"
  echo "Run this to inspect possible key names:"
  echo "grep -i \"STATS\\|THESTATS\\|STATSAPI\" .env .env.local 2>/dev/null"
  exit 1
fi

echo "✅ Found key variable: $KEY_NAME"
echo "Key starts with: ${API_KEY:0:6}..."
echo ""

BASE="https://api.thestatsapi.com"

request() {
  LABEL="$1"
  URL="$2"

  echo ""
  echo "------------------------------------------"
  echo "$LABEL"
  echo "$URL"
  echo "------------------------------------------"

  RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Accept: application/json" \
    "$URL")

  echo "$RESPONSE" | head -c 2500
  echo ""
  echo "$RESPONSE" | grep -Eoi "xg|expected|npxg|xa|shot|shots|player|stats|fixture|match|competition|unauthorized|forbidden|plan|subscription|route not found|not_found" | sort | uniq -c
}

echo ""
echo "STEP 1: Test likely working base endpoints"
request "Competitions" "$BASE/football/competitions"
request "Matches - likely documented route" "$BASE/football/matches?season=2025"
request "Matches - with likely competition id 1" "$BASE/football/matches?competition_id=1&season=2025"

echo ""
echo "STEP 2: Test common endpoint names"
request "Teams" "$BASE/football/teams"
request "Players" "$BASE/football/players"
request "Standings" "$BASE/football/standings"
request "Odds" "$BASE/football/odds"

echo ""
echo "STEP 3: Test likely stats/xG route variations"
request "Match stats" "$BASE/football/match-stats"
request "Match stats alt" "$BASE/football/matches/stats"
request "Player stats" "$BASE/football/player-stats"
request "Team stats" "$BASE/football/team-stats"
request "Shots" "$BASE/football/shots"
request "xG direct" "$BASE/football/xg"
request "Expected goals direct" "$BASE/football/expected-goals"

echo ""
echo "STEP 4: Search your codebase for existing usage"
echo "------------------------------------------"
grep -Rni "thestatsapi\|statsapi\|xg\|expected_goals\|expected-goals\|match-stats\|player-stats" src api server pages services .env .env.local 2>/dev/null | head -80

echo ""
echo "=========================================="
echo " Probe complete"
echo "=========================================="
echo ""
echo "Interpretation:"
echo "- 200 + JSON = endpoint exists and your key can access it"
echo "- 401/403 = key or package restriction"
echo "- 404 = route path is wrong"
echo "- xg/expected/npxg/xa/shot appearing in output = xG-related data likely exists"
