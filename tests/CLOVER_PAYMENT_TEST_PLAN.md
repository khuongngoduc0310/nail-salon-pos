# Clover Payment Package Test Plan

## Scope

This plan covers the standalone `@nail/clover-payment` package. It does not cover the later POS checkout integration except where adapter contract behavior must be preserved for that future work.

The package must prove that Clover is only a card processor. It must never expose or persist full card number, CVV, PIN, magstripe, raw EMV, or other sensitive card data.

## Local Automated Tests

Run:

```powershell
corepack pnpm --filter @nail/clover-payment typecheck
corepack pnpm --filter @nail/clover-payment test
```

Required passing cases:

- `MockCloverPaymentAdapter` returns approved payment metadata with `baseAmountCents`, Clover-returned `tipCents`, and `totalChargedCents`.
- Declined, cancelled, and failed mock payments return no charged total and no tip.
- Mock reconciliation totals only approved payments.
- Reconciliation preserves Clover `externalPaymentId` so a POS pending payment can be recovered by exact idempotency-key match.
- Reconciliation preserves safe Clover order/ticket references when available so a POS sale/ticket can also be matched to a Clover payment.
- Config defaults to `mock`.
- `rest-local` config rejects missing `CLOVER_DEVICE_BASE_URL`, `CLOVER_DEVICE_ID`, `CLOVER_POS_ID`, and `CLOVER_ACCESS_TOKEN`.
- `rest-cloud` config rejects missing `CLOVER_CLOUD_BASE_URL`, `CLOVER_MERCHANT_ID`, `CLOVER_APP_ID`, `CLOVER_APP_SECRET`, `CLOVER_DEVICE_ID`, `CLOVER_POS_ID`, and `CLOVER_ACCESS_TOKEN`.
- `usb-sidecar` config rejects missing `CLOVER_USB_SIDECAR_URL`.
- REST adapter sends Clover REST Pay Display requests to `/connect/v1/payments` with Clover field names `amount` and `externalPaymentId`, plus required `Authorization`, `X-Clover-Device-Id`, and `X-POS-ID` headers.
- Cloud REST adapter sends Clover REST Pay Display requests to the configured cloud base URL with Clover field names `amount` and `externalPaymentId`, plus required `Authorization`, `X-Clover-Merchant-Id`, `X-Clover-App-Id`, `X-Clover-Device-Id`, and `X-POS-ID` headers.
- REST and USB adapters normalize provider responses to the same POS-safe result shape.
- Returned tips can be allocated by the POS either evenly by worker or by discounted service amount percentage before checkout completion.
- Raw provider metadata strips sensitive fields recursively and case-insensitively, including variants such as `cardNumber`, `card_number`, `cvv`, `pin`, `magstripe`, `track1`, `track2`, `track3`, `emv`, `rawEmv`, `emvData`, and `pan`.

## Manual Mock CLI Tests

Run connection check:

```powershell
$env:CLOVER_TRANSPORT="mock"
corepack pnpm --filter @nail/clover-payment clover:dev status
```

Expected:

- JSON response has `connected: true`.
- `provider` is `clover`.
- `transport` is `mock`.

Run test sale:

```powershell
$env:CLOVER_TRANSPORT="mock"
corepack pnpm --filter @nail/clover-payment clover:dev test-sale 100
```

Expected:

- JSON response has `status: "approved"`.
- `baseAmountCents` is `100`.
- `totalChargedCents` equals base amount plus returned tip.
- No sensitive card data appears in output.

## Mock Clover Device Tests

Run the local mock Clover REST Pay Display device:

```powershell
corepack pnpm dev:mock-clover
```

Point the local API at it:

```powershell
$env:CLOVER_TRANSPORT="rest-local"
$env:CLOVER_DEVICE_BASE_URL="http://localhost:4100"
$env:CLOVER_DEVICE_ID="mock-clover-mini-1"
$env:CLOVER_POS_ID="owner-pos-dev"
$env:CLOVER_ACCESS_TOKEN="mock-token"
```

The mock device exposes control endpoints:

- `GET /mock/config`
- `POST /mock/config`
- `POST /mock/reset`

Use `POST /mock/config` to set `nextPaymentResult`, `nextTipAmount`, `connected`, `responseDelayMs`, card metadata, and whether sensitive test fields should be included in the Clover-shaped response.

Automated checks:

```powershell
corepack pnpm --filter @nail/mock-clover-device typecheck
corepack pnpm --filter @nail/mock-clover-device test
```

## REST Pay Display Simulation Tests

Use the mock Clover device or a local HTTP stub that exposes Clover REST Pay Display-style endpoints:

- `POST /connect/v1/device/welcome`
- `POST /connect/v1/device/read-tip`
- `POST /connect/v1/payments`
- `POST /connect/v1/device/cancel`
- `POST /connect/v1/payments/{paymentId}/refund`
- `POST /connect/v1/payments/search`

Set:

```powershell
$env:CLOVER_TRANSPORT="rest-local"
$env:CLOVER_DEVICE_BASE_URL="http://127.0.0.1:<stub-port>"
$env:CLOVER_DEVICE_ID="mini-3-test"
$env:CLOVER_POS_ID="owner-pos-test"
$env:CLOVER_ACCESS_TOKEN="test-token"
```

Validate:

- `status` reaches the stub and returns normalized connection state.
- `test-sale 100` maps the POS amount to Clover `amount` and maps the POS idempotency key to Clover `externalPaymentId`.
- Required request headers include `Authorization: Bearer test-token`, `X-Clover-Device-Id`, and `X-POS-ID`.
- Approved response with tip returns correct `baseAmountCents`, `tipCents`, and `totalChargedCents`.
- Declined/cancelled/failed responses normalize to package statuses and do not report charged totals.
- HTTP 4xx/5xx returns an actionable error.

## Cloud REST Pay Display Simulation Tests

Use a local HTTP stub representing Clover Cloud REST Pay Display, or a Clover sandbox endpoint when credentials are available.

Set:

```powershell
$env:CLOVER_TRANSPORT="rest-cloud"
$env:CLOVER_CLOUD_BASE_URL="https://<clover-cloud-rest-base>"
$env:CLOVER_MERCHANT_ID="<merchant-id>"
$env:CLOVER_APP_ID="<app-id>"
$env:CLOVER_APP_SECRET="<app-secret>"
$env:CLOVER_ACCESS_TOKEN="<merchant-access-token>"
$env:CLOVER_DEVICE_ID="<device-id>"
$env:CLOVER_POS_ID="owner-pos-test"
$env:CLOVER_REMOTE_APP_ID="<developer-id>.<app-id>"
```

Validate:

- `status` reaches the configured cloud base URL and returns normalized connection state.
- `test-sale 100` maps the POS amount to Clover `amount` and maps the POS idempotency key to Clover `externalPaymentId`.
- Required request headers include `Authorization`, `X-Clover-Merchant-Id`, `X-Clover-App-Id`, `X-Clover-Device-Id`, and `X-POS-ID`.
- The app secret is not sent to payment endpoints.
- Approved response with tip returns correct `baseAmountCents`, `tipCents`, and `totalChargedCents`.
- Declined/cancelled/failed responses normalize to package statuses and do not report charged totals.
- HTTP 4xx/5xx returns an actionable error.

## LAN WebSocket Remote Pay SDK Tests

Use Clover Secure Network Pay Display with the official `remote-pay-cloud` npm SDK.

Set:

```powershell
$env:CLOVER_TRANSPORT="ws-lan"
$env:CLOVER_REMOTE_APP_ID="com.example.nail-pos:1.0.0"
$env:CLOVER_WS_HOST="<clover-lan-ip>"
$env:CLOVER_WS_PORT="12345"
$env:CLOVER_WS_PATH="/remote_pay"
$env:CLOVER_WS_SECURE="true"
$env:CLOVER_POS_NAME="Nail Salon POS"
$env:CLOVER_SERIAL_NUMBER="owner-pos-1"
$env:CLOVER_AUTH_TOKEN="<token from first pairing, if available>"
```

Alternatively set one full URL with `$env:CLOVER_WS_URL="wss://<clover-lan-ip>:12345/remote_pay"`.

Validate:

- Config accepts both full `CLOVER_WS_URL` and separate host/port/path fields.
- Owner POS Checkout Clover settings can apply `ws-lan` host/port/path/app/POS values at runtime via `/api/terminal/config` without restarting local API.
- `/api/terminal/pair/start` initializes the `remote-pay-cloud` connector.
- First-time pairing returns a pairing code that can be entered on the Clover device.
- Pairing success produces an auth token that is stored only in local secret configuration.
- `test-sale 100` creates a Clover `SaleRequest` with `externalId` set from the POS idempotency key and `amount` set to the card base amount in cents.
- Approved/declined/cancelled responses normalize to the shared Clover payment contract.
- Recovery uses Clover `RetrievePaymentRequest` by external payment ID.
- No full card number, CVV, PIN, magstripe, or raw EMV data is stored or logged.

## USB Sidecar Simulation Tests

Use a local HTTP stub representing the future Windows USB sidecar.

Set:

```powershell
$env:CLOVER_TRANSPORT="usb-sidecar"
$env:CLOVER_USB_SIDECAR_URL="http://127.0.0.1:<stub-port>"
```

Validate:

- `status` reports `transport: "usb-sidecar"`.
- `test-sale 100` posts to `/payments`.
- Approved response with a Clover device tip normalizes the same as REST.
- Cancel, refund, and reconcile endpoints use the same normalized contract as REST.
- Sidecar connection failure is reported as a failed request and does not fabricate approval.

## Clover Mini Hardware Tests

Prerequisites:

- Clover Mini 3 is activated for the merchant.
- Correct Clover payment display app is installed and ready for the selected transport.
- Test merchant/test card path is available, or the owner approves a real low-value transaction.
- Network/USB connection is stable.
- No production secrets are committed to source.

Connection:

```powershell
corepack pnpm --filter @nail/clover-payment clover:dev status
```

Expected:

- Device reports connected.
- Device identity is visible enough to confirm the intended Mini is being used.
- No cardholder data is returned.

Approved card sale with device tip:

```powershell
corepack pnpm --filter @nail/clover-payment clover:dev test-sale 100
```

Expected:

- Clover prompts on device.
- Customer can choose tip on device.
- Result returns `status: "approved"`.
- `baseAmountCents` is `100`.
- `tipCents` equals the device-selected tip.
- `totalChargedCents` equals base plus tip.
- `providerPaymentId`, `authCode`, card brand, and last 4 are present when Clover provides them.
- No full card number, CVV, PIN, magstripe, or raw EMV data is returned.

Decline/cancel/failure:

- Run a declined test card or configured decline path.
- Cancel on the device during payment.
- Disconnect the device or sidecar before a payment attempt.

Expected:

- Decline returns `status: "declined"`.
- Cancel returns `status: "cancelled"`.
- Connection loss returns an error or `status: "failed"`.
- No failed path returns approved payment data.
- Retrying with a new idempotency key works after recovery.

Refund:

- Use a previously approved low-value payment.
- Refund the approved amount.

Expected:

- Refund returns `status: "approved"` and a provider refund reference.
- Refund failure or decline does not appear as approved.

Reconciliation:

- Run reconciliation for a time window containing the test payment.
- Run recovery for a POS payment whose Clover `externalPaymentId` is known.
- If Clover returns an order/ticket id, verify that safe order reference can also be used to associate the Clover payment with the POS sale.

Expected:

- Approved card totals match Clover for that window.
- The recovered payment matches by exact `externalPaymentId`, not by fuzzy string matching.
- Clover order/ticket references are stored only as safe metadata and can support manual or automated matching.
- Declined, cancelled, and failed attempts do not inflate totals.

## Future POS Integration Acceptance

Before wiring this package into `apps/local-api`, verify:

- The POS sends only the card base amount before Clover tip.
- Clover-returned `tipCents` is recorded from the adapter result, not from the UI.
- Single-worker card tips assign 100% of the tip to that worker.
- Multi-worker card tips require owner split confirmation before sale completion.
- A sale is not marked paid unless the backend records an approved Clover payment.
