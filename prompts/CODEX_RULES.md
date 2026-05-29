# Codex Rules — Nail Salon POS

## Architecture Rules

1. **Local-first, single database.** All three frontends (`owner-pos`, `worker-pwa`, `customer-pwa`) talk to a single `local-api` backend, which connects to one PostgreSQL database. Never add a separate database per app.
2. **API is the only data path.** Frontends never touch the database directly. All data access goes through `apps/local-api/src/routes/*.ts` → Prisma → PostgreSQL. Use `fetch()` or WebSocket on the `local-api` server only.
3. **Shared logic lives in `packages/shared/src/`.** Core business rules (turn counting, ranking, commission, money formatting, sales calculations) must be implemented there, re-exported via `index.ts`, and consumed by both `local-api` and frontends. Prefer `import { … } from "@nail/shared"` over duplicating logic.
4. **Keep shared logic tunable.** Extract magic numbers (thresholds, defaults) into named constants at the top of files so they're easy to find and adjust later. Examples: `DEFAULT_TURN_COUNT = 1`, `ZERO_TURN_COUNT = 0`.
5. **No secrets in code.** API keys, database URLs, and credentials go in `.env` files only (see `.env.example`). Never hardcode them.

## Turn & Rotation Rules

6. **A turn is a rotation slot, not a multiplier.** Each worker assignment is a single turn. `turnCount = 1` means the worker moves to the back of the round-robin line. `turnCount = 0` means they maintain their position.
7. **Round-robin ranking is by `lastTurnEndedAt`.** The worker whose last turn ended the longest ago (or who hasn't had a turn yet today) is suggested next. Do NOT sort by `turnsTakenToday` (fewest first). That was the old, wrong algorithm.
8. **Auto-zero threshold.** Services priced below `SalonSettings.turnCountThresholdCents` (default $30.00) default to `turnCount = 0`. This is determined by `calculateTurnCount()` in `packages/shared/src/turns.ts`.
9. **Per-service override wins.** If the owner sets an explicit `turnCount` on a Service model (in the Services management screen), that overrides the price-threshold logic. Use `calculateTurnCount(priceCents, threshold, serviceTurnCount)` to handle this.
10. **`turnsTakenToday` counts active turns with turnCount > 0.** Use `countEffectiveTurns()` for this. Active means status is "assigned", "in_service", or "completed" (not "skipped" or "cancelled"). A newly assigned turn must be immediately visible — do NOT wait for `startedAt` to be non-null.
11. **Manual toggle remains.** The owner can click a turn's count badge in the Session Grid to flip it between 0 and 1. This calls `PATCH /api/turns/:id` with `{ turnCount: 0|1 }`.

## Codebase Conventions

12. **Monorepo structure.** `apps/` = runnable applications, `packages/` = shared libraries, `db/` = SQL schemas, `docs/` = documentation, `workflows/` = flow diagrams, `tests/` = test plans.
13. **TypeScript everywhere.** All packages use TypeScript. Do not introduce plain JavaScript files. Use strict types; avoid `any` where possible (existing `any` usage in mock data and DB client typing is acceptable but don't add more).
14. **Fastify for the API.** `local-api` uses Fastify with `@fastify/cors`, `@fastify/websocket`. Register routes in `apps/local-api/src/routes/` and import them in `server.ts`. Follow existing patterns for route registration: `export async function registerXxxRoutes(app: FastifyInstance, db: DbClient)`.
15. **React + Vite for frontends.** All three frontends use React (no Next.js, no SSR) with Vite. Import components from `./components.js` (owner-pos) or define inline (PWAs). Use `import.meta.env.VITE_API_BASE_URL` for the API base URL.
16. **PWA-first for worker/customer apps.** `worker-pwa` and `customer-pwa` are mobile Progressive Web Apps. Keep them lightweight with inline components.
17. **No client-side routing libraries.** Use React state (`useState<View>`) for view switching, not react-router. Match existing patterns: `type View = "login" | "dashboard" | …` and conditional rendering.

## Development Workflow

18. **Compile-check after every change.** Run `npx tsc --noEmit -p <tsconfig-path>` for the affected package after edits. All three packages must compile cleanly.
19. **Pre-existing test errors are not yours to fix.** The `apps/local-api/src/routes.test.ts` has known type errors in its mock factories. Do not spend time fixing those unless explicitly asked.
20. **Read before writing.** Before modifying a file, read it fully. Before creating new files, check if similar patterns already exist in the codebase. Follow existing patterns.
21. **Commit messages in English.** Use concise, imperative-style commit messages.

## Data Integrity

22. **Commission rates must be snapshotted.** When a sale item is created, copy the worker's current `commissionRate` into `SaleItem.commissionRateSnapshot`. Never rely on the live `Worker.commissionRate` for completed transactions.
23. **POS owns the data; Clover owns card processing only.** The `packages/payment-terminal` adapter abstracts Clover. Card details are never stored in the POS database.
24. **Offline-first.** The local server and database must keep working during internet outages. Cloud sync is deferred (sync events table exists but sync logic is placeholder).