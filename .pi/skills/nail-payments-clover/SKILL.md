---
name: nail-payments-clover
description: Work on payment-terminal or Clover payment integration for the nail salon POS. Use for card payments, refunds, terminal adapters, Clover references, checkout payment state, or payment security reviews.
---

# Nail Payments and Clover

Use this skill for card payment, payment-terminal, Clover, refund, reconciliation, or checkout-payment-state work.

## Read first

- `docs/ARCHITECTURE.md` payment architecture.
- `workflows/CHECKOUT_FLOW.md` and `workflows/CLOVER_FLOW.md`.
- `tests/CLOVER_PAYMENT_TEST_PLAN.md` if present.
- Existing payment code in `packages/payment-terminal/src`, `packages/clover-payment/src`, and relevant `apps/local-api/src/routes/*` checkout/payment routes.

## Security rules

Never store, log, or expose:

- Full card number/PAN
- CVV/CVC
- PIN
- Magstripe data
- Raw EMV data
- Sensitive cardholder authentication data

Store only safe terminal/Clover references such as payment IDs, auth/reference IDs, status, amount, method, timestamps, and non-sensitive display metadata if already allowed by the model.

## Architecture rules

- POS is system of record for services, workers, turns, sales, tips, commissions, reports, and receipts.
- Clover/payment terminal owns card capture, approval/decline, and payment security.
- Keep terminal behavior behind adapter packages; do not embed Clover calls directly in UI.
- UI must not mark card payments paid until `apps/local-api` records an approved backend `Payment`.
- Cash/gift-card payments also require backend-created approved payment records before paid state.
- Local-first workflows must not depend on cloud services beyond the physical payment terminal interaction.

## Adapter expectations

Preserve the adapter boundary equivalent to:

```ts
verifyConnection()
startSale(input)
cancelCurrentAction()
refund(input)
reconcile(input)
```

Use mock adapters for local development and tests; production Clover behavior should be isolated and configurable via environment variables, not hardcoded secrets.

## Verification

```bash
corepack pnpm --filter @nail/payment-terminal typecheck
corepack pnpm --filter @nail/local-api typecheck
corepack pnpm test -- packages/payment-terminal/src/mock-terminal.test.ts
```

If `packages/clover-payment` changed, run its focused typecheck/tests too.
