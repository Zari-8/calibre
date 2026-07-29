#!/usr/bin/env bash
# scripts/run_enrichment_loop.sh
#
# Runs the SCOPED enrichment sweep -- targeting ONLY players within the real
# scored population (~15,177 rows) who are still missing real data
# (unenriched_player_uuids.txt, regenerated fresh before every attempt) --
# on a retry loop, because API-Football's daily request quota will very
# likely get hit again partway through. Each attempt's output is checked for
# the quota message; if found, it sleeps until the next 00:00 UTC reset and
# retries. If a whole attempt completes with no quota hit and nothing left
# to enrich, the sweep is done and the loop stops.
#
# Wrap this in `caffeinate` so the Mac doesn't sleep mid-run (see the actual
# invocation at the bottom of the chat message this came with).
#
# Usage: bash scripts/run_enrichment_loop.sh
set -uo pipefail
cd "$(dirname "$0")/.."

UUID_FILE="unenriched_player_uuids.txt"
LOG="enrichPlayerStats_scored_$(date +%Y%m%d).log"

# v4 — was targeting the FULL scored population (scored_player_uuids.txt,
# ~15,177 rows) with FORCE=1 on every single attempt, which reprocesses
# EVERY row every time -- including ones already fully enriched days ago.
# Confirmed 2026-07-26: R. Calafiori succeeded with the IDENTICAL result on
# 2026-07-21, 23, 24, and 26 -- four real API calls spent re-confirming data
# we already had, while the still-unenriched rows waited their turn. Now
# regenerates a list of ONLY players still missing real data (stats_season
# IS NULL) fresh before EVERY attempt, so quota only ever goes toward rows
# that actually still need it, and the target list shrinks as real progress
# lands instead of dragging the full population along for the whole sweep.
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

# Regenerate the still-unenriched list right now, before the loop even
# starts, so the very first attempt already targets only what's left.
#
# v5 — CRITICAL bug found 2026-07-26, cost a full relaunch cycle for nothing:
# this used to just check "is the file empty" to decide whether the sweep
# was done. But if the export query itself fails (transient Supabase error,
# e.g. from firing several queries back-to-back right after a kill+relaunch),
# exportUnenrichedPlayerUuids.mjs exits non-zero and produces an EMPTY file
# as a side effect of failing early -- which looked IDENTICAL to "genuinely
# 0 players left," so the loop declared false victory and exited in seconds,
# doing zero work. Now checks the export command's own exit code FIRST: a
# real failure is treated as a transient error and retried, never as "done."
regenerate_uuid_file() {
  echo "$(date) :: regenerating $UUID_FILE (players still missing real stats_season)..." | tee -a "$LOG"
  # Capture stderr into the log too — a silent failure here previously left
  # an empty file with zero explanation (the outer launch command's own
  # stderr was going to /dev/null, so a transient Supabase hiccup never got
  # recorded anywhere).
  node scripts/exportUnenrichedPlayerUuids.mjs > "$UUID_FILE" 2>> "$LOG"
  return $?
}

# Retries the export itself on failure (separate from the network-retry
# budget below, since this can happen before enrichPlayerStats.mjs even
# starts) -- up to 5 tries, 30s apart, before giving up for good.
regenerate_uuid_file_or_die() {
  for try in 1 2 3 4 5; do
    if regenerate_uuid_file; then
      return 0
    fi
    echo "$(date) :: regenerating $UUID_FILE FAILED (exit code from exportUnenrichedPlayerUuids.mjs) -- this is NOT the same as 'nothing left to enrich.' Retry $try/5 in 30s." | tee -a "$LOG"
    sleep 30
  done
  echo "$(date) :: FATAL — regenerating $UUID_FILE failed 5 times in a row. Not declaring the sweep done (that would be wrong); stopping instead so this doesn't silently look like completion. Check $LOG and rerun." | tee -a "$LOG"
  exit 1
}

regenerate_uuid_file_or_die
# v6 — 2026-07-29: `wc -l` counts NEWLINES, not real UUIDs. When
# exportUnenrichedPlayerUuids.mjs finds zero eligible candidates, the file
# used to still contain one blank line (from console.log('') on an empty
# array), which wc -l read as "1 still-unenriched player" -- a false
# positive that let the loop proceed into a live attempt with nothing real
# to target, causing enrichPlayerStats.mjs to silently fall back to its own
# unrestricted default query and burn quota on ~250 unrelated players for
# zero real progress. grep -c '\S' counts only lines with a real
# (non-whitespace) UUID on them, so a blank-line-only file correctly counts
# as 0. (The exporter is now also fixed to never emit that blank line, but
# this check no longer depends on that alone.)
UUID_COUNT=$(grep -c '\S' "$UUID_FILE" 2>/dev/null | tr -d ' ')
UUID_COUNT=${UUID_COUNT:-0}
echo "$(date) :: target list has $UUID_COUNT still-unenriched players." | tee -a "$LOG"
if [ "$UUID_COUNT" -eq 0 ]; then
  echo "$(date) :: nothing left to enrich — every scored player already has real data. ALL DONE." | tee -a "$LOG"
  exit 0
fi

for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
  # Regenerate on every attempt (not just once) -- shrinks as real progress
  # lands from the previous attempt, so a retry never re-targets rows that
  # just succeeded.
  if [ "$attempt" -gt 1 ]; then
    regenerate_uuid_file_or_die
    UUID_COUNT=$(grep -c '\S' "$UUID_FILE" 2>/dev/null | tr -d ' ')
    UUID_COUNT=${UUID_COUNT:-0}
    if [ "$UUID_COUNT" -eq 0 ]; then
      echo "$(date) :: nothing left to enrich — every scored player already has real data. ALL DONE." | tee -a "$LOG"
      exit 0
    fi
  fi
  echo "=== attempt $attempt/$MAX_ATTEMPTS · $(date) :: $UUID_COUNT still-unenriched players ===" | tee -a "$LOG"

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
