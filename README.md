# Calibre React Composite

This is the live-web-app version of Calibre, not a dead HTML site.

## What is included

- Vite + React app
- Real routes:
  - `/`
  - `/debates`
  - `/players`
  - `/competitions`
  - `/talents`
  - `/system-fit`
- Shared visual system based on the approved mockups
- Reusable components
- Local mock data that can be replaced with API calls later
- Calibre rating engine:
  - Performance 35%
  - Consistency 20%
  - Form 20%
  - Impact 15%
  - Trajectory 10%
- League difficulty multiplier
- Debate Index
- Flexible Next Step Projection, not hardcoded Championship minutes

## Upload structure

Upload the contents of this folder to GitHub:

```txt
calibre/
  package.json
  index.html
  src/
    main.jsx
    App.jsx
    components/
    pages/
    data/
    styles/
```

## Run locally

```bash
npm install
npm run dev
```

## Deploy on Vercel

Framework preset: `Vite`

Build command:

```bash
npm run build
```

Output directory:

```bash
dist
```

## Data/API note

For now, the site uses:

```txt
src/data/mockData.js
```

Later we replace that file with real API calls while keeping the UI and pages intact.
