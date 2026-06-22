# Clover API Alignment Checklist

Use this checklist before wiring `@nail/clover-payment` into `apps/local-api` checkout.

## Clover app/module setup

- [ ] In Clover Developer Dashboard, select only the app modules needed for card-present payments, refunds, and payment lookup/reconciliation.
- [ ] Do not select or depend on Clover Items, Inventory, Employees, Customers, Discounts, or Orders as the POS system of record unless a later approved change requires it.
- [ ] Confirm the merchant service plan can install/connect the app with the selected modules.
- [ ] Document any Clover permissions required by the app OAuth flow.

## REST Pay Display connection

- [ ] For local development, run the mock Clover device with `corepack pnpm dev:mock-clover` and point `CLOVER_DEVICE_BASE_URL` at `http://localhost:4100`.
- [ ] Confirm REST Pay Display is installed and running on the Clover Mini/Flex for local LAN connections.
- [ ] Confirm OAuth is complete and the POS has a bearer token for Clover requests.
- [ ] Use HTTPS in production.
- [ ] Install/trust the Clover device certificate authority on the local POS server.
- [ ] Configure the device URL/port, normally `https://<device-ip>:12346/connect`.
- [ ] Send required headers: `Authorization`, `X-Clover-Device-Id`, and `X-POS-ID`.

## Cloud REST Pay Display connection

- [ ] Configure `CLOVER_TRANSPORT=rest-cloud`.
- [ ] Configure `CLOVER_CLOUD_BASE_URL`, `CLOVER_MERCHANT_ID`, `CLOVER_APP_ID`, `CLOVER_APP_SECRET`, `CLOVER_ACCESS_TOKEN`, `CLOVER_DEVICE_ID`, and `CLOVER_POS_ID`.
- [ ] Keep OAuth/install token exchange manual for this version; do not store Clover app secrets or access tokens in frontend code.
- [ ] Send required cloud context headers: `Authorization`, `X-Clover-Merchant-Id`, `X-Clover-App-Id`, `X-Clover-Device-Id`, and `X-POS-ID`.
- [ ] Do not send the Clover app secret to payment endpoints unless Clover's API explicitly requires it.

## API shape alignment

- [ ] Send sales to `/v1/payments` with Clover field names: `amount` and `externalPaymentId`.
- [ ] Map the POS idempotency key to Clover `externalPaymentId`.
- [ ] If using on-device pre-payment tips, request tip with `/v1/device/read-tip` using `baseAmount`, then charge the returned total through `/v1/payments`.
- [ ] Keep auth/capture and paper tip-adjust flows out of checkout until explicitly needed.
- [ ] Normalize Clover response data into POS-safe fields only.

## Security

- [ ] Never store full card number, CVV, PIN, magstripe, raw EMV, or sensitive auth data.
- [ ] Strip sensitive fields recursively and case-insensitively before retaining provider metadata.
- [ ] Do not log bearer tokens or sensitive Clover response fields.

## POS integration

- [ ] Wrap `CloverPaymentAdapter` behind the existing `PaymentTerminalAdapter` boundary.
- [ ] Keep `apps/local-api` checkout route thin and backend-owned.
- [ ] Persist `provider: "clover"` for real Clover payments.
- [ ] Record Clover-returned tip from backend adapter result only.
- [ ] Require owner allocation for multi-worker Clover tips before checkout completion.
- [ ] Keep Clover out of salon services, workers, commissions, reports, turns, and receipts as system of record.

## Verification

- [ ] Run `corepack pnpm --filter @nail/mock-clover-device typecheck`.
- [ ] Run `corepack pnpm --filter @nail/mock-clover-device test`.
- [ ] Run `corepack pnpm --filter @nail/clover-payment typecheck`.
- [ ] Run `corepack pnpm --filter @nail/clover-payment test`.
- [ ] Run `corepack pnpm --filter @nail/payment-terminal typecheck` after adding the wrapper.
- [ ] Run `corepack pnpm --filter @nail/local-api typecheck` after local API integration.
- [ ] Run Clover sandbox/device tests from `tests/CLOVER_PAYMENT_TEST_PLAN.md`.
