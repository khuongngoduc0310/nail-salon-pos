# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project Context

This is a TypeScript monorepo for a local-first, single-store nail salon POS system. The system has:

- Owner POS web app for Windows/iPad: `apps/owner-pos`
- Worker PWA for iPhone: `apps/worker-pwa`
- Customer booking/check-in PWA: `apps/customer-pwa`
- Local Fastify API: `apps/local-api`
- Shared domain packages: `packages/*`
- Prisma/PostgreSQL database package: `packages/db`

The product is local-first. In-store workflows must keep working when the internet is down. Clover is used only as the payment terminal, not as the POS system of record.

## Source Of Truth

Read these before making product or architecture changes:

- `docs/PRODUCT_REQUIREMENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `db/SCHEMA.sql`
- `api/API_SPEC.md`
- `workflows/*.md`
- `tests/TEST_PLAN.md`
- `prompts/CODEX_RULES.md`

If implementation and docs conflict, surface the mismatch and make the smallest defensible change. Do not silently redefine business rules.

When an approved code change intentionally changes documented behavior, architecture, API contracts, database schema, workflows, or test expectations, update the corresponding source-of-truth document in the same task so docs and implementation stay aligned.

## Non-Negotiable Business Rules

- Never store full card number, CVV, PIN, magstripe data, raw EMV data, or other sensitive card data.
- Store only Clover/payment-terminal references for card payments.
- POS owns services, workers, turns, sales, reports, and receipts. Clover owns card processing only.
- Worker commission rates must be snapshotted at checkout time.
- Tips belong 100% to the worker.
- Do not determine or prefill tips when adding sale items in checkout; Clover/payment-terminal tip flow determines any tip added after the sale is sent for payment.
- Owner decides worker assignment; the POS may suggest but must not silently assign.
- Turn count rules belong in shared domain logic and must stay consistent between API and UI.
- Services are not inventory.
- Checkout payment state must reflect backend-recorded payments only. Do not mark cash, gift card, or card payments as paid in the UI until `apps/local-api` has created an approved `Payment`; card payments must go through the payment-terminal route/adapter.
- Sale item status values must match Prisma/shared domain enums. Use valid statuses such as `active`, `voided`, or `refunded`; do not invent UI-only statuses like `cancelled` for persisted sale items.

## Architecture Rules

- Keep one local API and one PostgreSQL database. Do not add separate databases per app.
- Frontends must not access the database directly. All data access goes through `apps/local-api`.
- Put reusable business logic in `packages/shared/src` and export it from `packages/shared/src/index.ts`.
- Prefer `@nail/shared`, `@nail/db`, and other workspace package imports over duplication.
- Keep payment-terminal behavior behind `packages/payment-terminal`.
- Keep receipt-printer behavior behind `packages/receipt-printer`.
- Use Fastify route modules in `apps/local-api/src/routes`.
- Use React + Vite for all frontends. Do not introduce Next.js or SSR.
- Worker and customer apps are PWA-oriented and should remain lightweight.

## Repository Layout

```text
apps/
  owner-pos        React + Vite owner POS shell
  worker-pwa       React + Vite worker PWA shell
  customer-pwa     React + Vite customer PWA shell
  local-api        Fastify local API
packages/
  shared           Shared business/domain logic
  db               Prisma schema, migrations, seed, DB client exports
  payment-terminal Payment terminal interface and mock adapter
  receipt-printer  Receipt printer interface and mock adapter
docs/              Product and architecture docs
api/               API specification
workflows/         Business workflow docs
tests/             Test plan
prompts/           Codex-specific rules and prompts
```

## Local Setup

Use pnpm through Corepack:

```powershell
corepack pnpm install
```

Create local env files from examples when needed:

```powershell
Copy-Item .env.example .env
```

Start PostgreSQL:

```powershell
docker compose up -d postgres
```

Run migration and seed:

```powershell
corepack pnpm db:migrate
corepack pnpm db:seed
```

## Common Commands

From the repository root:

```powershell
corepack pnpm dev
corepack pnpm dev:api
corepack pnpm dev:owner
corepack pnpm dev:worker
corepack pnpm dev:customer
corepack pnpm test
corepack pnpm lint
corepack pnpm typecheck
```

Package-scoped checks:

```powershell
corepack pnpm --filter @nail/local-api typecheck
corepack pnpm --filter @nail/owner-pos typecheck
corepack pnpm --filter @nail/worker-pwa typecheck
corepack pnpm --filter @nail/customer-pwa typecheck
corepack pnpm --filter @nail/db typecheck
corepack pnpm --filter @nail/shared typecheck
```

Default local URLs:

- Owner POS: `http://localhost:5173`
- Worker PWA: `http://localhost:5174`
- Customer PWA: `http://localhost:5175`
- Local API health: `http://localhost:4000/api/health`

## Coding Conventions

- TypeScript everywhere. Do not add plain JavaScript source files.
- Avoid `any` unless matching an existing local pattern or unavoidable boundary.
- Read the surrounding file before editing and follow the established style.
- Keep changes scoped to the task. Avoid opportunistic refactors.
- Keep magic business values in named constants.
- Use cents for money calculations and persist monetary values as integer cents.
- Use API types and shared utilities instead of reshaping the same data in each app.
- Do not hardcode secrets, database URLs, API keys, Clover credentials, or device identifiers.
- Keep `.env` values local and out of committed source.

## API Guidelines

- Route modules should follow the existing Fastify pattern:

```ts
export async function registerXxxRoutes(app: FastifyInstance, db: DbClient) {
  // routes
}
```

- Register new route modules from `apps/local-api/src/server.ts`.
- Keep route handlers thin when business logic belongs in `packages/shared`.
- Use database transactions for multi-record workflow changes such as turn assignment, checkout completion, payments, and check-in updates.
- Preserve local-first behavior. Do not make in-store API paths depend on cloud services.

## Frontend Guidelines

- Use `import.meta.env.VITE_API_BASE_URL` for API base URL configuration.
- Keep owner POS workflows efficient for repeated in-store use.
- Keep worker/customer apps mobile-first and PWA-friendly.
- Do not add client-side routing libraries unless explicitly requested; current apps use React state for view switching.
- For shared UI/data contracts, prefer `packages/shared` rather than copying logic.

## Testing And Verification

Run the narrowest useful checks after edits, then broader checks when shared behavior changes.

- Shared business logic: run `corepack pnpm --filter @nail/shared typecheck` and relevant Vitest tests.
- API changes: run `corepack pnpm --filter @nail/local-api typecheck`; test affected endpoints when practical.
- Database changes: run Prisma validation/migration commands with the expected `DATABASE_URL`.
- Frontend changes: run the affected app typecheck and visually verify when UI behavior changes.
- Cross-package changes: run `corepack pnpm typecheck` and `corepack pnpm test` when feasible.

If a command cannot be run because local services or credentials are missing, state that clearly in the final response.

## Git And Workspace Safety

- The worktree may contain user changes. Do not revert or overwrite unrelated changes.
- Check `git status --short` before broad edits.
- Do not run destructive Git commands such as `git reset --hard` or `git checkout --` unless explicitly requested.
- Keep commits focused when asked to commit.
- Use concise imperative English commit messages.
