# Calibre — Tier Value Map

Free → **Pro (€4.99/mo)** → **Scout (€24.99/mo)** → **Club (€100/mo)** → **Dossier (€499 one-time)**

The ladder is built on three axes at once: **depth per player** (how much of the
analysis you see), **breadth / volume** (how much you can run), and **feature
access** (which tools unlock). Each tier moves you up all three.

---

## Why five tiers, not four

The jump from Free directly to Scout (€24.99) eliminates a huge cohort of users
in Nigeria, India, Zimbabwe, and across Africa and South Asia — people who are
often the most engaged early users and best word-of-mouth vectors. €29 is a
barrier; €4.99 is a considered but real buy for a scout or analyst who doesn't
derive direct monetary benefit from the platform.

**Pro at €4.99 is a volume tier.** 200 Pro subscribers = €1k/mo and broad market
signal. 20 Scout subscribers at €29 = same revenue, far thinner reach. Pro earns
trust, grows the base, and creates a natural upgrade path to Scout once the user
sees what's locked.

---

## Who each tier is for

| Tier | Price | Buyer | One-line job |
|---|---|---|---|
| **Free** | — | Fans, first-timers, social traffic | Prove the engine is sharp; give a verdict, hold back the reasoning |
| **Pro** | €4.99/mo | Global scouts, analysts, data fans, emerging-market users | Full valuation reasoning + unlimited analyses — the "I believe in this" tier |
| **Scout** | €24.99/mo | Agents, individual scouts at mid/large clubs, football media | Full deal toolkit — comparables, PDF report, reasoning chain |
| **Club** | €100/mo | Championship-level clubs, agencies, smaller sporting directors | Recruitment desk — System Fit depth, compare, exports, volume |
| **Dossier** | €499 one-time | A club making an actual signing decision | One bespoke commissioned brief answering the full DoF framework |

**Dossier is a product, not a subscription tier** — a commissioned add-on
available to anyone via the public request form, priced per brief.

---

## The three axes, tier by tier

**Depth per player — what you actually see**
- Free → the *what*: verdict + Calibre Value (point estimate)
- Pro → + the *why*: fair range, max bid, premium %, age curve
- Scout → + the *toolkit*: comparables, Deal Report PDF
- Club → + the *context*: full System Fit, key stats, role radar, compare, best-fit ranking
- Dossier → + the *judgement*: opportunity cost, deal structure, 40-pt scorecard, qualitative read

**Volume — how much you can run**
- Free → capped (rate limit on analyses + fit checks)
- Pro → individual unlimited
- Scout → individual unlimited
- Club → club-unlimited + multiple seats
- Dossier → per-commission

**Feature access — which tools unlock**

---

## Feature × tier matrix

| Capability | Free | Pro | Scout | Club | Dossier |
|---|:--:|:--:|:--:|:--:|:--:|
| Player search + Calibre rating | ✓ | ✓ | ✓ | ✓ | ✓ |
| Transfer verdict (DEAL / NEGOTIATE…) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Calibre Value (point estimate) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Full valuation breakdown (fair range, max bid, premium, age curve) | — | ✓ | ✓ | ✓ | ✓ |
| Unlimited analyses | — | ✓ | ✓ | ✓ | ✓ |
| Comparables (DB-sourced, same position + rating) | — | — | ✓ | ✓ | ✓ |
| Deal Report PDF | — | — | ✓ | ✓ | ✓ (richer) |
| System Fit score (basic) | ✓ (capped) | ✓ | ✓ | ✓ | ✓ |
| System Fit full read (key stats, role radar, lineup, best-fit) | — | — | — | ✓ | ✓ |
| Compare two live players | — | — | — | ✓ | ✓ |
| System Fit exports (PDF / CSV) | — | — | — | ✓ | ✓ |
| Club seats (multi-user) | — | — | — | ✓ | — |
| 40-point DoF dossier (commissioned) | — | — | — | — | ✓ |
| Token-gated, watermarked delivery | — | — | — | — | ✓ |

---

## Upgrade pressure — where each wall is hit

The ladder only works if each gate is hit at a natural moment of wanting more.

- **Free → Pro** — they get a verdict they trust, then hit the locked breakdown.
  "I believe the call; now I need the *reasoning* to act on it." €4.99 removes the
  friction for emerging-market users who'd bounce at €25.
- **Pro → Scout** — the analyst who's been running unlimited analyses wants to
  *share* work (PDF report) or see *who else is comparable* (comparables tab).
  Both are locked to Scout, which is the natural step for anyone using Calibre
  professionally.
- **Scout → Club** — an individual who keeps checking *does he suit our system?*
  and wants to compare two targets, or needs a second seat. Fit depth + compare +
  exports are the Club moat.
- **Any → Dossier** — a real signing is on the table and a subscription read
  isn't enough. They want one defensible, board-ready brief. €499 is cheap against
  an eight-figure transfer.

---

## Capability model in code (`src/services/access.js`)

`access.js` now implements `can(tier, capability)` instead of a single
`hasPaidAccess` flag. Every gate in the app reads its own capability:

```js
can(tier, 'valuation.breakdown')   // Pro+
can(tier, 'valuation.comparables') // Scout+
can(tier, 'valuation.report')      // Scout+ (Deal Report PDF)
can(tier, 'valuation.dossier')     // Club+  (founder dossier overlay)
can(tier, 'fit.score')             // Free   (capped)
can(tier, 'fit.full')              // Club+
can(tier, 'fit.compare')           // Club+
can(tier, 'fit.export')            // Club+
can(tier, 'volume.unlimited')      // Pro+
```

To add a new gate: add one line to the `CAPABILITIES` map in `access.js` with
the minimum tier, then call `can(tier, 'your.capability')` at the feature site.
No other change needed.

---

## What's already enforced vs. what to build next

**Already live:**
- Deal Report PDF → `can(tier, 'valuation.report')` (Scout+)
- System Fit exports → `can(tier, 'fit.export')` (Club+)
- System Fit full/compare → `can(tier, 'fit.full')` / `can(tier, 'fit.compare')` (Club+)
- Founder dossier overlay → `can(tier, 'valuation.dossier')` (Club+)
- Owner email → `founder` everywhere

**To build next (in priority order):**
1. **Free/Pro depth wall on Transfers** — show verdict + value to all; lock the
   full breakdown + comparables behind Pro/Scout (blur/teaser, not removal — the
   lock IS the upgrade prompt)
2. **Volume cap for Free** — simple per-day counter (analyses + fit checks)
3. **Pricing/upgrade page** — the five-tier ladder as a public page with ContiPay
   payment links
4. **Seats** — Club multi-user (needs Supabase auth work, defer)

---

## Open decisions (yours to set)

- **Scout price.** Set at €24.99 in this doc — adjust up or down depending on
  early conversion data. The Pro/Scout gap should feel like a meaningful step up
  in professional utility, not just more volume.
- **Free volume cap.** A few full analyses per day is a reasonable start — enough
  to experience the engine, not enough to use it as a full tool.
- **Pro System Fit access.** Map above gives Pro the basic fit score (same as
  Free, just uncapped). Alternative: let Pro see the full fit read and reserve
  compare + exports for Club. Keeping it as-is makes the Club moat cleaner.
