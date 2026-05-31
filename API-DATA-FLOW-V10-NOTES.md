# Calibre V10 — API Data Flow

## What is live now

The website now routes API-Football calls through `/api/football`, a Vercel serverless bridge. The API key remains server-side in `API_FOOTBALL_KEY`.

Live data is wired into:
- scrolling match ticker (`fixtures`)
- competition standings (`standings`)
- top scorers (`players/topscorers`)
- System Fit team search (`teams`)
- System Fit player search (`players`)

A compact Calibre Data Bridge bar appears below the ticker so the live connection, most recent endpoint, returned record count and remaining quota can be inspected visually.

## Vercel environment variable

Add this in Vercel → Settings → Environment Variables:

```
API_FOOTBALL_KEY=your_real_key
```

Select Production, Preview and Development, save, then redeploy.

Do not use `VITE_API_FOOTBALL_KEY` in Vercel. Variables beginning with `VITE_` are bundled into the browser and are visible to visitors.

## Local development

For local-only testing, copy `.env.example` to `.env.local` and put the key in:

```
VITE_API_FOOTBALL_KEY=your_real_key
```

The local shortcut is only intended for `npm run dev` on your machine.
