# Reports

All reports must accept date/time range filters.

## Sales report

Inputs:

- `start`
- `end`
- Optional worker filter.
- Optional payment method filter.

Outputs:

- Gross service sales.
- Discounts.
- Refunds.
- Net service sales.
- Tips.
- Tax if enabled later.
- Total collected.
- Cash total.
- Card total.
- Gift card total.

## Worker earnings report

Outputs per worker:

- Service count.
- Net service sales.
- Commission rate snapshots used.
- Commission earned.
- Tips earned.
- Total worker pay.
- Refunded/voided items.

Formula:

```text
worker_total_pay = worker_commission + tips
```

## Turn report

Outputs:

- Turns taken.
- Skipped turns.
- Completed turns.
- Appointment turns.
- Walk-in turns.
- Average service duration.
- Last turn time.

## Payment report

Outputs:

- Cash total.
- Card total.
- Gift card total.
- Other total.
- Clover totals by provider payment status.

## Refund report

Outputs:

- Refund amount.
- Refund reason.
- Approved by.
- Original sale.
- Payment method.
- Timestamp.

## Discount report

Outputs:

- Discount amount.
- Discount reason.
- Approved by.
- Sale/item.
- Timestamp.

## End-of-day report

Must show:

- Gross sales.
- Net sales.
- Discounts.
- Refunds.
- Tips.
- Worker commission payout.
- Business share.
- Payment breakdown.
- Clover card total.
- Difference between POS card total and Clover card total.
