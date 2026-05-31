# Calibre V17 — automatic translation

The navigation language dropdown now drives automatic whole-page machine translation.

## Behaviour

- The selected language is stored in `localStorage` under `calibre_lang`.
- A `googtrans` cookie restores the translated language after refresh.
- Changing the language reloads the active page once so that all rendered React copy is translated consistently.
- When a non-English language is active, internal navigation performs a full route load so translation remains active on the next page.
- Arabic switches the document into right-to-left mode.
- The Calibre dropdown remains visually native; the external translation control is hidden.

## Expected exceptions

Player names, team names, numerical data and API-provided identifiers may intentionally remain untranslated.
