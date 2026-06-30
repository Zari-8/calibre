#!/bin/bash

API_KEY=$(grep -hE "^STATSAPI_KEY=" .env .env.local 2>/dev/null | head -1 | cut -d '=' -f2- | tr -d '"' | tr -d "'")
BASE="https://api.thestatsapi.com/api"

if [ -z "$API_KEY" ]; then
  echo "❌ STATSAPI_KEY not found"
  exit 1
fi

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
    "$URL" | head -c 2500

  echo ""
}

echo "Trying likely match-list routes..."

request "matches" "$BASE/football/matches"
request "matches with limit" "$BASE/football/matches?limit=10"
request "matches season 2025" "$BASE/football/matches?season=2025"
request "fixtures" "$BASE/football/fixtures"
request "fixtures with limit" "$BASE/football/fixtures?limit=10"
request "games" "$BASE/football/games"
request "events" "$BASE/football/events"

echo ""
echo "Trying date-based routes..."

TODAY=$(date +%F)
request "matches today" "$BASE/football/matches?date=$TODAY"
request "fixtures today" "$BASE/football/fixtures?date=$TODAY"
request "matches date_from/date_to" "$BASE/football/matches?date_from=2025-08-01&date_to=2025-08-10"
request "fixtures date_from/date_to" "$BASE/football/fixtures?date_from=2025-08-01&date_to=2025-08-10"

echo ""
echo "Trying competition routes..."

request "competitions" "$BASE/football/competitions"
request "competition 1 matches nested" "$BASE/football/competitions/1/matches"
request "competition 1 fixtures nested" "$BASE/football/competitions/1/fixtures"
request "competition 1 matches season" "$BASE/football/competitions/1/matches?season=2025"
request "competition 1 fixtures season" "$BASE/football/competitions/1/fixtures?season=2025"

echo ""
echo "Done."
