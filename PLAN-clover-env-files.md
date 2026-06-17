# Plan: Support Multiple Clover Environment Files

## Context

The requested configuration should be available from the Owner POS Checkout tab, not only by editing shell `.env` variables before starting the API. Today the local API creates the payment terminal adapter once at startup from `process.env`, so changing Clover host/port from the UI is not possible.

## Approach

Add a small Clover connection settings panel inside the Checkout tab. The panel will let the owner enter the real Clover LAN WebSocket settings, apply them, and then pair/connect without restarting the local API.

Recommended fields in Checkout:

- Transport: `Mock`, `Clover LAN WebSocket`, `Mock Clover REST-local`
- Clover LAN host/IP
- Clover LAN WebSocket port
- WebSocket path, default `/remote_pay`
- Secure WebSocket toggle, default on (`wss`)
- Remote app ID
- POS name
- POS serial number
- Optional auth token field for first-pairing reuse

The local API will expose terminal config endpoints and keep a runtime terminal adapter that can be replaced when config changes. Sensitive values such as `CLOVER_AUTH_TOKEN` should not be returned in full to the browser; return only whether a token is configured or a masked token preview.

## Files to modify

- `apps/local-api/src/payment-terminal.ts`
- `apps/local-api/src/server.ts`
- `apps/owner-pos/src/api.ts`
- `apps/owner-pos/src/main.tsx`
- `apps/owner-pos/src/styles.css`
- `packages/clover-payment/src/index.ts` if config type/export adjustment is needed
- `api/API_SPEC.md`
- `docs/ARCHITECTURE.md`
- `workflows/CLOVER_FLOW.md`
- `tests/CLOVER_PAYMENT_TEST_PLAN.md`

## Reuse

- Reuse `loadCloverPaymentConfig()`, `validateCloverPaymentConfig()`, and `createCloverPaymentAdapter()` from `@nail/clover-payment`.
- Reuse `CloverTerminalAdapter` in `apps/local-api/src/payment-terminal.ts`.
- Reuse existing checkout terminal status, pairing, and refresh UI patterns in `apps/owner-pos/src/main.tsx`.

## Steps

- [ ] Add a runtime terminal manager in local API that wraps the active `PaymentTerminalAdapter` and can replace it after config updates.
- [ ] Add `GET /api/terminal/config` to return safe current config for Checkout UI.
- [ ] Add `PATCH /api/terminal/config` to validate/apply Clover config and rebuild the active adapter.
- [ ] Add Owner POS API client functions for terminal config get/update.
- [ ] Add a Clover connection settings panel/modal in the Checkout tab.
- [ ] Wire save/apply to refresh terminal status and allow pairing/payment with the new runtime config.
- [ ] Update docs/API spec/test plan with Checkout-tab configuration flow.
- [ ] Verify owner POS/local API/clover package typechecks and focused tests.

## Verification

Run:

```cmd
corepack pnpm --filter @nail/local-api typecheck
corepack pnpm --filter @nail/owner-pos typecheck
corepack pnpm --filter @nail/clover-payment typecheck
```

Manual check:

1. Open Owner POS Checkout.
2. Open Clover connection settings.
3. Enter real Clover host/port/path/app ID/POS details.
4. Save/apply.
5. Pair and run terminal status check from Checkout without restarting API.
