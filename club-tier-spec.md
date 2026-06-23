# Calibre Club Tier (€100/month) — Build Spec

Consolidated from prior strategy sessions. Build-from-later reference.

---

## 1. Buyer Reality Check

€100/month is not enterprise pricing. Premier League clubs pay ~€100k/year for Wyscout — they are not the buyer here. The realistic buyer at this price point:

- Championship / Ligue 2 / Eredivisie clubs
- Agents
- Sporting directors at smaller clubs
- Serious football media
- Intermediaries

The value proposition is **not** "more data than the big clubs have." It's:
1. **Synthesis** the smaller club can't do in-house (no analytics department)
2. **Coverage** of players the big platforms don't bother profiling

If true big-six pricing is ever wanted, that's a different product (per-deal, €500–1,000) — which is what the Dossier tier already is. Club tier and Dossier tier are deliberately different buyers, not the same buyer at different price points.

---

## 2. Buildable Now — No New Data Integrations

These use data Calibre already has (Supabase + API-Football + StatsBomb).

| Feature | Description |
|---|---|
| **Squad context + depth chart** | Incumbent depth chart, named players, contract years, knock-on effect on minutes if a signing arrives, who likely exits |
| **Role specificity / chemistry** | Fit with existing teammates in their actual tactical role |
| **Set-piece value** | From StatsBomb data where available |
| **Opportunity cost** | 5 alternative players, same position/age band, lower cost — e.g. "for €30M less, sign X who rates 4 points lower." High-leverage, easy to build, brutally useful for boards |
| **Shirt sales projection + brand fit** | Model-based, with explicit inputs/ranges |
| **Sample-size confidence** | Statistical reliability flag on a player's underlying numbers |
| **League-jump difficulty** | Adaptation difficulty scoring across league quality tiers |
| **Sell-on velocity / resale modeling** | Resale value trajectory |
| **PSR modeling** | Profit & Sustainability Rules impact |
| **Academy displacement** | If academy player ages/ratings exist in DB: flag signings that block a rated academy player's pathway |

**Suggested build priority (impact-per-build-day):**
1. Squad context + depth chart + knock-on effects — biggest decision-grade value
2. Opportunity cost — easy from existing DB, high perceived value
3. Commercial: shirt sales + brand fit + market opening — actual differentiator at this price point

---

## 3. Needs New Data Integration (1–3 weeks each)

| Feature | Source |
|---|---|
| Injury history | API-Football `/injuries` endpoint — already paid for, currently unused. **Lowest-hanging fruit.** |
| Discipline (cards) | API-Football |
| Contract / agent info | Transfermarkt scrape |
| Social media following | Social Blade or manual seed |
| National team duty | API-Football fixtures |
| Known sponsor conflicts | Editorial / manual entry |

---

## 4. Qualitative / Non-Quantifiable — Deliver as Framework, Not a Score

Family/lifestyle, manager preference, dressing room dynamics, cultural fit. These should **not** be presented as a Calibre-generated number — they're hard to defend at that level of confidence. Deliver instead as a structured checklist that prompts the club's own internal discussion, the way a McKinsey deck frames open questions rather than answering them outright.

This directly informs the open Page 8 (Character & Culture) decision on the Dossier tier — same underlying data problem, same proposed solution: frame as structured prompts, not scored output.

---

## 5. Overlap With Dossier Tier

Several Club-tier building blocks are shared infrastructure with the Dossier product, not separate builds:

| Shared component | Club tier use | Dossier tier use |
|---|---|---|
| Squad context + depth chart | Core feature | Dossier Page 4 (Squad Context) — the section sporting directors actually pay for |
| Opportunity cost | Core feature | Feeds dossier's alternative-target framing |
| Commercial modeling (shirt sales, brand fit) | Core feature | Dossier Page 7 (Commercial Impact) |
| Qualitative/character framework | Checklist format | Same checklist format — Page 8 unresolved decision |

**Practical implication:** build these as shared backend modules/components once, surfaced differently — lighter/summary view in Club tier, full editorial-narrated version in Dossier. Don't build twice.

---

## 6. Editorial Layer — Hybrid Model

Confirmed approach: automated generation for Scout/Club tiers (engine fills numbers and templated prose), your editorial pass reserved for Dossier tier only. Club tier should not require manual editorial time per user — it needs to scale without you in the loop.

---

## 7. Open Questions

1. **Pricing/tier-gating for Dossier** — still undecided whether Dossier requires an active subscription or is buyable standalone (opens it to journalists/intermediaries who don't want recurring billing).
2. **Academy displacement** — depends on whether academy player data already exists in Supabase at sufficient quality; needs a data audit before this feature is buildable.
3. **Injury endpoint** — confirmed lowest-effort win since you already pay for it; worth scheduling first among the "needs integration" list.
