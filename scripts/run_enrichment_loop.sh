#!/usr/bin/env bash
# scripts/run_enrichment_loop.sh
#
# Runs the SCOPED enrichment sweep (scored_player_uuids.txt — the real
# ~13,900-row population, not the unscoped 401k API-Football directory) on
# a retry loop, because API-Football's daily request quota will very likely
# get hit again partway through. Each attempt's output is checked for the
# quota message; if found, it sleeps and retries (quota resets ~daily) rather
# than giving up. If a whole attempt completes with no quota hit, the sweep
# is done (or as done as it's going to get) and the loop stops.
#
# Wrap this in `caffeinate` so the Mac doesn't sleep mid-run (see the actual
# invocation at the bottom of the chat message this came with).
#
# Usage: bash scripts/run_enrichment_loop.sh
set -uo pipefail
cd "$(dirname "$0")/.."

UUID_FILE="scored_player_uuids.txt"
LOG="enrichPlayerStats_scored_$(date +%Y%m%d).log"
MAX_ATTEMPTS=12       # 12 attempts x 4h sleep = 48h ceiling, comfortably covers a day+ of quota resets
SLEEP_SECS=14400       # 4 hours between retries after a quota hit

if [ ! -s "$UUID_FILE" ]; then
  echo "$(date) :: $UUID_FILE missing/empty — generating it now." | tee -a "$LOG"
  # Capture stderr into the log too this time — a silent failure here
  # previously left an empty file with zero explanation (the outer launch
  # command's own stderr was going to /dev/null, so the real error from a
  # transient Supabase hiccup never got recorded anywhere).
  node scripts/exportScoredPlayerUuids.mjs > "$UUID_FILE" 2>> "$LOG"
fi

UUID_COUNT=$(wc -l < "$UUID_FILE" | tr -d ' ')
echo "$(date) :: target list has $UUID_COUNT players." | tee -a "$LOG"
if [ "$UUID_COUNT" -lt 1000 ]; then
  echo "$(date) :: ABORTING — expected ~13,000-15,000+ players, got $UUID_COUNT. Check the log above for the real error before rerunning." | tee -a "$LOG"
  exit 1
fi

for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
  echo "=== attempt $attempt/$MAX_ATTEMPTS · $(date) ===" | tee -a "$LOG"
  # v2 — stream straight to the log via tee instead of buffering the whole
  # attempt's output in a shell variable ($(...)) and only writing it out
  # once the command exits. The buffered version left `tail -f` showing
  # nothing for the entire multi-hour duration of an attempt, which looked
  # indistinguishable from a hang. TMP_OUT keeps a copy just for this
  # iteration's own quota-message check below (grepping the whole
  # cumulative $LOG would also match quota hits from earlier attempts/days).
  TMP_OUT=$(mktemp)
  FORCE=1 SEASON=2025 DELAY_MS=250 TARGET_UUIDS_FILE="$UUID_FILE" node scripts/enrichPlayerStats.mjs 2>&1 | tee -a "$LOG" "$TMP_OUT"

  if grep -qi "request limit for the day" "$TMP_OUT"; then
    echo "$(date) :: hit the daily quota this attempt — sleeping ${SLEEP_SECS}s before retrying." | tee -a "$LOG"
    rm -f "$TMP_OUT"
    sleep "$SLEEP_SECS"
    continue
  fi

  rm -f "$TMP_OUT"
  echo "$(date) :: attempt $attempt finished with no quota hit — sweep is done." | tee -a "$LOG"
  echo "ALL DONE" | tee -a "$LOG"
  exit 0
done

echo "$(date) :: hit MAX_ATTEMPTS ($MAX_ATTEMPTS) without a clean finish — check $LOG and rerun if needed." | tee -a "$LOG"
exit 1
