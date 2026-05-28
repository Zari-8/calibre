import { NextResponse } from 'next/server';

export async function POST() {
  const direct = process.env.NEXT_PUBLIC_FOUNDER_PASS_CHECKOUT_URL;
  if (direct) return NextResponse.json({ url: direct });

  const apiKey = process.env.LEMONSQUEEZY_API_KEY;
  const storeId = process.env.LEMONSQUEEZY_STORE_ID;
  const variantId = process.env.LEMONSQUEEZY_FOUNDER_PASS_VARIANT_ID;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  if (!apiKey || !storeId || !variantId) {
    return NextResponse.json(
      { error: 'Founder Pass checkout needs Lemon Squeezy env vars or NEXT_PUBLIC_FOUNDER_PASS_CHECKOUT_URL.' },
      { status: 400 }
    );
  }

  const body = {
    data: {
      type: 'checkouts',
      attributes: {
        checkout_options: {
          embed: false,
          media: false,
          logo: true
        },
        checkout_data: {
          custom: {
            product: 'founder_pass'
          }
        },
        product_options: {
          redirect_url: `${siteUrl}/account?upgraded=true`,
          receipt_button_text: 'Open Calibre',
          receipt_link_url: `${siteUrl}/account?upgraded=true`,
          receipt_thank_you_note: 'Welcome to the World Cup Founder Pass.'
        }
      },
      relationships: {
        store: { data: { type: 'stores', id: storeId } },
        variant: { data: { type: 'variants', id: variantId } }
      }
    }
  };

  const res = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  if (!res.ok) return NextResponse.json({ error: 'Lemon Squeezy checkout failed', details: data }, { status: 500 });

  return NextResponse.json({ url: data.data.attributes.url });
}
