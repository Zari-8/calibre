# Calibre Football Intelligence - V7 functional UI build

## Run locally

```bash
npm install
npm run dev
```

## Environment variables

Copy `.env.example` to `.env` and add your API-Football key:

```bash
VITE_API_FOOTBALL_KEY=your_key_here
VITE_DEMO_PLAN=pro
```

`VITE_DEMO_PLAN` accepts `free`, `pro`, `scout`, or `club`. PDF and CSV report exports are enabled for Pro and above.

## What is functional in this build

### System Fit Engine
- Search teams and players through the local launch index immediately.
- Search API-Football after three typed characters when the API key is configured.
- Generate a new fit score, tactical breakdown, role-fit pulse, DNA comparison, best-fit ranking and detailed report from the selected player and team.
- Switch between System Fit, Compare Player and Detailed Analysis tabs.
- Export system-fit and compare-player reports as PDF or CSV for Pro and above.

### Competitions
- Top Leagues includes Premier League, La Liga, Bundesliga, Serie A, Ligue 1, Eredivisie and Belgian Pro League.
- Top Tournaments, Domestic Cups and Women's Football tabs now load their own working category hubs.
- League standings and scorer tables refresh from API-Football where a league table is available.
- Snapshot fallbacks remain visible when the API key is absent, the request quota is exhausted, or the selected tournament does not expose a normal standings table.

## Main implementation files

- `src/pages/SystemFit.jsx`
- `src/data/systemFitData.js`
- `src/services/reportExport.js`
- `src/pages/Competitions.jsx`
- `src/data/competitionData.js`
- `src/services/apiFootball.js`
