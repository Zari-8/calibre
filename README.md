# Calibre Football Intelligence

Live Vite + React app for Calibre. This is not a static HTML bundle.

## Run locally

```bash
npm install
npm run dev
```

## Vercel settings

- Framework Preset: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

`vercel.json` is included so direct route refreshes work for:

- `/`
- `/debates`
- `/players`
- `/competitions`
- `/talents`
- `/system-fit`

## Assets

Put real player images in `public/assets/players/` using these names where available:

- `pedri.jpg`
- `jude-bellingham.svg`
- `lamine-yamal.jpg`
- `florian-wirtz.jpg`
- `kylian-mbappe.jpg`
- `vinicius-junior.svg`

The app uses the hybrid image order: API image first, local asset fallback second, neutral fallback last.

Use the latest uploaded screenshots/mockups as the visual source of truth. Do not drift from them.
