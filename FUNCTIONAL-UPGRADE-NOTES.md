# Calibre V7 functional upgrade notes

## Completed

- Reworked Jude Bellingham System Fit presentation into a clean report workspace.
- Removed the body-silhouette graphic from Role Fit Pulse and replaced it with a football-role waveform treatment.
- Added local-first and API-backed team/player search.
- Added generated datasets for System Fit, Compare Player and Detailed Analysis.
- Added PDF and CSV export architecture for Pro, Scout and Club tiers.
- Added Eredivisie and Belgian Pro League to Top Leagues.
- Activated Top Tournaments, Domestic Cups and Women's Football category tabs.
- Changed the football season constant from a stale hard-coded year to an automatic seasonal calculation.

## Data behavior

The launch UI remains usable without an API key through local snapshots. When `VITE_API_FOOTBALL_KEY` is present, supported league tables and scorer lists refresh through API-Football. Cup, tournament and women's competition feeds retain category snapshots until dedicated feed mapping is added.
