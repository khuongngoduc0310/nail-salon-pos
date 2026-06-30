# Refactor, Cleanup, and Directory Organization Plan

## Context

The repository has grown into a working local-first POS monorepo, but several areas are now hard to navigate and risky to change:

- `apps/owner-pos/src/main.tsx` is very large (~5,930 lines) and mixes app shell, floor, checkout, reports, management screens, modals, helpers, and mock data.
- `apps/owner-pos/src/styles.css` is very large (~3,306 lines) and contains styles for many unrelated screens.
- `apps/local-api/src/routes/checkout.ts` (~938 lines) and `apps/local-api/src/routes/reports.ts` (~621 lines) contain multiple workflows and report builders in single files.
- Root-level one-off SQL files (`add-sessions.sql`, `add-turn-count.sql`, `add-worker-sessions.sql`, `rename-enums.sql`, `seed-test-data.sql`, `setup-db.sql`) are mixed with project configuration.
- There are stray/generated-looking directories/files at the root (`undefined/`, `_tmp_*`, `.claude/`, `CLAUDE.md`) that should be classified before moving or deleting.
- Prisma migration state needs special care: the worktree currently shows deleted `0002`-`0005` migrations and a new `0006_sale_adjustments` migration. Cleanup must not hide or corrupt migration history.
- There are many existing unstaged changes, so this refactor should be done in small reviewable phases and should not overwrite unrelated work.

## Approach

Use a staged, low-risk refactor that reorganizes by domain while preserving behavior. The recommended approach is **extract-first, move-later**:

1. Freeze behavior with typechecks and focused tests.
2. Extract large files into screen/domain modules without changing runtime behavior.
3. Move route/report helper logic into local API domain modules.
4. Organize scripts/docs/temp artifacts only after confirming what is still used.
5. Add lightweight conventions so future files land in the right place.

Avoid a single massive directory reshuffle. Each phase should compile independently and keep imports explicit.

## Files to modify

Likely code files:

- `apps/owner-pos/src/main.tsx`
- `apps/owner-pos/src/styles.css`
- `apps/owner-pos/src/api.ts`
- `apps/owner-pos/src/components.tsx`
- `apps/local-api/src/routes/checkout.ts`
- `apps/local-api/src/routes/reports.ts`
- `apps/local-api/src/server.ts` only if route registration boundaries change
- `packages/shared/src/*` for reusable sale/report/checkout logic if extracted from API/UI

Likely new directories/files:

- `apps/owner-pos/src/app/`
- `apps/owner-pos/src/screens/floor/`
- `apps/owner-pos/src/screens/checkout/`
- `apps/owner-pos/src/screens/reports/`
- `apps/owner-pos/src/screens/services/`
- `apps/owner-pos/src/screens/workers/`
- `apps/owner-pos/src/ui/`
- `apps/owner-pos/src/lib/`
- `apps/owner-pos/src/styles/`
- `apps/local-api/src/routes/checkout/`
- `apps/local-api/src/routes/reports/`
- `apps/local-api/src/domain/`
- `scripts/db/` or `db/scripts/` for root SQL helpers that are still useful

Docs/config likely updated:

- `AGENTS.md`
- `README.md`
- `docs/ARCHITECTURE.md`
- Maybe `docs/IMPLEMENTATION_PLAN.md`
- Maybe `.gitignore` if generated/temp directories should be ignored

## Reuse

Existing code and patterns to preserve/reuse:

- `apps/owner-pos/src/components.tsx`: existing shared UI primitives (`Button`, `Modal`, `Input`, `Select`, `AmountInput`, `Tabs`, etc.).
- `apps/owner-pos/src/api.ts`: existing Owner POS API client boundary.
- `apps/owner-pos/src/reportTarget.ts`: existing report navigation helper pattern.
- `apps/owner-pos/src/workerForm.ts`: existing extracted form/domain helper pattern with tests.
- `packages/shared/src/sales.ts`: sale totals, completion, and tip allocation logic.
- `packages/shared/src/turns.ts`: turn ordering/count logic.
- `apps/local-api/src/http.ts`: existing request parsing/error helpers.
- `apps/local-api/src/routes/*.ts`: existing route module registration pattern.
- `packages/db/prisma/schema.prisma` + `db/SCHEMA.sql`: database source-of-truth pair; keep aligned.

## Target structure

### Owner POS

Recommended final shape:

```text
apps/owner-pos/src/
  app/
    App.tsx
    navigation.ts
  screens/
    floor/
      FloorScreen.tsx
      FloorSessionBar.tsx
      WaitingQueuePanel.tsx
      WorkerBoard.tsx
      ReadyCheckoutRail.tsx
      TurnMatrixPanel.tsx
      floorUtils.ts
      floor.css
    checkout/
      CheckoutScreen.tsx
      CheckoutItemsPanel.tsx
      PaymentPanel.tsx
      TerminalConfigModal.tsx
      TicketEditModal.tsx
      TipAllocationModal.tsx
      checkoutDraft.ts
      checkoutTypes.ts
      checkoutUtils.ts
      checkout.css
    reports/
      ReportsScreen.tsx
      SalesReport.tsx
      PaymentReport.tsx
      TicketDetailModal.tsx
      FinishedTicketAdjustmentModal.tsx
      reports.css
    services/
      ServicesScreen.tsx
      serviceForm.ts
      services.css
    workers/
      WorkersScreen.tsx
      workers.css
  ui/
    components.tsx or re-export wrappers
  lib/
    money.ts
    dates.ts
    storage.ts
  api.ts
  main.tsx
  styles.css
```

`main.tsx` should ideally only create the React root and render `App`.

### Local API

Recommended final shape:

```text
apps/local-api/src/
  routes/
    checkout.ts              # thin registration or compatibility re-export
    checkout/
      index.ts
      item-routes.ts
      payment-routes.ts
      adjustment-routes.ts
      refund-routes.ts
      checkout-helpers.ts
    reports.ts               # thin registration or compatibility re-export
    reports/
      index.ts
      sales-report.ts
      worker-report.ts
      payment-report.ts
      report-filters.ts
      report-adjustments.ts
  domain/
    sale-adjustments.ts
    payment-references.ts
```

Keep `apps/local-api/src/server.ts` importing the same public route registration names to reduce churn.

### Root cleanup

Recommended organization after confirming use:

```text
scripts/db/
  add-sessions.sql
  add-turn-count.sql
  add-worker-sessions.sql
  rename-enums.sql
  seed-test-data.sql
  setup-db.sql
```

Generated or accidental artifacts should either be removed or added to `.gitignore`, but only after confirming they are not user-owned:

- `_tmp_*`
- `undefined/`
- `.claude/`
- `CLAUDE.md`

## Steps

### Phase 0 — Safety and inventory

- [ ] Confirm current feature work is committed/stashed or explicitly included before any refactor.
- [ ] Capture current `git status --short` and do not overwrite unrelated work.
- [ ] Run baseline checks:
  - [ ] `corepack pnpm typecheck`
  - [ ] `corepack pnpm test` or focused tests if full suite is too slow
- [ ] Inventory root artifacts and classify each as source, helper script, generated artifact, or obsolete.
- [ ] Confirm Prisma migration history strategy before moving/deleting any migration files.

### Phase 1 — Owner POS extraction without behavior changes

- [ ] Move root rendering from `main.tsx` into `app/App.tsx`; keep `main.tsx` minimal.
- [ ] Extract Floor code into `screens/floor/*`.
- [ ] Extract Checkout code into `screens/checkout/*`.
- [ ] Extract Reports code into `screens/reports/*`.
- [ ] Extract Services and Workers screens into their own directories.
- [ ] Move local helper functions into screen-specific `*Utils.ts` files only when they are not shared.
- [ ] Keep the public `apps/owner-pos/src/api.ts` API client as the screen boundary for backend calls.
- [ ] Run `corepack pnpm --filter @nail/owner-pos typecheck` after each screen extraction.

### Phase 2 — Owner POS style split

- [ ] Split `styles.css` into global base styles plus screen-level CSS files.
- [ ] Keep shared tokens/global rules in `styles.css` or `styles/global.css`.
- [ ] Move floor styles to `screens/floor/floor.css`.
- [ ] Move checkout styles to `screens/checkout/checkout.css`.
- [ ] Move report styles to `screens/reports/reports.css`.
- [ ] Move service/worker management styles into their screen directories.
- [ ] Preserve class names first; do not restyle during extraction.
- [ ] Run Owner POS typecheck and a visual smoke test.

### Phase 3 — Local API route cleanup

- [ ] Split `routes/checkout.ts` into item, payment, tip allocation, adjustment, refund, and completion route files under `routes/checkout/`.
- [ ] Extract shared checkout route helpers (`recomputeSale`, `saleLookup`, payment reference helpers, edit guards) into `routes/checkout/checkout-helpers.ts` or `domain/*`.
- [ ] Split `routes/reports.ts` into report builders by report type.
- [ ] Move adjustment overlay/report logic into a dedicated helper so sales and worker reports use the same adjustment behavior.
- [ ] Keep route URLs and response shapes unchanged.
- [ ] Run `corepack pnpm --filter @nail/local-api typecheck` after each route group extraction.

### Phase 4 — Shared domain consolidation

- [ ] Identify duplicated money/date/report transform logic between API and Owner POS.
- [ ] Move reusable, non-UI business logic to `packages/shared/src`.
- [ ] Add/extend focused shared tests where behavior is business-critical.
- [ ] Keep UI-only formatting in the app unless multiple apps need it.

### Phase 5 — Root and script organization

- [ ] Move still-useful root SQL helpers into `scripts/db/` or `db/scripts/`.
- [ ] Update README/AGENTS command references if script paths change.
- [ ] Decide whether `_tmp_*`, `undefined/`, `.claude/`, and `CLAUDE.md` are generated, local-only, or should be committed.
- [ ] Add generated/local artifacts to `.gitignore` only after confirmation.
- [ ] Do not alter Prisma migration history until the team decides whether deleted migrations are intentional.

### Phase 6 — Documentation and conventions

- [ ] Update `AGENTS.md` repository layout with the new screen/route organization.
- [ ] Update `docs/ARCHITECTURE.md` if route/domain layering changes.
- [ ] Add a short `apps/owner-pos/src/README.md` explaining screen directory conventions.
- [ ] Add a short `apps/local-api/src/routes/README.md` explaining route module conventions.

## Verification

Run incrementally:

```bash
corepack pnpm --filter @nail/owner-pos typecheck
corepack pnpm --filter @nail/local-api typecheck
corepack pnpm --filter @nail/shared typecheck
corepack pnpm --filter @nail/db typecheck
```

Run broader checks after each phase:

```bash
corepack pnpm typecheck
corepack pnpm test
```

Manual smoke checks:

- Owner POS opens.
- Floor page loads session/workers/check-ins.
- Manual ticket and checkout still work.
- Add/edit sale item still works.
- Card/cash/gift-card payment paths still show expected state.
- Reports load and ticket detail/adjustment modals still work.
- Worker PWA and Customer PWA still build/typecheck if shared files changed.

## Open questions

1. Should the refactor be limited to `apps/owner-pos` first, or include `apps/local-api` in the same project?
2. Should root SQL helper files be moved into `scripts/db/`, `db/scripts/`, or left at root for now?
3. Are `.claude/`, `CLAUDE.md`, `_tmp_*`, and `undefined/` intentionally part of this repo, or should they be treated as local/generated artifacts?
4. Should the current large unstaged feature changes be completed/committed before the refactor begins?
