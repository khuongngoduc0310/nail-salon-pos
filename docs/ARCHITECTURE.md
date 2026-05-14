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
2. `CloverRestPayDisplayAdapter` — Clover Mini production integration.

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
