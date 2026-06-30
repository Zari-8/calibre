#!/bin/bash

echo "=========================================="
echo " Calibre TheStatsAPI Corrected Probe"
echo "=========================================="

API_KEY=$(grep -hE "^STATSAPI_KEY=" .env .env.local 2>/dev/null | head -1 | cut -d '=' -f2- | tr -d '"' | tr -d "'")

if [ -z "$API_KEY" ]; then
  echo "❌ STATSAPI_KEY not found."
  echo "Check with:"
  echo "grep -i \"STATSAPI\" .env .env.local"
  exit 1
fi

BASE="https://api.thestatsapi.com/api"

echo "✅ Using key: ${API_KEY:0:8}..."
echo "✅ Using base URL: $BASE"
echo ""

request() {
  LABEL="$1"
  URL="$2"

  echo ""
  echo "------------------------------------------"
  echo "$LABEL"
  echo "$URL"
  echo "------------------------------------------"

  curl -s -w "\nHTTP_STATUS:%{http_code}\n" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Accept: application/json" \
    "$URL" | head -c 4000

  echo ""
}

echo "STEP 1: Find working base routes"
request "Competitions" "$BASE/football/competitions"
request "Matches current/simple" "$BASE/football/matches"
request "Matches with season" "$BASE/football/matches?season=2025"
request "Matches with competition + season" "$BASE/football/matches?competition_id=1&season=2025"

echo ""
echo "STEP 2: Try likely football resources"
request "Teams" "$BASE/football/teams"
request "Players" "$BASE/football/players"
request "Standings" "$BASE/football/standings"
request "Odds" "$BASE/football/odds"

echo ""
echo "STEP 3: Try match stats/xG routes"
request "Match stats direct example with fake id 1" "$BASE/football/matches/1/stats"
request "Shots direct with fake id 1" "$BASE/football/matches/1/shots"
request "Events direct with fake id 1" "$BASE/football/matches/1/events"
request "Lineups direct with fake id 1" "$BASE/football/matches/1/lineups"

echo ""
echo "=========================================="
echo " Probe complete"
echo "=========================================="
echo ""
echo "Next:"
echo "1. If matches returns HTTP 200, copy one real match id."
echo "2. Then run:"
echo "curl -s -H \"Authorization: Bearer \$API_KEY\" \"$BASE/football/matches/REAL_MATCH_ID/stats\" | grep -Eoi \"xg|expected|npxg|xa|shot|shots\" | sort | uniq -c"
