# Checkout Flow

## Normal service sale

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
12. Customer pays by cash, gift card, card, or split payment. Clover/payment-terminal flow determines any card tip after the sale is sent for payment.
13. If an approved card payment includes a Clover-returned tip, Owner POS shows a pop-up to allocate the tip either evenly between workers or by discounted service amount percentage. Even worker splits are automatically divided across each worker's services by discounted service amount percentage.
14. POS marks sale paid when fully paid.
14. POS prints custom salon receipt.
15. Check-in status becomes `paid`.

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

## Completion guard

A sale can only be completed when:

```text
amount_paid_cents >= total_cents
```

If overpaid with cash, calculate change due. Do not store change as revenue.
