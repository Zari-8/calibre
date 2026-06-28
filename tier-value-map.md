# Calibre — Tier Value Map (reconciled to live pricing)

Free → **Pro ($4.99/mo)** → **Scout ($19/mo)** → **Club ($99/mo)** → **Dossier ($499 one-time)**
Promo: **World Cup Founder Pass — $8.99 one-time, 2 months of Pro.**

All prices **USD** (the live page is in dollars; the dossier moves from €499 → $499 to match).

---

## Go-to-market note (influencer-first)

First customers are **influencers/analysts**, not clubs — people who'll pay ~$25
to access System Fit so they can sound expert on their platforms. Clubs move last,
once there's noise. So **System Fit lives at Scout**, not Club. Club becomes the
pure team/enterprise tier (seats, shared workflows, API, custom contracts) — the
things only an organisation needs. The analysis is Scout; the org tooling is Club.

## Reconciliation note

The live pricing page was written in *debate / fan* language ("Rate Battles",
"GOAT debate tools", "watchlists") and predates the scouting build. System Fit,
DB-sourced comparables, the Deal Report PDF, and the commissioned dossier are
**not yet surfaced on it**. This doc reconciles what's actually built against the
four live tiers, and flags where the page copy needs updating.

Legend: **[live]** = built & gated in code · **[planned]** = on the page, not built yet

---

## Tier table — built features mapped to live tiers

| Capability | Free | Pro | Scout | Club | Status |
|---|:--:|:--:|:--:|:--:|---|
| Rate Battles / GOAT debates / public feed | ✓ | ✓ | ✓ | ✓ | [live] |
| Player search + Calibre rating | ✓ | ✓ | ✓ | ✓ | [live] |
| Transfer verdict + Calibre Value (point) | ✓ | ✓ | ✓ | ✓ | [live] `valuation.verdict` |
| Full valuation breakdown (fair range, max bid, premium, age curve) | — | ✓ | ✓ | ✓ | [live] `valuation.breakdown` |
| Unlimited analyses (Free is rate-capped) | — | ✓ | ✓ | ✓ | [live] `volume.unlimited` |
| Debate / comparison exports (PDF·CSV) | — | ✓ | ✓ | ✓ | [planned] |
| Watchlists · extended history · advanced filters | — | ✓ | ✓ | ✓ | [planned] |
| Comparables = **Similar-player finder** | — | — | ✓ | ✓ | [live] `valuation.comparables` |
| **Deal Report PDF** (scout notes & exports) | — | — | ✓ | ✓ | [live] `valuation.report` |
| Youth trajectory · career pathway modelling | — | — | ✓ | ✓ | [planned] |
| System Fit score (basic) | ✓ (capped) | ✓ | ✓ | ✓ | [live] `fit.score` |
| **Full System Fit desk** (breakdown, role radar, lineup, best-fit ranking) | — | — | ✓ | ✓ | [live] `fit.full` |
| **Compare two live players** | — | — | ✓ | ✓ | [live] `fit.compare` |
| **System Fit exports (PDF/CSV)** | — | — | ✓ | ✓ | [live] `fit.export` |
| Team workflows (seats, shared lists) | — | — | — | ✓ | [planned] |
| Higher data limits · deeper API access | — | — | — | ✓ | [planned] |
| Custom contracts | — | — | — | ✓ | sales hook |
| **Commissioned dossier** (40-pt DoF brief) | add-on | add-on | add-on | add-on | [live] $499 |

---

## The export question (resolved)

The page promises "PDF and CSV report exports" at **Pro**, but the code gates the
scouting Deal Report to **Scout** and System Fit/CSV to **Club**. These are two
different artifacts — keep them separate on the page:

- **Pro** → debate-card / player-comparison exports (the fan product)
- **Scout** → the **Deal Report PDF** (`valuation.report`) — a scouting artifact
- **Scout** → **System Fit exports (PDF/CSV)** (`fit.export`)

No code change needed; the page wording just needs to distinguish them.

---

## "Team workflows" — what it actually means (Club)

This is the vague bullet that, in reality, is **everything we've been building for
the Club tier**. Concretely, Team workflows = the multi-seat club account:

- **Seats** — several staff under one club/org login (not one shared password)
- **Shared shortlists & watchlists** — a target list the whole desk sees
- **Assign targets** to colleagues; **shared scout notes** on a player
- **A collaborative recruitment board** — pipeline of who's being assessed
- **The full System Fit desk** (fit breakdown, compare, best-fit ranking, exports)
- **Saved dossiers** for the club in one place

So "Team workflows" isn't a single feature — it's the label for the Club desk:
**System Fit (built) + seats + shared lists (to build)**. That's the Club moat,
and right now the page doesn't say any of it. It should.

---

## "Custom contracts available" — what it means (Club)

Two readings; recommend the commercial one and split out the other:

1. **Commercial terms (recommended meaning).** Bespoke deals negotiated directly:
   annual/enterprise billing, volume/multi-club licensing, higher API limits and
   SLAs, bundled commissioned dossiers. Practically a **"Contact us"** CTA on the
   Club card — not a self-serve feature. This is the enterprise sales hook.
2. **Commissioned dossiers.** If "custom contracts" was meant as *bespoke
   deliverables*, that's the **$499 Dossier** — surface it as its own add-on
   (the public request form we built), not buried in a Club bullet, to avoid
   confusion.

Keep (1) as the Club "Contact us" line; promote (2) to a visible Dossier add-on.

---

## Open decisions

- **Currency:** standardize on USD (done in this doc + access.js). If ContiPay
  settles in ZWL/USD, display stays USD; only the gateway handles conversion.
- **Dossier on the pricing page:** add a slim "Commission a dossier — $499"
  add-on strip below the four tiers (links to the request form), so the $499
  product is discoverable, not hidden inside the Transfers analysis card.
- **Pricing-page copy is stale:** Free/Pro/Scout/Club bullets don't mention
  System Fit, comparables, the Deal Report, or the dossier. The page should be
  rewritten to surface what's actually built (see the tier table above).

---

## Capability model (`src/services/access.js`)

Every gate reads `can(tier, capability)` against `free < pro < scout < club <
founder`. To add a gate: one line in the `CAPABILITIES` map + one `can()` call at
the feature. Current gates: `valuation.breakdown` (Pro+), `valuation.comparables`
/ `valuation.report` / `fit.full` / `fit.compare` / `fit.export` (Scout+),
`valuation.dossier` (Club+), `volume.unlimited` (Pro+).
