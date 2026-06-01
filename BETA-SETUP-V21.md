# Calibre V21 beta hardening setup

## Upload
Upload everything in this folder to the root of the GitHub repository. Leave the existing `public` folder in GitHub intact if the browser uploader struggles with it.

## Existing football API
Keep the existing Vercel secret:

```
API_FOOTBALL_KEY
```

## Add verified user accounts and persistent forums
1. Create a Supabase project.
2. Open Supabase **SQL Editor**, paste `supabase/schema.sql`, and run it once.
3. In Supabase **Authentication → URL Configuration**, set the site URL to:

```
https://www.calibrefootball.com
```

4. Add the following public values to **Vercel → calibre project → Settings → Environment Variables** for Production, Preview and Development:

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

These two values are designed for the browser. Do not add the Supabase service-role key to this repository or to any `VITE_` variable.
5. Redeploy after changing Vercel environment variables.

## Content source boundary
API-Football supplies football data: leagues, clubs, players, standings, fixtures and images where available.
Supabase supplies Calibre community content: verified accounts, forums, debate nominations, GOAT votes, hot potatoes and editorial banger-tweet picks.
