# Checkout Flow

## Normal service sale

A manual ticket may start directly from the Floor page's Manual Ticket action when the owner needs immediate checkout without a customer check-in. In that case, the flow starts at selecting workers/services in checkout and the sale is not linked to a check-in.

1. Customer checks in.
2. Owner selects customer from queue.
3. Owner selects catalog services or creates a one-time custom checkout service with a specific price.
4. POS suggests workers.
5. Owner chooses worker(s).
6. Owner starts turn/service.
7. Turn status becomes `in_service`.
8. Worker's turn count increases for reporting.
9. Worker completes service.
10. Owner opens checkout.
11. POS calculates subtotal, discounts, and pre-tip total; no tip is determined or prefilled when sale items are added.
12. Before completion, owner may edit the sale ticket to add services, void active service items, change the assigned worker, or adjust item price/discount. The POS recalculates totals and worker commission snapshots. Tips are not editable here. Completed, paid, refunded, or voided tickets require refund/adjustment workflows instead of direct item edits.
13. Customer pays by cash, gift card, card, or split payment. Clover/payment-terminal flow determines any card tip after the sale is sent for payment.
14. If an approved card payment includes a Clover-returned tip, Owner POS shows a pop-up to allocate the tip either evenly between workers or by discounted service amount percentage. Even worker splits are automatically divided across each worker's services by discounted service amount percentage.
15. POS marks sale paid when fully paid.
16. POS prints custom salon receipt.
17. Check-in status becomes `paid`.

## Split payment

Example total: $120.

1. Gift card payment: $20.
2. Cash payment: $40.
3. Clover card payment: $60 before tip. If Clover returns a tip, the approved card payment includes the card amount plus returned tip, and the tip is allocated before checkout completion.
4. Sale is paid when paid total reaches the sale total including allocated tips.

Only $60 should be sent to Clover.

## Declined card payment

1. POS starts Clover payment.
2. Clover returns declined.
3. Payment row status becomes `declined`.
4. Sale remains unpaid or partially paid.
5. Owner can retry card or choose another payment method.

## Cancelled payment

1. Owner/customer cancels on Clover.
2. Payment row status becomes `cancelled`.
3. Sale remains unpaid or partially paid.

## Connection uncertainty

If Clover connection is lost after payment is initiated:

1. Do not mark sale paid immediately.
2. Run payment recovery/reconciliation using idempotency key/provider reference.
3. If Clover confirms approved, mark approved.
4. If no approved payment exists, keep unpaid and allow retry.

## Manual Clover recovery for missing POS capture

If the customer already paid on Clover but the POS did not capture the ticket at the time:

1. Create or open a POS ticket and add the actual services/workers.
2. Record any cash or gift-card portions through the normal cash/gift-card payment flows.
3. Use Recover Clover Card Payment for only the Clover-approved card portion.
4. Enter the Clover-approved total card amount, the tip portion if any, at least one safe Clover reference, a reason, and owner PIN.
5. If the recovered Clover payment includes a tip, allocate the tip with the normal tip allocation flow before completing the sale.
6. Complete the sale only after approved payments cover the sale total including allocated tips.

Never enter full card number, CVV, PIN, magstripe data, raw EMV, or sensitive card data during recovery.

## Finished ticket adjustments

Finished/paid tickets are locked from normal checkout editing. If the owner needs to correct a wrong worker or service label after payment:

1. Owner opens Reports → Sales and views the ticket.
2. Owner chooses Adjust Ticket or Adjust on a service line.
3. Owner selects worker correction, service label correction, or note.
4. Owner enters a reason and owner PIN.
5. POS records a `SaleAdjustment` audit row and reports apply the correction overlay.

The original sale item and payment rows remain traceable. Payment amount, status, tips, and Clover references are not changed by ticket adjustments; use refund/payment-reference flows as appropriate.

## Completion guard

A sale can only be completed when:

```text
amount_paid_cents >= total_cents
```

If overpaid with cash, calculate change due. Do not store change as revenue.
