# Discovery Dossier — Product Spec

*The development-tuned sibling of the Deal Dossier. Lives on the Talents page.
Same engine, same $499, a different question.*

---

## 0. Why this exists

The Deal Dossier (Transfers page) answers **"is this specific move good value?"**
for an established player. But the asymmetry there is thin — every serious club
already has Haaland modelled. You're a second opinion.

The Discovery Dossier answers **"should we bet on this player nobody's watching?"**
for an under-the-radar talent. The asymmetry is maximal: most clubs have no
scouts in the NPFL, the Zimbabwe PSL, peripheral Asian leagues — no data, no
read, nothing. Here a Calibre dossier isn't a second opinion, it's the *only*
opinion. That's where $499 is genuinely cheap — against flying scouts out, or
the cost of missing a player who goes for 20× in three years.

This is also where Calibre's moat and its premium product become the same thing.
Calibre's edge was never "we can tell you about Gordon." It's the Africa-first
discovery angle, the leagues nobody else models. The dossier monetises *that
specific edge* — but only when it sits on a talent.

**The reframing of the Talents page:** it stops being a gallery ("here are the
talents and where they're projected") and becomes a decision surface ("here are
the talents — and here's the mechanism to decide whether to bet on one to enrich
your club"). The projection is no longer the destination; it's the hook that
makes someone think *"wait — should we actually move on this one?"* The dossier
is the answer to that question.

---

## 1. The buyer fork — club vs agent

A single toggle on the commission form. It changes the **question the dossier
answers** and the **voice** of the judgment sections — same engine spine
underneath.

| | **Club** | **Agent** |
|---|---|---|
| Question | "Should we sign him, and what's the bet?" | "Why should a club sign my player?" |
| Job of the dossier | De-risk an acquisition | A third-party validation / sales asset |
| Voice | Due-diligence, sober, risk-forward | Positioning, persuasive, upside-forward |
| Verdict frames | Sign / Monitor / Pass + conviction | Tier-of-club fit + the pitch |
| Emphasis | Fit, risk-of-stalling, opportunity cost | Comparable trajectories, value narrative, ceiling |

The toggle is trivial to build. The real work is the two framings of the output
— which the human layer produces (§4).

---

## 2. The blended framework

The Deal Dossier's Director-of-Football spine (fit, value, deal structure,
opportunity cost) **fused** with a development layer (ceiling, trajectory,
pathway, risk-of-stalling). A Discovery Dossier answers both *"is he good and
worth it"* and *"will he become what we're betting on."* That blend is what
justifies $499 on a 19-year-old nobody's heard of.

### Section structure (the deliverable)

1. **Executive verdict** — *(human)* the one-line bet. Club: Sign/Monitor/Pass +
   conviction. Agent: tier-of-club fit + the pitch. Two sentences a sporting
   director reads first.
2. **Identity & context** — *(engine + human)* who he is, league, current level,
   and the asymmetry: *why nobody's watching him yet*. This frames the whole
   value proposition.
3. **Calibre signal** — *(engine)* rating, trait profile, archetype, system-fit
   numbers, current output per-90s. The computed quantitative core.
4. **Development projection — the bet** — *(engine + human)* age-curve
   trajectory, projected ceiling **band** (not a point), headroom over current
   rating, estimated time-to-peak. *This is the development layer.*
5. **Pathway modelling** — *(engine + human)* realistic next steps — which
   tier/league he fits now and in 2–3 years, with comparable trajectories
   (players who walked similar paths). Club: where he slots in your structure.
   Agent: which clubs to target, in order.
6. **Comparable talents** — *(engine)* like players at similar age/profile,
   valued, **with their outcomes** — who hit, who stalled. The honest base rate.
7. **Value & opportunity cost** — *(engine + human)* current Calibre value,
   projected value trajectory, and the cost of *not* acting (he leaves for 20× in
   three years). The financial bet, stated plainly.
8. **Risk profile** — *(engine + human)* what could derail the projection: the
   league step-up, end-product against better defences, role dependence, minutes,
   temperament, injury history. The honest downside.
9. **The judgment** — *(human)* the qualitative read the engine cannot produce:
   the *so-what*, the caveats between the numbers, the recommendation in the
   buyer's voice. **This is the 30% they're actually paying for.**
10. **Deliverable** — watermarked, token-gated PDF; commission turnaround stated.

Sections **1, 4, 5, 7, 8, 9** carry the club/agent fork. Sections **3, 6** are
identical regardless of buyer (pure signal).

---

## 3. Engine vs human — what's computed, what's written

| Layer | Sections | Source |
|---|---|---|
| **Computed (≈70%)** | 3 (signal), 4 (trajectory math), 6 (comparables), value model in 7 | calibreRating, playerTraits, deriveArchetype, age curves, comparables query, calibreValue — *all already built* |
| **Human (≈30%)** | 1 (verdict), 5 (pathway read), 8 (risk read), 9 (judgment), club/agent framing | You, with Calibre as drafting partner |

The engine auto-assembles the quantitative spine into a **draft** the moment a
commission lands. You + Calibre write the judgment on top. It ships as a
watermarked PDF. The engine does the structure and the signal; the human does the
judgment — which is precisely the part that can't be scraped or commoditised, and
precisely why $499 holds.

**Honest constraint:** this does not scale like software — every dossier costs
your hours. That's fine, even correct, at $499 and deliberately low volume (a
scarce premium product, not a subscription). But name it now: more dossiers sold
= more of your time consumed, until the human layer is templatised harder or an
analyst is brought in. The automation path is to keep encoding the judgment we
write *repeatedly* back into the engine, so the draft creeps from 70% toward
final over time. Human-assisted is the launch posture, not a permanent ceiling.

---

## 4. The commission workflow

1. Buyer is on a talent's profile → commissions a Discovery Dossier → toggles
   **Club** or **Agent** → submits brief (same form, plus the toggle).
2. Row lands in `dossier_commissions` (add a `dossier_type` = 'discovery' and a
   `buyer_kind` = 'club' | 'agent'); the existing notification trigger emails you.
3. Engine auto-assembles the spine (sections 3, 4, 6, value model) into a draft.
4. You + Calibre write sections 1, 5, 8, 9 in the club/agent voice.
5. Ships as a token-gated, watermarked PDF (the delivery mechanism is the same
   one the Deal Dossier needs — build once, both use it).

---

## 5. Exemplar outline (illustrative)

*A representative case to show the shape — a composite, not a real commission.*

**Subject:** 19-year-old NPFL forward · Calibre 78 · rising trajectory ·
**Buyer: Championship club (de-risk)**

- **Executive verdict** — "Monitor with intent. The signal is real and the price
  is negligible, but the ceiling is a solid second-tier starter, not the Premier
  League gamble the trajectory alone implies. Move if the fee stays under €X."
- **Identity & context** — why he's invisible: no English-speaking scouts in the
  league, output flattered by a weak division, no data vendor covers it. *Calibre
  does.*
- **Calibre signal** — 78 rating, Poacher archetype, elite box-presence per-90,
  thin creation/link metrics.
- **Development projection** — ceiling band 81–85, ~3 seasons to peak, headroom
  concentrated in finishing volume not all-round game.
- **Pathway** — realistic next step is a mid-Championship / strong second-tier
  European side, not a direct top-five move; comparable trajectory: [player who
  took the same step].
- **Comparables** — three like-profiled forwards at 19; two settled at
  Championship level, one kicked on. Honest base rate.
- **Value & opportunity cost** — current value €X; if the finishing translates,
  €20X in three years. Cost of passing stated.
- **Risk** — end-product against organised defences untested; pressing numbers
  league-inflated; single-role dependence.
- **Judgment** — the sober read: a high-EV, low-cost bet *if* deployed as a
  finisher behind a creator, not asked to lead the line alone. Sign-with-eyes-open,
  not sign-and-pray.

Swap the buyer to **Agent** and §1/5/7/9 re-voice toward "here is a €X player with
an 81–85 ceiling and a clear Championship-to-Europe pathway — the clubs to call,
in order."

---

## 6. Build order (when we proceed)

1. **Talents-page reframing** — recast the page from gallery to decision surface;
   add the quiet "Commission a Discovery Dossier" entry on each talent (same
   restrained styling we just applied to Transfers — not loud).
2. **Buyer toggle** on the commission form (club/agent) + `dossier_type` /
   `buyer_kind` columns on `dossier_commissions`.
3. **Draft auto-assembly** — engine writes sections 3, 4, 6 + value model into a
   structured draft from the talent's existing computed data.
4. **Shared delivery mechanism** — token-gated, watermarked PDF (built once,
   shared with the Deal Dossier; ContiPay-blocked for payment).

Transfers stays world-class and unchanged except for relabelling its dossier as
the secondary **Deal Dossier** and the button toning we just did.

---

## 7. Open questions resolved (this session)

- Primary buyer: **both** — club and agent, chosen via toggle. ✓
- Hero placement: **Talents** carries it; Transfers demoted to quiet upsell. ✓
- Price: **same $499** in both contexts. ✓
- Framework: **blend** — DoF spine + development layer. ✓
- Human-assisted: **yes** — engine drafts the spine (~70%), human writes the
  judgment (~30%); ships as a commission with turnaround. ✓
