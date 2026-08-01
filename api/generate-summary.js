// Vercel serverless function — deploy at: api/generate-summary.js
//
// Generates a short narrative summary (3-5 sentences, Calibre's own analytic
// voice — not hype copy) from a player's ALREADY-COMPUTED valuation output.
// This does not compute anything new and never invents numbers: it is
// strictly a language layer over calibreValue.js / calibreFitValue.js's real
// output, the same "clean seam" discipline those two files already use with
// each other (calibreFitValue.js: "does NOT recompute fit... a PURE
// COMBINER"). If a number isn't in the payload, the model is instructed not
// to state it.
//
// Origin: 2026-07-26 session — competitive read on TransferRoom's Scout
// product (AI-generated report summaries as a stated differentiator) plus
// Zari's go-ahead to build it. We already compute a verdict, fair range,
// breakdown and comparables in the Dossier; this wraps that in prose for the
// $499 Dossier deliverable and the free-tier Deal Report, where a written
// case for the number reads better than a KPI grid alone.
//
// Required Vercel env var (Project → Settings → Environment Variables):
//   ANTHROPIC_API_KEY = your console.anthropic.com key
// Optional:
//   ANTHROPIC_MODEL   = defaults to claude-sonnet-5 below. Dossier is a
//                       one-time $499 purchase — a few cents of API cost
//                       difference between Sonnet and Haiku is noise next to
//                       that price point, so this defaults to quality over
//                       cost. Override to a cheaper model if this gets
//                       reused somewhere higher-volume/free-tier later.
//
// Local testing: run `vercel dev` (matches api/football.js's own note) so
// this is served alongside the app, or POST directly to the deployed
// function URL with curl while testing.

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-sonnet-5';
const MAX_TOKENS = 400;

function round1(n) {
  const x = Number(n);
  return Number.isFinite(x) ? Math.round(x * 10) / 10 : null;
}

// Builds the factual payload the model is allowed to reference. Anything not
// in here should not appear in the output — enforced by instruction, not
// just convention, since this is the one place in the whole engine where a
// non-deterministic step touches the numbers.
function buildFacts(body) {
  const player = body.player || {};
  const valuation = body.valuation || {};
  const fit = body.fit || null;
  const verdict = body.dealVerdict || body.verdict || null;
  const askingPrice = body.askingPrice;
  const comparables = Array.isArray(body.comparables) ? body.comparables.slice(0, 5) : [];

  return {
    player: {
      name: player.full_name || player.name || 'Unknown player',
      age: player.age ?? null,
      position: player.pos || player.position || null,
      club: player.club || null,
      league: player.league || null,
    },
    calibreEstimatedValue: valuation.estimatedValue ?? null,
    fairRange: valuation.fairRange || null,
    maxSensibleBid: valuation.maxSensibleBid ?? null,
    confidence: valuation.confidence ?? null,
    breakdown: Array.isArray(valuation.breakdown)
      ? valuation.breakdown.filter(f => !f.stub).map(f => ({ factor: f.name, note: f.note }))
      : [],
    buyingClub: fit ? {
      fitScore: fit.fitScore ?? null,
      fitAdjustedValue: fit.fitAdjustedValue ?? null,
    } : null,
    askingPrice: askingPrice ?? null,
    verdict: verdict ? { label: verdict.label, why: verdict.why } : null,
    comparables: comparables.map(c => ({ name: c.name, estimate: c.estimate ?? c.fee ?? null })),
  };
}

const SYSTEM_PROMPT = `You write short scouting-report narratives for Calibre, a football (soccer) transfer valuation product. You will be given a JSON object of facts already computed by Calibre's valuation engine. Write 3-5 sentences of plain prose (no headers, no bullet points, no markdown) that reads like an analyst's case notes: state the valuation, the verdict, and the single strongest reason behind it, referencing the buying club's fit only if that data is present.

Hard rules:
- Only state numbers and facts that appear in the JSON. Never estimate, infer, or round a number that wasn't given.
- If a field is null or missing, do not mention it or imply it exists.
- Do not use hype language ("game-changer", "must-sign", "elite talent"). Calibre's voice is measured and evidence-led, closer to a scout's internal memo than marketing copy.
- Do not restate the raw JSON keys; write natural sentences.
- End with the verdict label and, if given, its "why" reasoning in your own words rather than quoting it verbatim.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Use POST' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(501).json({
      error: 'ANTHROPIC_API_KEY not configured',
      note: 'Set it in Vercel → Project → Settings → Environment Variables, then redeploy. This endpoint is scaffolded but inactive until then.',
    });
    return;
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  } catch {
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }

  if (!body.player || !body.valuation) {
    res.status(400).json({ error: 'Missing required fields: player, valuation' });
    return;
  }

  const facts = buildFacts(body);

  try {
    const resp = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: `Facts:\n${JSON.stringify(facts, null, 2)}` },
        ],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      res.status(502).json({ error: 'Anthropic API request failed', status: resp.status, detail: errText.slice(0, 500) });
      return;
    }

    const data = await resp.json();
    const summary = (data?.content || [])
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n')
      .trim();

    if (!summary) {
      res.status(502).json({ error: 'Empty response from model' });
      return;
    }

    res.status(200).json({ summary, model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL });
  } catch (e) {
    res.status(500).json({ error: 'Request failed', detail: String(e?.message || e) });
  }
}
