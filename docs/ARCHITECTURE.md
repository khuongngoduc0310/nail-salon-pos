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

1. `MockTerminalAdapter` — local dev/testing.
2. `CloverRemotePayLanAdapter` / `ws-lan` transport — production path using Clover's official `remote-pay-cloud` npm SDK with Secure Network Pay Display over the store LAN WebSocket connection.
3. `CloverRestPayDisplayAdapter` / `rest-local` transport — HTTP REST Pay Display fallback/local test path.

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
