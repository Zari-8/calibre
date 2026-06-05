import crypto from 'node:crypto';

export const config = {
  api: {
    bodyParser: false,
  },
};

async function readRawBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return Buffer.from(req.body);

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function signaturesMatch(rawBody, receivedSignature, secret) {
  if (!receivedSignature || !secret) return false;

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  const expected = Buffer.from(expectedSignature, 'utf8');
  const received = Buffer.from(String(receivedSignature), 'utf8');

  return expected.length === received.length &&
    crypto.timingSafeEqual(expected, received);
}

async function upsertEntitlement(row) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase server environment variables.');
  }

  const response = await fetch(
    `${supabaseUrl}/rest/v1/billing_entitlements?on_conflict=user_id`,
    {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(row),
    }
  );

  if (!response.ok) {
    throw new Error(`Supabase update failed: ${response.status} ${await response.text()}`);
  }
}

function addTwoMonths(date = new Date()) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + 2);
  return result.toISOString();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const rawBody = await readRawBody(req);
    const signature = req.headers['x-signature'];
    const secret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;

    if (!signaturesMatch(rawBody, signature, secret)) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    const payload = JSON.parse(rawBody.toString('utf8'));
    const eventName = String(payload?.meta?.event_name || '');
    const attributes = payload?.data?.attributes || {};
    const customData = payload?.meta?.custom_data || {};
    const userId = String(customData.user_id || '').trim();
    const variantId = String(attributes.variant_id || '');
    const founderVariantId = String(process.env.LEMON_FOUNDER_VARIANT_ID || '');
    const proVariantId = String(process.env.LEMON_PRO_VARIANT_ID || '');

    if (!userId) {
      return res.status(200).json({ received: true, ignored: 'Missing user_id' });
    }

    if (eventName === 'order_created' && variantId === founderVariantId) {
      await upsertEntitlement({
        user_id: userId,
        plan: 'founder_pass',
        access_status: 'active',
        access_until: addTwoMonths(),
        lemon_order_id: String(payload.data.id || ''),
        lemon_variant_id: variantId,
        updated_at: new Date().toISOString(),
      });
    }

    if (
      ['subscription_created', 'subscription_updated', 'subscription_resumed'].includes(eventName) &&
      variantId === proVariantId
    ) {
      await upsertEntitlement({
        user_id: userId,
        plan: 'pro',
        access_status: 'active',
        access_until: attributes.renews_at || attributes.ends_at || null,
        lemon_subscription_id: String(payload.data.id || ''),
        lemon_variant_id: variantId,
        updated_at: new Date().toISOString(),
      });
    }

    if (
      ['subscription_expired', 'subscription_cancelled'].includes(eventName) &&
      variantId === proVariantId
    ) {
      await upsertEntitlement({
        user_id: userId,
        plan: 'pro',
        access_status: eventName === 'subscription_expired' ? 'inactive' : 'cancelled',
        access_until: attributes.ends_at || null,
        lemon_subscription_id: String(payload.data.id || ''),
        lemon_variant_id: variantId,
        updated_at: new Date().toISOString(),
      });
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    return res.status(500).json({
      error: 'Webhook processing failed',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
