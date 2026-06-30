# Architecture — Local-First Nail Salon POS

## Summary

The system is local-first with optional cloud sync.

```text
Owner POS Web App
Worker PWA
Customer Website/PWA
        |
        v
Local Store Server  <---- sync ---->  Cloud Server
        |
        +---- Local PostgreSQL
        +---- Receipt Printer Adapter
        +---- Clover Mini Adapter
```

## Local store server

Responsibilities:

- Auth and role checks.
- Service/category management.
- Worker management and commission rates.
- Check-in queue.
- Turn management.
- Sales/checkout.
- Payments table.
- Reports.
- Receipt printing.
- Clover adapter.
- Sync queue.

Implementation organization:

- Fastify route registration lives in `apps/local-api/src/routes`.
- Larger route groups such as checkout are split into subdirectories by workflow area: item edits, payments, tip allocation, adjustments, and completion.
- Shared route helpers and report adjustment overlays live next to the route group until they are broadly reusable enough for `packages/shared`.
- Owner POS screen code is organized under `apps/owner-pos/src/screens`, with app-level view switching in `apps/owner-pos/src/app`.

Local server should be available at a stable LAN address such as:

```text
http://salon.local
```

or

```text
http://192.168.1.10
```

## Cloud server

Responsibilities:

- Online customer appointments.
- Remote worker access when not on store Wi-Fi.
- Backup.
- SMS/email receipt delivery.
- Sync relay.

## Offline behavior

When internet is down:

- Local store server remains the source of truth.
- Local database continues to accept writes.
- Sync events are queued.
- SMS/email tasks are queued.
- Online appointments created in cloud sync later.

## Conflict policy

For version 1:

- Local salon schedule wins.
- Cloud conflicts require owner review.
- Never silently overwrite local appointment/sale data.

## Payment architecture

Use Clover Mini as card terminal.

POS owns:

- Services.
- Workers.
- Appointments.
- Turns.
- Sales.
- Tips.
- Discounts.
- Commission.
- Reports.
- Full salon receipt.

Clover owns:

- Card capture.
- Card approval/decline.
- Card security.
- Payment reference/auth result.

## Clover adapter

Implement payment integration through an interface so development can start without real Clover dependency.

```ts
interface PaymentTerminalAdapter {
  verifyConnection(): Promise<TerminalConnectionStatus>;
  startSale(input: TerminalSaleRequest): Promise<TerminalPaymentResult>;
  cancelCurrentAction(): Promise<void>;
  refund(input: TerminalRefundRequest): Promise<TerminalRefundResult>;
  reconcile(input: ReconciliationRequest): Promise<ReconciliationResult>;
}
```

Adapters:

Additional real Clover transport: `CloverRemotePayLanAdapter` also supports Clover Remote Pay Cloud SDK through the `ws-cloud` transport with manually configured merchant/app/token/device values.

1. `MockTerminalAdapter` — local dev/testing.
2. `CloverRemotePayLanAdapter` / `ws-cloud` transport — production path using Clover's official `remote-pay-cloud` npm SDK with Cloud Pay Display through Clover servers.
3. `CloverRemotePayLanAdapter` / `ws-lan` transport — production path using Clover's official `remote-pay-cloud` npm SDK with Secure Network Pay Display over the store LAN WebSocket connection.
4. `CloverRestPayDisplayAdapter` / `rest-local` transport — HTTP REST Pay Display fallback/local test path.
5. `CloverCloudPayDisplayAdapter` / `rest-cloud` transport — HTTP Cloud REST Pay Display fallback when approved REST credentials are available.

For LAN WebSocket pairing, configure the local API with the Clover device endpoint, for example:

```text
CLOVER_TRANSPORT=ws-lan
CLOVER_REMOTE_APP_ID=com.example.nail-pos:1.0.0
CLOVER_WS_HOST=192.168.1.20
CLOVER_WS_PORT=12345
CLOVER_WS_PATH=/remote_pay
CLOVER_WS_SECURE=true
CLOVER_POS_NAME=Nail Salon POS
CLOVER_SERIAL_NUMBER=owner-pos-1
CLOVER_AUTH_TOKEN=
CLOVER_PAYMENT_TIMEOUT_MS=120000
```

You can also use `CLOVER_WS_URL=wss://192.168.1.20:12345/remote_pay` instead of separate host/port/path fields. These values can be supplied at startup through environment variables or applied at runtime from the Owner POS Checkout tab's Clover connection settings panel. On first connection, `/api/terminal/pair/start` initializes the SDK connector and may return a pairing code. Enter that code on the Clover device. When Clover returns an auth token, keep it local/secret and reuse it as `CLOVER_AUTH_TOKEN`; never commit it. The local API owns the `remote-pay-cloud` WebSocket session; Owner POS only calls local API payment routes.

For Clover Remote Pay Cloud SDK, configure the local API with manual Clover credentials and endpoint values:

```text
CLOVER_TRANSPORT=ws-cloud
CLOVER_REMOTE_APP_ID=RQ07XH5Z3EX44.BT1G67W0JJFVC
CLOVER_DEVICE_ID=C035UT24950367
CLOVER_MERCHANT_ID=HDSPNPKW4VXZ1
CLOVER_ACCESS_TOKEN=<merchant-oauth-access-token>
CLOVER_CLOUD_SERVER=https://api.clover.com
CLOVER_FRIENDLY_ID=TL Nails And Spa 625
CLOVER_PAYMENT_TIMEOUT_MS=120000
```

The `remote-pay-cloud` SDK builds the websocket connection internally from the Clover server, merchant ID, device ID, and token. Do not call Clover directly from Owner POS.

For Clover Cloud REST Pay Display fallback, configure the local API with manual Clover credentials and endpoint values:

```text
CLOVER_TRANSPORT=rest-cloud
CLOVER_CLOUD_BASE_URL=https://api.clover.com/connect
CLOVER_ACCESS_TOKEN=<merchant-oauth-access-token>
CLOVER_DEVICE_ID=<clover-device-id>
CLOVER_POS_ID=owner-pos
CLOVER_MERCHANT_ID=<merchant-id>        # optional context
CLOVER_APP_ID=<cloud-or-remote-app-id>  # optional context
CLOVER_REMOTE_APP_ID=<remote-app-id>    # optional context
CLOVER_PAYMENT_TIMEOUT_MS=120000
```

The first Cloud REST version consumes already-provisioned credentials; it does not implement Clover OAuth/install token exchange. Secrets must remain in local environment/runtime configuration and are only returned to Owner POS as masked previews. Owner POS can show connection status by asking the local API to call the Clover Cloud REST Pay Display device ping endpoint. The Clover Mini must have Cloud Pay Display installed, open, and started.

### Tip-on-terminal flow

Tips are always entered by the customer on the Clover Mini, never pre-set by the POS.

```
TerminalSaleRequest  →  amountCents (base, no tip)
TerminalPaymentResult ←  amountCents + tipCents (both returned after approval)
```

Step-by-step:

1. POS sends `amountCents` = balance due (cash/gift card already deducted) to the terminal. No tip is sent.
2. Clover Mini displays the total and prompts the customer for a tip.
3. Customer selects or enters a tip on the Clover screen.
4. Clover approves the full charge and returns `tipCents` in `TerminalPaymentResult`.
5. The API stores `payment.amountCents = base + tip` (so sale completion math works correctly) and `tipCents` separately for reporting.
6. `tipCents` is returned to the POS in the card payment response.
7. The POS opens a tip distribution screen. The auto-split is proportional to each worker's net service amount on the order.
8. The owner can adjust per-worker tip amounts via on-screen numpad. Adjusting one worker rebalances the others automatically; the total always stays locked to the terminal-approved tip.
9. Owner confirms → `POST /api/sales/:id/tip-distribution` updates each sale item's `tipCents` and recomputes `tipTotalCents` on the sale.
10. Sale total now equals `amountPaidCents`, and Complete Sale becomes available.

The `MockTerminalAdapter` simulates an 18% tip for local development.

## Clover facts to respect

Clover REST Pay Display supports Clover Flex and Clover Mini and allows POS apps to accept payments on those devices. It supports local and cloud connection options. A local connection uses an embedded server within REST Pay Display on the Clover device to broker messages between POS and device.

Clover app module availability is configured in the Clover Developer Dashboard, not by POS runtime code. Select only the Clover modules/permissions required for card-present payments, refunds, and payment lookup/reconciliation. Do not depend on Clover Items, Inventory, Employees, Customers, Discounts, or Orders as the POS system of record unless that scope is explicitly approved.

Use docs in README for implementation details.

## Receipt architecture

Use a receipt adapter:

```ts
interface ReceiptPrinterAdapter {
  printReceipt(receipt: ReceiptDocument): Promise<PrintResult>;
  openCashDrawer?(): Promise<void>;
}
```

Adapters:

1. `MockReceiptPrinterAdapter`.
2. `EscPosPrinterAdapter`.
3. Optional `BrowserPrintAdapter`.

## PWA architecture

The worker app and customer app should be mobile-first PWAs.

Worker PWA:

- `/worker/dashboard`
- `/worker/appointments`
- `/worker/earnings`

Customer PWA:

- `/book`
- `/check-in`
- `/appointment/:id`

Owner POS:

- `/pos`
- `/pos/checkins`
- `/pos/turns`
- `/pos/checkout/:checkinId`
- `/admin/services`
- `/admin/workers`
- `/reports`
