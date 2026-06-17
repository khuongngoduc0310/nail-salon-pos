---
name: nail-project-guardrails
description: Project-wide guardrails for the local-first nail salon POS. Use before architecture/product changes, cross-package changes, or whenever business rules, payments, turns, checkout, reports, or data ownership may be affected.
---

# Nail Salon POS Project Guardrails

Use this skill to keep changes aligned with the product, architecture, and non-negotiable business rules.

## First steps

1. Check worktree state with `git status --short`; do not overwrite unrelated user changes.
2. Read the relevant source-of-truth docs before changing product or architecture behavior:
   - `AGENTS.md`
   - `docs/PRODUCT_REQUIREMENTS.md`
   - `docs/ARCHITECTURE.md`
   - `docs/IMPLEMENTATION_PLAN.md`
   - `prompts/CODEX_RULES.md`
   - plus affected `workflows/*.md`, `api/API_SPEC.md`, `db/SCHEMA.sql`, or `tests/TEST_PLAN.md` as needed.
3. If implementation and docs conflict, surface the mismatch and make the smallest defensible change.

## Non-negotiable rules

- Local-first: in-store workflows must work without internet.
- One local API and one PostgreSQL database; frontends never access the database directly.
- POS owns services, workers, turns, sales, reports, receipts, and tips; Clover owns card capture/approval only.
- Never store full card number, CVV, PIN, magstripe data, raw EMV data, or sensitive card data.
- Store only payment-terminal/Clover references for card payments.
- Checkout payment state must reflect backend-recorded approved payments only.
- Worker commission rates and service prices must be snapshotted at checkout/sale-item creation time.
- Tips belong 100% to the worker.
- Owner decides worker assignment; suggestions must not silently assign workers.
- Turn-count logic belongs in `packages/shared/src` and must stay consistent between API and UI.
- Services are not inventory.

## Architecture checklist

- Put reusable business/domain logic in `packages/shared/src` and export it from `packages/shared/src/index.ts`.
- Use workspace package imports such as `@nail/shared`, `@nail/db`, `@nail/payment-terminal`.
- Keep payment-terminal behavior behind `packages/payment-terminal` or approved Clover package boundaries.
- Keep receipt-printer behavior behind `packages/receipt-printer`.
- Use Fastify route modules in `apps/local-api/src/routes`.
- Use React + Vite only for frontends; do not add Next.js/SSR.
- Use cents for money and persist monetary amounts as integer cents.

## Verification

Run the narrowest useful check:

```bash
corepack pnpm --filter @nail/shared typecheck
corepack pnpm --filter @nail/local-api typecheck
corepack pnpm --filter @nail/owner-pos typecheck
corepack pnpm --filter @nail/worker-pwa typecheck
corepack pnpm --filter @nail/customer-pwa typecheck
corepack pnpm test
```

If local services, DB, or credentials are unavailable, state that clearly in the final response.
