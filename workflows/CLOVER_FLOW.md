# Clover Mini Flow

## Role of Clover

Clover Mini is the card terminal. The salon POS is the system of record for services, workers, turns, commissions, tips, receipts, and reports.

## Recommended integration

Use Clover REST Pay Display API.

Useful docs:

- REST Pay Display introduction: https://docs.clover.com/dev/docs/rest-pay-intro
- Configure local connection: https://docs.clover.com/dev/docs/configuring-a-local-connection
- Connect POS app to device: https://docs.clover.com/dev/docs/rest-pay-connection
- Testing REST Pay flows: https://docs.clover.com/dev/docs/testing-rest-pay-flows-us

## Development strategy

Implement `PaymentTerminalAdapter` first with a mock adapter. Then implement `CloverRestPayDisplayAdapter`.

## Sale flow

1. POS calculates card amount.
2. POS creates payment row with status `pending` and idempotency key.
3. POS sends payment request to Clover Mini.
4. Clover Mini prompts customer.
5. Customer taps/inserts/swipes.
6. Clover returns result.
7. POS updates payment row:
   - `approved`
   - `declined`
   - `cancelled`
   - `failed`
8. POS stores Clover payment ID/reference when approved.
9. Sale completes only if total paid is enough.

## Split payments

Only send card portion to Clover.

Example:

```text
Sale total: $120
Cash: $40
Gift card: $20
Card: $60
```

Send `$60` to Clover.

## Itemized services

The POS owns itemized salon receipt. Clover may show/display order details depending on API support, but do not depend on Clover to be the source of truth for services, workers, or commissions.

## Recovery and reconciliation

Must handle:

- Duplicate payment prevention using idempotency keys.
- POS timeout while Clover succeeds.
- Clover decline.
- Clover cancellation.
- Connection loss.
- End-of-day comparison between POS card total and Clover card total.

## Do not store

- Full card number.
- CVV.
- PIN.
- Raw EMV data.
- Magstripe data.

Store only safe metadata:

- Provider payment ID.
- Card brand.
- Last 4.
- Auth/reference code.
- Amount.
- Tip.
- Status.
