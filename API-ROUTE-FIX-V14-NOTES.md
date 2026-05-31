# Calibre V14 API route fix

## What was wrong
The previous catch-all Vercel rewrite matched every URL, including `/api/football`. That meant API bridge checks could be sent back into the single-page React application instead of the serverless function.

## Fix
`vercel.json` now applies the SPA fallback only to paths that do not begin with `/api/`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [
    { "source": "/:path((?!api/).*)", "destination": "/index.html" }
  ]
}
```

## Expected test response
After deployment and after adding `API_FOOTBALL_KEY` in Vercel, opening:

`/api/football?endpoint=status`

should return JSON from API-Football. If the key has not been applied to the latest deployment, the endpoint should return a JSON configuration error instead of a blank SPA page.
