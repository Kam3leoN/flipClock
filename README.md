# FlipClock

Flip-clock web app with **Material You Expressive** theming (`@material/material-color-utilities`, Spec 2025).

## Stack

- `index.html` — markup
- `src/styles.scss` — flip geometry + M3 Expressive chrome
- `src/theme.ts` — SchemeExpressive → CSS variables (light / dark / system)
- `src/main.ts` — clock, flips, settings
- Vite → `dist/`

## Local

```bash
npm install
npm run dev
```

## Settings

Move the mouse to show the bottom bar:

- Hour format (12h / 24h)
- Show flaps
- Theme (system → dark → light)
- Scale & brightness

## Note

Visual flip engine adapted from Fliqlo® (© 9031). Material color system © Google (Apache-2.0).
