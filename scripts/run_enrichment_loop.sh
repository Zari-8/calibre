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
MAX_ATTEMPTS=4        # 4 attempts x ~1 quota-day sleep = ~4-day ceiling

# v3 — API-Football's dashboard (checked 2026-07-25) confirms the Pro plan
# resets at a FIXED clock time, 00h00 UTC, not "24h after whenever we last
# got hit." A flat 86400s sleep drifts away from that boundary: hit the wall
# at 6pm, sleep 24h, and you resume at 6pm the next day -- many hours after
# the real 00:00 UTC reset already happened, wasting most of a day's quota.
# seconds_until_utc_midnight computes the exact wait instead, so a retry
# always lands right at (or just after) the real reset.
seconds_until_utc_midnight() {
  local now_epoch seconds_into_day
  now_epoch=$(date -u +%s)
  seconds_into_day=$(( now_epoch % 86400 ))
  echo $(( 86400 - seconds_into_day + 120 ))   # +120s buffer past the exact boundary
}

# v2 — a sustained network/wifi outage (or a Supabase blip) produces NO quota
# message at all: every row just fails fast with something like "fetch failed"
# (enrichPlayerStats.mjs's own apiGet retries ~5s per call, then gives up and
# throws), the whole target list burns through quickly with nothing written,
# and the script still exits cleanly (0). Before this fix the loop only
# checked for the quota string, so it would misread that clean-but-fruitless
# pass as "sweep is done" and stop for good after a wifi blip. This regex
# catches those transient-network signatures (same ones apiGet/updateWithRetry
# already treat as retryable internally) so the OUTER loop retries too,
# instead of falsely declaring victory.
NETWORK_ERR_RE='fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|Supabase read failed|socket hang up|network'
RETRY_SHORT_SECS=900   # 15 minutes -- network blips are usually far shorter-lived than a daily quota reset
# Network retries get their OWN budget, separate from MAX_ATTEMPTS (the
# quota-day budget) -- they used to share one counter, so a handful of wifi
# blips could burn through the entire multi-day quota allowance and end the
# whole sweep in about an hour, long before a real quota reset ever happened.
NETWORK_MAX_RETRIES=20 # 20 x 15min = 5h of network-blip tolerance per attempt, doesn't touch MAX_ATTEMPTS

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

  network_retry=0
  while true; do
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
      WAIT=$(seconds_until_utc_midnight)
      echo "$(date) :: hit the daily quota this attempt — sleeping ${WAIT}s until just after 00:00 UTC reset (not a flat 24h) before retrying." | tee -a "$LOG"
      rm -f "$TMP_OUT"
      sleep "$WAIT"
      break   # consumes one of the outer MAX_ATTEMPTS (quota-day budget)
    fi

    if grep -qiE "$NETWORK_ERR_RE" "$TMP_OUT"; then
      network_retry=$((network_retry + 1))
      if [ "$network_retry" -ge "$NETWORK_MAX_RETRIES" ]; then
        echo "$(date) :: $NETWORK_MAX_RETRIES network retries in a row with no recovery — this looks like more than a blip. Stopping; check your connection and rerun." | tee -a "$LOG"
        rm -f "$TMP_OUT"
        exit 1
      fi
      echo "$(date) :: transient network/Supabase errors (not the daily quota) — sleeping ${RETRY_SHORT_SECS}s before retrying (network retry $network_retry/$NETWORK_MAX_RETRIES, does not count against the $MAX_ATTEMPTS quota-day budget)." | tee -a "$LOG"
      rm -f "$TMP_OUT"
      sleep "$RETRY_SHORT_SECS"
      continue  # stays inside this attempt, does NOT consume MAX_ATTEMPTS
    fi

    rm -f "$TMP_OUT"
    echo "$(date) :: attempt $attempt finished with no quota hit and no network errors — sweep is done." | tee -a "$LOG"
    echo "ALL DONE" | tee -a "$LOG"
    exit 0
  done
done

echo "$(date) :: hit MAX_ATTEMPTS ($MAX_ATTEMPTS) without a clean finish — check $LOG and rerun if needed." | tee -a "$LOG"
exit 1
