---
name: nail-local-api
description: Build or modify Fastify local API routes for the nail salon POS. Use for endpoints, route tests, DB transactions, auth/permissions, checkout, turns, reports, scheduling, or API contract changes.
---

# Nail Local API

Use this skill when working in `apps/local-api` or changing API contracts.

## Read first

- `AGENTS.md`
- `api/API_SPEC.md`
- Relevant workflow doc in `workflows/`
- Existing similar route in `apps/local-api/src/routes/*.ts`
- Shared contracts in `packages/shared/src/api.ts`
- Prisma schema in `packages/db/prisma/schema.prisma` when persistence is affected

## Route pattern

Follow the existing Fastify module shape:

```ts
export async function registerXxxRoutes(app: FastifyInstance, db: DbClient) {
  // routes
}
```

Register new modules from `apps/local-api/src/server.ts`.

## API rules

- Keep handlers thin; move reusable business rules to `packages/shared/src`.
- Use Prisma/PostgreSQL only through `apps/local-api`; frontends must use API calls.
- Use database transactions for multi-record workflows: turns, checkout, payments, check-ins, refunds, and reports that need consistent snapshots.
- Persist money as integer cents.
- Use valid persisted enum/status values from Prisma/shared domain; do not invent UI-only persisted values.
- Do not mark a sale/payment as paid unless an approved `Payment` record exists in the backend.
- Card payments must go through the payment-terminal route/adapter and store only terminal references.
- Snapshot worker commission rates and service prices when creating sale items.

## Testing and verification

Prefer focused checks:

```bash
corepack pnpm --filter @nail/local-api typecheck
corepack pnpm test -- apps/local-api/src/routes.test.ts
```

When shared contracts change, also run:

```bash
corepack pnpm --filter @nail/shared typecheck
corepack pnpm --filter @nail/owner-pos typecheck
```

Note: If existing tests have unrelated mock-factory type errors, do not fix them unless asked; report them as pre-existing.
