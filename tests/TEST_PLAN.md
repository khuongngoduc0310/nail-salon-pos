# Test Plan

## Testing priorities

The highest-risk areas are:

1. Money totals.
2. Worker commission.
3. Tips.
4. Split payments.
5. Refunds.
6. Clover payment status.
7. Offline behavior.
8. Reports.
9. Permissions.

## Unit tests

### Commission calculation

Input:

```json
{
  "servicePriceCents": 5000,
  "discountCents": 500,
  "commissionRate": 0.60,
  "tipCents": 1000
}
```

Expected:

```json
{
  "finalServiceCents": 4500,
  "workerCommissionCents": 2700,
  "workerTotalCents": 3700,
  "businessCents": 1800
}
```

### Turn count

- Assigned turn does not count.
- In-service turn counts.
- Completed turn counts.
- Skipped turn does not count unless it previously started.

### Sale completion

- Sale cannot complete if underpaid.
- Sale can complete if exact paid.
- Cash overpayment produces change due.

## Integration tests

### Checkout cash

- Create customer.
- Check in.
- Assign worker.
- Start service.
- Complete service.
- Create sale.
- Add service item.
- Add tip.
- Pay cash.
- Complete sale.
- Verify reports.

### Split payment

Total: $120.

Payments:

- Gift card: $20.
- Cash: $40.
- Mock card: $60.

Expected:

- Sale paid.
- Three payment rows.
- Reports show each method.

### Mock card decline

Expected:

- Payment status declined.
- Sale remains unpaid.
- Retry allowed.

### Refund

Expected:

- Refund row created.
- Payment/sale status updated appropriately.
- Reports subtract refund.

## Permission tests

### Worker forbidden actions

Worker must not be able to:

- See owner reports.
- Checkout.
- Refund.
- Edit service prices.
- Edit other worker appointment.

Test by direct API calls, not only UI.

## Offline tests

Disconnect internet while keeping LAN running.

Expected working:

- Owner login if locally cached/session valid.
- Check-in.
- Worker dashboard.
- Cash checkout.
- Local reports.
- Receipt printing.
- Sync queue creation.

Expected queued:

- SMS receipt.
- Email receipt.
- Cloud sync.

## Clover tests

Use Clover sandbox/test merchant and test cards where possible.

Required cases:

- Approved payment.
- Declined payment.
- Cancelled payment.
- Timeout/connection loss.
- Duplicate prevention using idempotency key.
- Refund.
- End-of-day reconciliation.

## Report tests

Create known sales dataset and verify:

- Date/time filtering.
- Sales totals.
- Discounts.
- Refunds.
- Tips.
- Worker commission.
- Payment method breakdown.

## Launch checklist

```text
[ ] Owner can log in
[ ] Worker can log in
[ ] Customer can check in
[ ] Owner can create/edit services
[ ] Owner can assign worker
[ ] Worker status becomes In Service
[ ] Turn count increases only when service starts
[ ] Checkout totals are correct
[ ] Tips go 100% to worker
[ ] Commission uses worker-specific snapshot
[ ] Split payment works
[ ] Mock card approved/declined/cancelled flows work
[ ] Clover card payment works
[ ] Clover decline does not mark sale paid
[ ] Cash payment works
[ ] Gift card payment works
[ ] Receipt prints
[ ] Refund records correctly
[ ] Discount records correctly
[ ] Worker report matches manual math
[ ] Owner sales report matches manual math
[ ] Internet-down cash checkout works
[ ] Sync queue works
[ ] Worker cannot access owner reports
[ ] Customer cannot see other customers
```
