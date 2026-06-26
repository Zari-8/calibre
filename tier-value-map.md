# Calibre — Tier Value Map

Free → **Scout** → **Club (€100/mo)** → **Dossier (€499 one-time)**

The ladder is built on three axes at once: **depth per player** (how much of the
analysis you see), **breadth / volume** (how much you can run), and **feature
access** (which tools unlock). Each tier moves you up all three.

---

## Who each tier is for

| Tier | Buyer | One-line job |
|---|---|---|
| **Free** | Curious fans, first-time visitors, social traffic | Prove the engine is sharp — give a real verdict, hold back the reasoning |
| **Scout** | Individual scouts, agents, analysts, smaller media | The full per-deal read on any player, on demand, exportable |
| **Club** (€100/mo) | Championship-level clubs, agencies, smaller sporting directors | Fit + context + volume — the recruitment-desk toolkit |
| **Dossier** (€499) | A club making an actual signing decision | One bespoke, commissioned brief that answers the whole DoF framework |

The first three are the subscription ladder. **Dossier is a product, not a tier** —
a commissioned add-on anyone can buy (the public request form), priced per brief.

---

## The three axes, tier by tier

**Depth per player** — what you actually see in an analysis
- Free → the *what*: verdict + Calibre Value (point estimate)
- Scout → + the *why*: fair range, max sensible bid, premium %, age curve, comparables
- Club → + the *context*: full System Fit, key stats, role radar, best-fit club ranking, compare
- Dossier → + the *judgement*: opportunity cost, deal structure, 40-point scorecard, qualitative read

**Breadth / volume** — how much you can run
- Free → capped (e.g. a few analyses / fit checks per day)
- Scout → individual unlimited
- Club → unlimited + multiple seats for the recruitment desk
- Dossier → n/a (one commissioned brief at a time)

**Feature access** — which tools unlock (see matrix below)

---

## Feature × tier matrix

| Capability | Free | Scout | Club | Dossier |
|---|:--:|:--:|:--:|:--:|
| Player search + Calibre rating | ✓ | ✓ | ✓ | ✓ |
| Transfer verdict (DEAL / NEGOTIATE / WALK…) | ✓ | ✓ | ✓ | ✓ |
| Calibre Value (point estimate) | ✓ | ✓ | ✓ | ✓ |
| Full valuation breakdown (fair range, max bid, premium, age curve) | locked preview | ✓ | ✓ | ✓ |
| Comparables (DB-sourced, same position + rating) | — | ✓ | ✓ | ✓ |
| Deal Report PDF | — | ✓ | ✓ | ✓ (richer) |
| System Fit score (player × club) | ✓ (capped) | ✓ | ✓ | ✓ |
| System Fit full read (key stats, role radar, lineup, best-fit ranking) | — | limited | ✓ | ✓ |
| Compare two live players | — | — | ✓ | ✓ |
| System Fit exports (PDF / CSV) | — | — | ✓ | ✓ |
| Volume | capped | individual ∞ | club ∞ + seats | per-commission |
| 40-point DoF dossier (opportunity cost, deal structure, scorecard) | — | — | — | ✓ |
| Token-gated, watermarked delivery | — | — | — | ✓ |

---

## Where the upgrade pressure comes from

The ladder only works if each wall is hit at a natural moment of wanting more.

- **Free → Scout** — they get a verdict they believe, then hit the locked
  breakdown / can't export. "I trust the call; now I need the reasoning to act on it."
- **Scout → Club** — an individual who keeps checking *fit* (does he suit our
  system?), wants to compare two targets, or needs more than one seat. Fit + compare
  + volume are the Club moat.
- **Any → Dossier** — a real signing is on the table and a €100/mo subscription
  read isn't enough; they want one defensible, bespoke, board-ready brief. €499 is
  cheap against an eight-figure transfer.

---

## What's already enforced in code vs. what to build

**Already gated (live):**
- Deal Report PDF → `Scout+` (via `access.js` → `hasPaidAccess`)
- System Fit exports → paid tiers (just moved off the open default)
- Owner email → `founder` everywhere (full access)

**To implement next (the gates this map implies):**
1. **Free-tier depth wall on Transfers** — show verdict + value, lock the full
   breakdown + comparables behind `Scout+` (blur/teaser, not removal — the lock
   is the upgrade prompt).
2. **System Fit tiering** — score visible to all (capped for Free), full read +
   compare + exports behind `Club`. Today `hasPaidAccess` treats Scout and Club
   the same; split them so Club has a real reason to exist above Scout.
3. **Volume caps** — a simple per-day counter for Free (analyses + fit checks).
4. **Seats** — Club allows >1 login under one org (later; needs auth work).

This means `access.js` should grow from a binary `hasPaidAccess` into a small
capability check, e.g. `can(tier, 'systemFit.full')` / `can(tier, 'compare')` /
`can(tier, 'export')`, so each feature reads its own gate instead of one flag.

---

## Open decisions (yours to set)

- **Scout price point.** Not yet fixed. Anchored below Club (€100/mo); a common
  individual-pro band would be ~€15–€29/mo. Lower = more Free→Scout conversion and a
  softer step to Club; higher = fewer but better-qualified Scout subs. Your call.
- **Free volume cap.** How generous? Too tight and the engine never earns trust;
  too loose and Scout has no pull. A few full analyses/day is a reasonable start.
- **Does Scout get System Fit at all?** Map above gives Scout a *limited* fit read
  and reserves the full desk for Club. Alternative: Scout gets full fit, and Club's
  moat becomes purely volume + seats + compare. The first keeps Club differentiated
  on capability, not just quantity — recommended.
