# APROs — Apprenticeship Program Operations

Mobile-first PWA + desktop dashboard for running apprenticeship cohorts: daily attendance, coaching signals, and cohort health.

## Quick start

```bash
npm install
npm start            # http://localhost:4200 — pick a demo persona on the login screen
npm run verify       # lint + unit tests + production build
```

Demo personas: **Head of Coaches (Admin)** and **Coach**. Everything is stored in your browser; use
_Profile menu → Reset demo data_ to restore the seeded dataset (Cohort - 26-11-04, 45 active apprentices,
three weeks of attendance history).

## Architecture

See [CLAUDE.md](CLAUDE.md) for the layering, reactive conventions and business rules. In short:

- `domain/` — pure TypeScript rules (naming, phases, metrics, permissions) with unit tests.
- `data/` — repository **ports** + a `localStorage` adapter. Swapping to the REST API replaces the adapter only.
- `core/` — auth, cohort context, theme, and the adaptive app shell.
- `features/` — lazy-loaded pages backed by signal-based facades.

## Deploy

Vercel picks up `vercel.json` (build `npm run build`, output `dist/apros/browser`, SPA rewrites).
