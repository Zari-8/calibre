# Calibre V15 API route and static asset fix

The SPA fallback now excludes both `/api/` and `/assets/`.

This keeps Vercel serverless API routes reachable while allowing Vite's generated JavaScript, CSS, logos and player image assets to load normally.
