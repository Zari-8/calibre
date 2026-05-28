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

## API-first image system

This patch makes API images the first choice. Player cards read `photoUrl` and `teamLogoUrl` from the data layer. These can come from API-Football/Sportmonks and later be cached in Supabase. Local images are no longer the first choice; they are only emergency fallbacks.

Optional endpoint included:

```bash
/api/player-image?id=pedri
```

If `API_FOOTBALL_KEY` is present in Vercel, the route can query API-Football and cache the result for 7 days. If no key is present, it returns the stored API media URL from `lib/data.ts`.

Recommended priority:

1. API image URL from football data provider
2. Cached/stored API image URL in Supabase
3. Neutral Calibre fallback avatar
4. Never use ugly/outdated local images as first choice

## Important

The app contains starter datasets so the product feels alive immediately. Replace or extend the data layer with your chosen football API when ready.


## Logo and live score patch

This patch uses the uploaded Calibre logo image at `/public/brand/calibre-logo.png` instead of recreating the logo in CSS.

Live scores remain in demo/no-live mode until `API_FOOTBALL_KEY` is added in Vercel Project Settings → Environment Variables and the app is redeployed. The ticker route is `/api/live-scores` and caches live fixture results for 60 seconds.
