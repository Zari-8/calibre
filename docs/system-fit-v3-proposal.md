# System Fit — Team DNA Derivation + Fit Model v3

**Status:** proposal · **Author:** Calibre engineering · **Date:** 2026-07-05
**Sequencing (per direction):** Phase 1 (Team DNA) ships *before* Phase 2 (Fit v3).
Fit v3 consumes real derived DNA; until then the score table below uses the
current hand-authored vectors as a stand-in to prove the *formula* logic
independently of where the team vectors come from.

---

## 1. The bug, confirmed numerically

`rawFit()` compares a player's **individual per-90 traits** against a team's
**aggregate style vector**, with `control` weighted heaviest (1.4) and squared
distance punishing gaps hard. The problem: a team's `control: 94` is a
**collective** property (produced by the whole side circulating the ball). No
single box-to-box 8 or wide dribbler personally registers a control signal near
94 — so the heaviest-weighted axis manufactures a large penalty against the
player's *own* club, and any team whose aggregate sits closer to the player's
individual numbers scores higher.

Run with the real `rawFit` and real `SYSTEM_TEAMS` vectors, representative
individual player profiles, origin = Barcelona for all three:

| Player | Club | CURRENT score |
|---|---|---|
| Gavi (box-to-box 8) | **Barcelona (native)** | **65** |
| | Real Madrid | 68 ← beats native club |
| | Man City | 64 |
| Yamal (wide creator) | **Barcelona (native)** | **51** ← worst realistic fit |
| | Real Madrid | 62 |
| | Man City | 44 |
| Pedri (deep controller) | **Barcelona (native)** | **68** |
| | Real Madrid | 63 |
| | Man City | 65 ← nearly ties native |

Even Pedri — the most Barça-shaped profile imaginable — barely wins at Barça.
The `isCurrentClub()` floor (`min(97, max(score, 89))`) hides this for the exact
current club, but the underlying model is wrong, and any name-mismatch, loanee,
or academy edge case slips through and shows the true bad number.

**Root cause:** comparing an individual to a collective on the same 0–100 scale,
as if they were the same kind of quantity. Two fixes, sequenced.

---

## 2. Phase 1 — Team DNA derivation (foundation)

Today `SYSTEM_TEAMS` (54 hand-authored clubs) is tier 1 and always wins;
`derived_team_profiles` is only a fallback. Phase 1 flips that: **data-derived
DNA becomes primary; hand-authoring becomes an override/seed** for clubs the feed
can't cover.

### 2.1 Feed: TheStatsAPI (team-season aggregates)

StatsAPI is better suited than API-Football here because its team-level event
aggregates map cleanly onto the six traits:

| Trait | Derived from (team-season) |
|---|---|
| control | possession % + pass volume + final-third pass share |
| pressing | PPDA / pressures / high turnovers |
| transition | direct-play speed, counter share, progressive carries |
| width | wide-zone touches, crosses, wide entries |
| tempo | passes per minute / ball-circulation rate |
| defensiveLoad | defensive actions, blocks/clearances, deep-block share |

### 2.2 Normalization & calibration

- Each raw metric is normalized to **0–100 against the league distribution**, so
  "control" means the same thing across leagues.
- **Anchor the mapping** against 3–4 reference clubs whose DNA we know cold
  (e.g. Man City = extreme control/press; Atlético = extreme defensiveLoad;
  Liverpool/Leipzig = extreme transition/press). Tune the raw→0-100 curves until
  those anchors land where they should, then freeze the curve.

### 2.3 Pipeline

- New script `scripts/deriveTeamDNA.mjs`: pull StatsAPI team-season aggregates →
  normalize → six-trait vector → upsert into `derived_team_profiles` (schema
  already exists; `derivedTeams.js` already reads it and shapes rows identically
  to a `SYSTEM_TEAMS` entry).
- Resolution order becomes: **derived DNA → SYSTEM_TEAMS override → generic
  placeholder.** Keep `SYSTEM_TEAMS` only as the override/seed so nothing
  regresses to a placeholder for uncovered clubs.

### 2.4 Bonus that matters for Phase 2

If **both** team traits and player traits are normalized in the *same* StatsAPI
space against the same league baseline, the player-vs-team comparison finally
shares units. That removes part of the distortion on its own; the rest is the
role-aware comparison in Phase 2.

---

## 3. Phase 2 — Fit model v3

Three ideas, layered:

**(a) Directional supply axes.** Split the six axes by type:
- **Supply axes (control, tempo)** are team-provided. A team *above* the player
  on these is a *benefit* (they feed him the ball) — no penalty. Only penalize
  when the player wants *more* than the team supplies (a controller stranded at a
  direct side). Implemented as a one-sided hinge on the shortfall.
- **Style axes (transition, pressing, width, defensiveLoad)** stay symmetric —
  these describe *how* the team plays and must genuinely match.

**(b) Native anchor (the O→D "3-body" idea).** A player at his current club is a
*proven* fit by evidence, floored high (93). Every destination degrades from
there.

**(c) Adaptation-risk haircut.** Subtract a capped penalty proportional to how
far the **destination departs from the player's origin** on the style axes — the
environmental-jump risk. This is where a stylistically-plausible but radically
different environment gets marked down.

### 3.1 Computed before/after

Same real team vectors, same representative players, origin = Barcelona:

| Player | Club | CURRENT | v3 | Δ | read |
|---|---|---|---|---|---|
| Gavi | **Barcelona** | 65 | **93** | +28 | native / proven |
| | Real Madrid | 68 | 66 | −2 | continuous |
| | Man City | 64 | 71 | +7 | continuous |
| Yamal | **Barcelona** | 51 | **93** | +42 | native / proven |
| | Real Madrid | 62 | 64 | +2 | continuous |
| | Man City | 44 | 56 | +12 | continuous |
| Pedri | **Barcelona** | 68 | **93** | +25 | native / proven |
| | Real Madrid | 63 | 56 | −7 | continuous |
| | Man City | 65 | 63 | −2 | continuous |

**What v3 fixes:**
1. Native club is now correctly the top fit for all three — the reported bug is gone.
2. The control category-error is gone (Yamal at Barça: 51 → 93; Pedri correctly graded).
3. Man City's absurd current lows lift as continuity with Barça DNA is credited
   (Yamal City 44 → 56; Gavi City 64 → 71).

### 3.2 Honest open question (flagged, not fudged)

For **Yamal**, v3 still puts Real Madrid (64) marginally above Man City (56),
even though City is the more Barça-like *environment*. The reason is real and
defensible: City demands very high pressing (90) from wide forwards, and Yamal's
individual pressing signal (62) is low, so the symmetric pressing axis penalizes
him more at City than at Madrid (79). This surfaces a genuine tuning decision:

> Should a low-press attacker be penalized at a high-press club, or should we
> treat pressing as partly collective ("the structure covers him") the way we
> treat control?

Recommend we decide this *after* Phase 1, on real derived pressing numbers, not
on hand vectors. It's a weight/axis-classification tuning call, not a structural
flaw.

---

## 4. Why DNA first

Fit v3's adaptation-risk term and directional axes are only as trustworthy as the
team vectors they compare against. Tuning v3 on hand-authored vectors would bake
in editorial bias and force a re-tune the moment real DNA lands. Deriving DNA
first means v3 is tuned once, on real numbers, against calibrated anchors.

**Order of work:**
1. `deriveTeamDNA.mjs` + calibration against reference clubs → populate `derived_team_profiles`.
2. Flip resolution order to derived-first.
3. Implement v3 (`rawFit` → directional; add native anchor + adaptation risk in `buildSystemFitReport`/`computeSystemFit`).
4. Re-run the score table on real DNA; resolve the pressing tuning question.
5. Validate against a held-out set of "obvious" fits before shipping.

---

## 5. Decisions needed from you

1. **StatsAPI coverage** — which team-level endpoints/leagues do we actually have?
   This scopes `deriveTeamDNA.mjs`.
2. **Reference anchor clubs** — confirm the 3–4 clubs to calibrate the raw→0-100 curves.
3. **Pressing axis** — collective (hinge, like control) or symmetric style axis?
   Decide on real numbers in step 4.
4. **Native floor** — keep the hard 93 floor, or let a truly declining player at
   his own club score below it (evidence over assumption)?
