# Calibre V7 Payable Pro Build

**Domain:** calibrefootball.com  
**Paid product:** Calibre World Cup Founder Pass  
**Price:** $8.99 one-time  
**Access:** 90 days of Pro  
**CTA:** Get World Cup Founder Pass

This is a real Next.js app package, not a static HTML shell.

## What works in this build

- Home page with live-feeling Calibre intelligence cards
- Players comparison page with working search/select/compare
- System Fit Engine with active pulse and fit radar
- Competitions page with World Cup intelligence boards
- Debates page with Hot Potato of the Week
- Talents page with global U23/women's talent filters
- GOAT page framed around Messi/Ronaldo debate logic
- Pricing page with Founder Pass CTA
- API route for Lemon Squeezy checkout
- API route for Lemon Squeezy webhook
- Supabase entitlement schema for Founder Pass Pro unlock

## Install

```bash
npm install
npm run dev
```

Then open:

```bash
http://localhost:3000
```

## Deploy to Vercel

1. Upload this folder to GitHub.
2. Import the GitHub repo into Vercel.
3. Add environment variables from `.env.example`.
4. Connect `calibrefootball.com` in Vercel project settings.
5. Point your domain DNS to Vercel.

## Supabase setup

Run this SQL in Supabase SQL editor:

```sql
create table if not exists profiles (
  id uuid primary key,
  email text,
  plan text default 'free',
  created_at timestamptz default now()
);

create table if not exists user_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  email text,
  product text not null,
  status text not null default 'active',
  source text not null default 'lemonsqueezy',
  lemon_order_id text unique,
  starts_at timestamptz default now(),
  ends_at timestamptz not null,
  created_at timestamptz default now()
);

create table if not exists usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  event_type text not null,
  created_at timestamptz default now()
);
```

For the test run, the webhook can unlock by email if the user has not created an account yet.

## Lemon Squeezy product

Create:

- Product: `Calibre World Cup Founder Pass`
- Price: `$8.99 one-time`
- Redirect after purchase: `https://calibrefootball.com/account?upgraded=true`
- Webhook URL: `https://calibrefootball.com/api/webhooks/lemonsqueezy`
- Event: `order_created`

## Important

The app contains starter datasets so the product feels alive immediately. Replace or extend the data layer with your chosen football API when ready.
