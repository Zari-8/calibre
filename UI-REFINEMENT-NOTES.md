# Calibre UI refinement notes

## Architecture retained
The package remains a Vite + React single-page application with routed page components, shared shell/ticker components, reusable UI primitives, hooks, data modules, and service modules. No functional page architecture was removed.

## Visual system applied
- The supplied Calibre logo artwork is used directly in the navigation.
- The palette is now derived from the logo: optical black, silver-white, acid green, and a deeper calibrated green for gradients.
- Display moments use `Michroma`, UI labels use `Rajdhani`, and body text uses `Inter`. The exact source font in the flattened logo PNG cannot be verified, so `Michroma` is used as the closest deployable web-font match for its wide geometric technical character.
- The prior rounded, glow-heavy card treatment has been replaced with restrained instrument-panel surfaces, sharper corners, thinner green calibration lines, and reduced atmospheric glow.
- The language selector was removed from the shell in line with the prior product decision.

## Deployment
Run `npm install`, then `npm run build`.
