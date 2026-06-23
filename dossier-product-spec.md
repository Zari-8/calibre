# Calibre Dossier Product — Build Spec

Consolidated from the dossier strategy sessions. This is a build-from-later reference, not code.

---

## 1. Product Definition

A per-deal football intelligence report, one-time purchase, **€499**, targeting top-flight clubs, agents, and intermediaries evaluating a specific transfer.

**Positioning shift (the core decision):** the dossier is built top-down, not bottom-up. Each page exists to answer a specific question from a **40-point Director of Football transfer evaluation framework** — not to present whatever data Calibre happens to have dressed in football vocabulary. Every page:
- Names the DoF framework question(s) it answers
- Opens with that question restated in plain language
- Answers directly, with named teammates, named comparables, specific percentiles and financial figures
- Closes with an operational instruction line (e.g. "switch target," "demand appearance bonuses," "walk above €78M")

**Reference exemplar:** `dossier-voice-full.md` — a complete 15-page mock built on an Anthony Gordon → FC Barcelona scenario. Use this as the voice/structure template when building the real generator.

**Pricing context (full Calibre tier structure):**
| Tier | Price | Buyer |
|---|---|---|
| Scout | €19/month | individual scouts/agents |
| Club | €100/month | agents, lower-tier clubs |
| Dossier | €499 one-time | top-flight clubs, agents on a specific deal |

**Open product decision (unresolved):** Page 8 — Character & Culture — answers DoF questions on coachability, dressing room fit, personality under pressure, lifestyle, fan/media reaction. None of this is sourceable from Supabase. Needs a decision on sourcing method (manual editorial research? licensed data? declared as qualitative/non-Calibre-verified?) before this page can be productized.

---

## 2. Commissioning Flow

**Entry point:** "Commission Dossier" button on pricing page → routes to `/dossier/commission`. No auth required. Single page with a qualifying form.

**Form fields (6):**
1. Player name + current club
2. Buying party — club / agency / intermediary / other (+ optional free text)
3. Requester's role + organisation
4. Deadline — 48h standard / next week / flexible
5. Focus areas — multi-select: tactical, commercial, financial, risk, all
6. Free-text brief box + contact email + phone

Friction is intentional, not a gate — no identity verification. Phone field alone filters most low-intent traffic.

**Payment:** on submission, not on delivery (commitment device). Full refund within 24h if dossier can't be produced (player not in DB, insufficient data, ethical concerns). SLA: 48 hours from payment confirmation.

**Editorial workflow (manual, your side):**
1. Form submission → Slack/email notification with brief
2. Hit "Generate" in Calibre admin → produces draft with automated sections filled + Calibre Readings as templated placeholders
3. 30–45 min manual edit pass on readings + brief-specific angle
4. Click "Send" → dossier locks to view-only, secure link sent to buyer, PDF generated simultaneously

---

## 3. Payment Integration — ContiPay

**Confirmed:** ContiPay (Zimbabwe-based) replaces all earlier Stripe references across the entire build. Integration pattern from their docs: **redirect-based flow**, token/secret auth, merchant code, webhook callback for payment confirmation. Their reference client is PHP-based — adapt the pattern to the Node/Vite stack.

**Still pending:** full review of ContiPay's API documentation before building the actual integration code (webhook handler, redirect endpoints, signature verification).

---

## 4. Dual Delivery Format

**Web link (primary):** `calibrefootball.com/dossier/{uuid}?token={hash}`
- View-only, no downloads except via PDF button
- Interactive radar (hover axis → trait value + team demand at that dimension)
- Interactive adaptation forecast chart (hover → underlying cohort)
- Sortable comparables table
- Click-through squad context — tap a named player → side panel slides in with their Calibre profile

**PDF:** same content, static, generated alongside the web link at commission time. Extends existing `DealReport.jsx` jsPDF code (currently 6 pages → needs expansion to 15 + section variety).

**Security / leak deterrence:**
- Token-based access, no login
- Single-use-extended token: first view registers device fingerprint, new-device subsequent views flag for review
- Token expires 90 days post-delivery (extendable on request)
- Watermark on every page (both formats): subscriber name + email + timestamp + "Confidential — prepared for [Buyer]"
- Web view disables right-click, adds JS watermark overlay (screenshot-resistant, not screenshot-proof)

---

## 5. SQL Schema

### `dossier_commissions` — captures every form submission

```sql
CREATE TABLE dossier_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Subject
  player_name text NOT NULL,
  player_db_id uuid REFERENCES players(id), -- nullable, resolved at admin step
  player_current_club text,
  target_club text, -- buying party's club
  -- Buyer
  requester_name text NOT NULL,
  requester_role text NOT NULL,
  requester_org text,
  requester_org_type text CHECK (requester_org_type IN ('club','agency','intermediary','media','other')),
  requester_email text NOT NULL,
  requester_phone text NOT NULL,
  -- Brief
  deadline text CHECK (deadline IN ('48h','1week','flexible')) DEFAULT '48h',
  focus_areas text[] DEFAULT ARRAY['all'],
  brief_text text,
  -- Payment
  payment_status text CHECK (payment_status IN ('pending','paid','refunded','failed')) DEFAULT 'pending',
  payment_provider text DEFAULT 'contipay',
  payment_reference text, -- ContiPay transaction ID
  payment_amount numeric(10,2) DEFAULT 499.00,
  payment_currency text DEFAULT 'USD',
  payment_method text, -- 'visa','ecocash','innbucks' etc
  payment_completed_at timestamptz,
  -- Workflow
  status text CHECK (status IN ('received','in_review','generating','in_editorial','delivered','cancelled')) DEFAULT 'received',
  created_at timestamptz DEFAULT now()
);
```

### `dossiers` (needed, not yet drafted in prior sessions)
Required for the web-link delivery layer — token validation route, view tracking, device fingerprint log. **Not yet specced — build this next alongside the commissions table.**

---

## 6. Build Order & Estimate

Don't build the full machine speculatively. Validate demand first.

| Phase | Scope | Est. time |
|---|---|---|
| 1 | Commissioning form + ContiPay integration + admin notification | ~0.5–1 day |
| — | Ship phase 1, manually produce v0 dossiers via existing engine + heavy editorial pass, validate with 3–5 paying buyers | — |
| 2 | Dossier generator + web link infrastructure (`dossiers` table, token-validation route, read-only renderer, interactive components) | ~3–4 days |
| 3 | PDF generation expansion (6 → 15 pages, section variety) | ~1–2 days |
| 4 | Watermarking + view tracking | ~0.5 day |
| — | Editorial exemplars (8 first-pass Calibre Readings, Gordon→Barça mock as template) | ~4–6 hours, your time |

**Total to v1:** roughly a week of focused build time + 4–6 hours editorial.

---

## 7. Open Items Before Building

1. **Page 8 sourcing decision** — how Calibre handles Character & Culture data not in Supabase.
2. **ContiPay API docs** — full review needed before writing webhook/redirect code.
3. **`dossiers` table schema** — not yet drafted, needed for web-link delivery.
4. **Dossier's primary buyer** — still somewhat undefined (clubs vs. agents vs. intermediaries) per earlier session notes; may affect brief-form copy and SLA framing.
