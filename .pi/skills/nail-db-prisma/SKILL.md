---
name: nail-db-prisma
description: Modify the PostgreSQL/Prisma data model, migrations, seed data, or DB client for the nail salon POS. Use for schema changes, persisted enum/status changes, monetary fields, sale/payment records, or audit/sync tables.
---

# Nail DB and Prisma

Use this skill when changing `packages/db`, `db/SCHEMA.sql`, migrations, seed data, or persisted data contracts.

## Read first

- `db/SCHEMA.sql`
- `packages/db/prisma/schema.prisma`
- `docs/ARCHITECTURE.md`
- `docs/PRODUCT_REQUIREMENTS.md`
- Relevant API/workflow docs for affected entities.

## Schema rules

- Keep one PostgreSQL database for the local store.
- Frontends do not connect to the DB; only `apps/local-api` uses DB clients.
- Store money as integer cents.
- Services are catalog items, not inventory.
- Snapshot service price and worker commission on sale items.
- Payment records must represent backend-approved/recorded payments.
- Card payment rows may store only safe Clover/terminal references; never sensitive card data.
- Persisted status/enum values must align with Prisma/shared/API usage.
- Add audit/sync considerations for sensitive actions or workflows that may need offline queueing.

## Change workflow

1. Inspect existing schema and route usage before editing.
2. Update Prisma schema and any SQL source-of-truth/migration files required by the task.
3. Update shared API/domain types if persisted shapes change.
4. Update local-api route code and tests.
5. Update seed data if new required fields are added.

## Verification

With `DATABASE_URL` configured and Postgres available:

```bash
corepack pnpm --filter @nail/db prisma:validate
corepack pnpm db:migrate
corepack pnpm --filter @nail/db typecheck
corepack pnpm --filter @nail/local-api typecheck
```

If the DB is unavailable, do not fake migration success; report that validation/migration could not be run.
