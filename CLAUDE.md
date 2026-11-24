# APROs — Apprenticeship Program Operations

Internal mobile-first PWA + desktop dashboard for cohort ops, daily coaching, and cohort health (AmaliTech).
Built in reviewed milestones: **never start the next step/milestone without explicit approval.**

## Commands
`npm start` (dev :4200) · `npm run test:ci` (Vitest) · `npm run lint` · `npm run build` · `npm run verify` (all three — run before handing off)

## Stack
- Angular 22, standalone only, **zoneless**, `OnPush` everywhere, strict TS (`strict`, `noUncheckedIndexedAccess`) + `strictTemplates`.
- Tailwind CSS v4 (CSS-first tokens), Vitest, angular-eslint, Prettier. Deployed on Vercel (`vercel.json`, SPA rewrite).

## Architecture (dependency direction: features → core/data ports → domain)
```
src/app/
  domain/      Pure TS, no Angular/I/O/Date.now(). models/*.model.ts · rules/*.rules.ts (+spec) · utils/*.util.ts · errors/
  data/        ports/*.repository.ts|*.port.ts (abstract = DI tokens) · adapters/local/ · local-db/ · seed/ · data.providers.ts
  core/        auth/ (service + *.guard.ts) · config/*.token.ts · platform/ (clock, storage) · state/*.store.ts · theme/
               layout/<component>/ (app-shell, top-bar, side-nav, bottom-nav, cohort-switcher, user-menu) · core.providers.ts
  features/<feature>/
               pages/<page>/<page>.page.{ts,html,css}   routed screens
               components/<name>/<name>.component.*     feature-only UI
               data-access/<name>.facade.ts             signals read model / commands
               <feature>.routes.ts                      exports <FEATURE>_ROUTES
  shared/      components/<name>/<name>.component.{ts,html,css} · directives/*.directive.ts · pipes/ · utils/*.util.ts
  testing/     provideTestApp()/setupTestApp() — FixedClock, MemoryStorage, zero latency
  app.routes.ts  guards + lazy `loadChildren` per feature only
styles/tokens.css  Brand ramps + semantic roles (light/dark/.theme-dark)
```
- Components/facades inject **ports only** (`CohortRepository`, `AttendanceRepository`, …). Adapters are bound once in
  `data.providers.ts`. Spring Boot swap = add `adapters/http/*` + one provider branch. Nothing else changes.
- Port contract: `watch*()` streams emit immediately + on change; commands are cold, single-emission, error with a `DomainError`.
- `LocalDbService` is the only persistence touchpoint: one normalized, versioned store (`apros.db`, `schemaVersion` + `MIGRATIONS`),
  pure `write(mutation)` commits, simulated latency, debounced persistence, cross-tab sync, lazy-loaded seed, `resetToSeed()`.
- Local adapters enforce permissions via `ActorContext` exactly like the API will (403/401). Guards are UX, not security.

## File & naming conventions (Angular style guide, 2016 suffixes — keep predictable)
- **Never inline `template:` or `styles:`.** Every component/page = folder with `.ts` + `.html` + `.css` (css may be empty).
- One concept per file; folder name = file stem = selector (`ap-user-menu` → `user-menu/user-menu.component.*`).
- Suffix ↔ class: `.component.ts` → `XComponent` · `.page.ts` → `XPage` · `.directive.ts` → `XDirective` · `.service.ts` → `XService`
  (abstract platform ports keep plain names: `Clock`, `KeyValueStorage`, `AuthService`) · `.store.ts` · `.facade.ts` · `.guard.ts`
  · `.repository.ts` · `.port.ts` · `.adapter.ts` · `.model.ts` · `.rules.ts` · `.util.ts` · `.const.ts` · `.token.ts` · `.providers.ts` · `.factory.ts`.
- Feature folders always have the same shape; add a new screen by adding `pages/<x>/` + a route in `<feature>.routes.ts`.
- Specs sit next to their file as `<file>.spec.ts`. `domain/index.ts` is the only barrel; elsewhere import the file directly.

## Reactive rules (RxJS + Signals)
- **RxJS** at boundaries: repository streams, debounced input, async pipelines, cross-tab events.
- **Signals** for UI state: facades expose read-only signals + `computed()`; components only read signals.
- Bridge with `toSignal`/`toObservable`; use `streamFor(keySignal, query, initial)` for key-scoped repository streams.
- No `subscribe()` in components except fire-and-forget commands (they complete); otherwise `takeUntilDestroyed()`.
- Signal APIs only: `input()`, `output()`, `model()`, `viewChild()`; control flow `@if/@for/@defer`; `track` by id.

## Domain rules (source of truth: `domain/rules` — keep this list in sync)
- **Roles:** `ADMIN` = everything (cohorts, specializations, onboarding/import, assignments, Phase 2 sprint marks).
  `COACH` = attendance/EOD/behavior for **any** apprentice, dashboards, export. Matrix: `rules/permissions.ts`.
- **Cohort naming:** `code = YY-MM-SS` from `phase1StartDate`; sequence = max+1 **per calendar year**. Default
  `displayName = "Cohort - {code}"` (editable). `code`/`year`/`month`/`sequenceNumber` immutable; reschedules must stay in the code's month.
- **Lifecycle** derived from dates (`resolveCohortPhase`): UPCOMING → PHASE_1 → INTERMISSION → PHASE_2 → COMPLETED; `isArchived` is explicit.
- **Specialization** is data (`id, name, code, colorTag`) — never hardcode tracks. `colorTag` → brand ramp via `colorTagVar()`.
- **Attendance:** one record per apprentice per day (id `${apprenticeId}:${date}`, upsert). Statuses `P` `L` `A` `E`.
  No record = **Not Here Yet** (never implied Absent). `E` requires a reason; `P` never has one.
- **Metrics:** `E` is a neutral day, excluded from penalty denominators; keep raw `P/L/A/E` counts visible.
  Attendance = `(P+L)/(P+L+A)` (100% if 0) · Punctuality = `P/(P+L)` (100% if 0).
- **Sweep buckets:** `Not Here Yet` · `Present` (P, L) · `Absent / Excused` (A, E).
- **Non-working days:** weekends + `cohort.nonWorkingDays` block recording in production; **Demo Mode never blocks** (warns only).
- Dates are local `YYYY-MM-DD` (`IsoDate`); timestamps ISO-8601. Inject `Clock` — never `new Date()` in domain/services.

## Design system (AmaliTech "Unified Experience Design" Figma)
- Brand: navy `primary-500 #08283B`, orange `orange-500 #FF5A00`; headings Poppins, body Inter; radius-xl 12px.
- Use semantic utilities (`bg-surface`, `text-fg-muted`, `bg-status-p-soft`, `btn btn-primary`, `card`, `field`, `glass`). No raw hex in components.
- Glass: `glass` (floating layers), `glass-strong` (hero panels, e.g. login card), `glass-tile` (translucent content inside a glass
  panel, no blur). Never nest backdrop-filters or put one on an *ancestor* of menus/sheets (breaks child blur and `position: fixed`).
- `.theme-dark` forces dark tokens on a subtree (login brand scene) regardless of the user's theme.
- Don't put display utilities on a component host that callers may need to hide — wrap instead.
- Accessibility: WCAG 2.2 AA, ≥44px targets, full keyboard paths (listbox/menu patterns), `aria-live` for counts, reduced motion respected.
- Performance: lazy routes, initial ≤ 250 kB gzipped (currently ~95 kB), virtualize lists > 100 rows.

## Conventions
- Files kebab-case; selectors `ap-`; entity ids string UUIDs; entities `readonly`, state immutable.
- **Testing pace (current):** no new unit tests for UI/screens/components — ship visual flows fast. Pure `domain/` rules
  still get a small spec. Existing specs must keep passing (`npm run verify`). Types stay strict; structure stays production-grade.
- Seed data is deterministic (`Prng`) — keep it stable across resets.
