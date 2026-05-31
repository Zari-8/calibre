# Calibre public website rebuild

The underlying React/Vite routes, data layer, API service modules and live ticker integration remain intact.

## Rebuilt visual layer
- Replaced the dashboard-like home page with a public-facing sports intelligence homepage.
- Added a proper editorial hero with clear positioning, calls to action and searchable database entry point.
- Rebuilt the Pedri vs Jude hero as a premium interactive feature rather than an oversized arcade panel.
- Simplified the information hierarchy: active debates, intelligence products, rankings, hot-potato debate and scouting radar.
- Rebuilt navigation, mobile menu and footer.
- Derived a transparent navbar wordmark from the supplied master logo without redrawing the icon.
- Standardised the brand system around optical black, silver-white and acid lime.
- Used Barlow Condensed for sports-editorial display text, Barlow for interface copy and IBM Plex Mono for data readouts.

## Preserved architecture
- Existing route map and internal pages
- Live ticker API integration and fallback data
- Existing API service files and hooks
- Environment-variable setup
- Vercel configuration

## Validation
Run:

```bash
npm install
npm run build
npm run dev
```
