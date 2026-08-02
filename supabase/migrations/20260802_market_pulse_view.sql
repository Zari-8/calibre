-- ─────────────────────────────────────────────────────────────────────────
-- Calibre — market_pulse view: fix fabricated age labels + first tracked copy
--
-- FINDING (2026-08-02 audit): like `transfers` itself, `market_pulse` had no
-- migration file anywhere in this repo — the only copy of its definition was
-- live in Supabase. Pulled via `select pg_get_viewdef('public.market_pulse',
-- true)` during the audit.
--
-- BUG: `best_value_lane` and `highest_risk_lane` labelled their output
-- `concat('U23 ', position)` and `concat('Teen ', position)` — but the
-- `transfers` table has NO age/date-of-birth column at all (confirmed via
-- every query against it across the codebase), so neither subquery ever
-- filtered by age anywhere. The labels were fabricated: a completed transfer
-- for a 29-year-old centre-back could come back labelled "U23 CB", a rumour
-- involving a 26-year-old winger could show up as "Teen ST". This view feeds
-- the Transfers page's "Market Pulse" stat card directly (see
-- fetchMarketPulse() in src/pages/Transfers.jsx) with nothing downstream
-- questioning the label, so it would have shown a confidently wrong age claim
-- to every visitor as soon as `transfers` had enough rows to populate it.
--
-- FIX: drop the fabricated prefixes. The view now returns the bare position
-- code (e.g. "CB", "ST") for both fields, same as `most_inflated_position`
-- already did correctly — honest about what's actually being measured
-- (a position, not an age cohort) rather than silently correct only because
-- the table happened to have too little data to expose the mislabel yet.
-- A real age-scoped version would need `transfers` to carry (or reliably
-- join to `players` for) a player age/date-of-birth — `transfers.
-- api_player_id` is documented elsewhere in this codebase as "frequently
-- null/stale," so that join isn't trustworthy enough to build on tonight.
--
-- Also switches the two subqueries' `security definer`-equivalent risk to a
-- non-issue by using CREATE OR REPLACE VIEW (views inherit the calling
-- role's RLS by default unless SECURITY DEFINER is explicitly set, which
-- this view never was — only three OTHER views were flagged for that in
-- today's Security Advisor run, market_pulse wasn't one of them).
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.market_pulse AS
SELECT
  (
    SELECT t.position
    FROM public.transfers t
    WHERE t.fee_millions IS NOT NULL
      AND t.market_value IS NOT NULL
      AND t.market_value > 0
      AND t.status = 'done'
    GROUP BY t.position
    ORDER BY avg((t.fee_millions - t.market_value) / t.market_value * 100) DESC
    LIMIT 1
  ) AS most_inflated_position,

  round(avg(
    CASE
      WHEN fee_millions IS NOT NULL AND market_value IS NOT NULL AND market_value > 0
        THEN (fee_millions - market_value) / market_value * 100
      ELSE NULL
    END
  )) AS avg_premium_pct,

  -- was: concat('U23 ', position) — no age data backs that prefix, see note above
  (
    SELECT t.position
    FROM public.transfers t
    WHERE t.fee_millions IS NOT NULL
      AND t.market_value IS NOT NULL
      AND t.market_value > 0
      AND t.status = 'done'
      AND t.fee_millions < (t.market_value * 1.2)
    GROUP BY t.position
    ORDER BY avg(t.fee_millions / t.market_value)
    LIMIT 1
  ) AS best_value_lane,

  -- was: concat('Teen ', position) — no age data backs that prefix, see note above
  (
    SELECT t.position
    FROM public.transfers t
    WHERE t.fee_millions IS NOT NULL
      AND t.market_value IS NOT NULL
      AND t.market_value > 0
      AND t.status = ANY (ARRAY['rumour', 'premium'])
    GROUP BY t.position
    ORDER BY avg(t.fee_millions / t.market_value) DESC
    LIMIT 1
  ) AS highest_risk_lane,

  (
    SELECT count(*)
    FROM public.transfers t
    WHERE t.status = 'done' AND t.season = '2026-27'
  ) AS transfers_done,

  round(avg(
    CASE
      WHEN fee_millions IS NOT NULL AND market_value IS NOT NULL AND market_value > 0 AND status = 'done'
        THEN fee_millions / market_value * 100
      ELSE NULL
    END
  )) AS avg_fee_vs_tm_pct

FROM public.transfers
WHERE season = '2026-27';
