# FlipFlap

Flip-clock web app with **Material You Expressive** theming (`@material/material-color-utilities`, Spec 2025).

## Stack

- `index.html` — markup
- `src/styles.scss` — flip geometry + M3 Expressive chrome
- `src/theme.ts` — SchemeExpressive → CSS variables (light / dark / system)
- `src/main.ts` — clock, flips, settings
- `src/saints.ts` — saints du jour (Nominis), séparés par des virgules
- `src/birthdays.ts` — anniversaires (UI + client API)
- `api/birthdays.js` — fonction serverless Vercel, CRUD MongoDB
- Vite → `dist/`

## Local

```bash
npm install
npm run dev
```

## Anniversaires (MongoDB)

Copier `.env.example` en `.env` et renseigner `MONGODB_URI` (le fichier `.env` n'est jamais commité).
En production, définir les mêmes variables dans **Vercel → Settings → Environment Variables**,
et autoriser l'accès réseau depuis Vercel dans MongoDB Atlas (*Network Access*).

| Méthode | URL | Effet |
| --- | --- | --- |
| GET | `/api/birthdays` | liste |
| POST | `/api/birthdays` | création `{ name, day, month, year?, note? }` |
| PUT | `/api/birthdays?id=…` | modification |
| DELETE | `/api/birthdays?id=…` | suppression |

Optionnel : `BIRTHDAYS_WRITE_KEY` protège l'écriture (l'app demande la clé une fois).
En local, `npm run dev` sert aussi `/api/birthdays` via un middleware Vite.

## Settings

Open the FAB menu → Settings:

- Hour format (12h / 24h)
- Digits per flap (1 or 2)
- Show birthdays
- Show date / flaps / copyright
- Theme, color spec, variant, M2 palette
- Motion, scale & brightness
