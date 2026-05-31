# Calibre V12 — aggregate Rate Battle + expanded competitions

- Added an overall Rate Battle score calculated from Control, Impact and Creativity.
- Locked each criterion after one submitted vote in the browser.
- Added `/api/rate-battle-vote` for account-or-IP deduplication. It uses Upstash Redis when configured and a server-memory demo fallback otherwise.
- Added Primeira Liga and Brasileirão Série A to Top Leagues.
- Added Europa Conference League, Copa Libertadores and CAF Champions League to Top Tournaments.
- Removed AFCON from always-on tournament coverage. Seasonal national-team tournaments can be added only in relevant years.
- Added Coupe de France, KNVB Cup, Belgian Cup, Taça de Portugal and Copa do Brasil to Domestic Cups.

Optional production vote persistence environment variables:

```
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```
