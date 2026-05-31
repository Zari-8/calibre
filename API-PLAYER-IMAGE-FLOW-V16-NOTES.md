# Calibre V16 — API Player Image Flow

## What changed
- Added `ApiPlayerImage` for API-first player portraits with local fallbacks.
- Added `getPlayerPhotoByName()` in the API-Football service.
- Cached portrait URLs in browser storage for seven days.
- Collapsed duplicate in-flight player-photo lookups to reduce API usage.
- Wired API portraits into the homepage hero, homepage live battles, global ranking list, Debate page battle cards, today's featured battle, GOAT debate and trending rail.
- Preserved local placeholders for fictional prototype talents.

## Production behaviour
- Local images render immediately.
- The browser requests player metadata through `/api/football?endpoint=players&search=...&season=...`.
- When API-Football returns a player photo URL, the portrait upgrades in place.
- Failed or unavailable remote photos fall back safely to the local asset.

## Deployment
Upload the source folders and configuration files to GitHub. Do not upload `node_modules` or `dist`.
