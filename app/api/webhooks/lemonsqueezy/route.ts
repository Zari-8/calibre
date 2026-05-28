import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { founderEndsAt } from '@/lib/entitlements';

function verifySignature(rawBody: string, signature: string | null) {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) return true; // allow local testing, require secret in production
  if (!signature) return false;
  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-signature');

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);
  const eventName = payload?.meta?.event_name;

  if (eventName !== 'order_created') {
    return NextResponse.json({ ok: true, ignored: eventName });
  }

  const orderId = String(payload?.data?.id || '');
  const email = payload?.data?.attributes?.user_email || payload?.data?.attributes?.customer_email || null;
  const custom = payload?.meta?.custom_data || {};
  const product = custom?.product || 'founder_pass';

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('user_entitlements').upsert({
      email,
      product,
      status: 'active',
      source: 'lemonsqueezy',
      lemon_order_id: orderId,
      starts_at: new Date().toISOString(),
      ends_at: founderEndsAt(90)
    }, { onConflict: 'lemon_order_id' });

    if (error) throw error;
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Supabase insert failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
