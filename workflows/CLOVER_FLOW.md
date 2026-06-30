# Clover Mini Flow

## Role of Clover

Clover Mini is the card terminal. The salon POS is the system of record for services, workers, turns, commissions, tips, receipts, and reports.

## Recommended integration

Use the local API as the only Clover integration point. Production card-present payments should use Clover's official `remote-pay-cloud` npm SDK through Cloud Pay Display (`ws-cloud`) with manually configured merchant/app/token/device values. LAN Secure Network Pay Display (`ws-lan`) and Cloud REST Pay Display (`rest-cloud`) remain fallback options. This keeps Owner POS behind the local API and avoids direct browser-to-Clover payment handling. REST-local remains a fallback/test transport.

Useful docs:

- REST Pay Display introduction: https://docs.clover.com/dev/docs/rest-pay-intro
- Configure local connection: https://docs.clover.com/dev/docs/configuring-a-local-connection
- Connect POS app to device: https://docs.clover.com/dev/docs/rest-pay-connection
- Testing REST Pay flows: https://docs.clover.com/dev/docs/testing-rest-pay-flows-us

## Development strategy

Implement `PaymentTerminalAdapter` first with a mock adapter. Remote Pay Cloud card-present payments use `@nail/clover-payment` with `CLOVER_TRANSPORT=ws-cloud`, `CLOVER_REMOTE_APP_ID`, `CLOVER_DEVICE_ID`, `CLOVER_MERCHANT_ID`, `CLOVER_ACCESS_TOKEN`, `CLOVER_CLOUD_SERVER`, and `CLOVER_FRIENDLY_ID`. Cloud REST card-present fallback uses `CLOVER_TRANSPORT=rest-cloud`, `CLOVER_CLOUD_BASE_URL`, `CLOVER_ACCESS_TOKEN`, `CLOVER_DEVICE_ID`, and `CLOVER_POS_ID`; `CLOVER_MERCHANT_ID`, `CLOVER_APP_ID`, and `CLOVER_REMOTE_APP_ID` can be supplied as optional configured context. LAN card-present payments use `CLOVER_TRANSPORT=ws-lan`, `CLOVER_REMOTE_APP_ID`, either `CLOVER_WS_URL=wss://<clover-lan-address>:12345/remote_pay` or separate `CLOVER_WS_HOST`, `CLOVER_WS_PORT`, and `CLOVER_WS_PATH`, `CLOVER_POS_NAME`, `CLOVER_SERIAL_NUMBER`, and the first-pairing `CLOVER_AUTH_TOKEN` once available. The Clover Developer Dashboard app should select only the modules/permissions needed for card-present payments, refunds, and payment lookup/reconciliation; Clover modules are not assigned by POS runtime code.

For local end-to-end development, run `apps/mock-clover-device`. It exposes Clover-shaped REST Pay Display endpoints under `/connect` so checkout can exercise the same `rest-local` adapter path used for a real Clover Mini.

Owner POS Checkout also includes a Clover connection settings panel. The owner can choose mock, Remote Pay Cloud, Cloud REST Pay Display, REST-local/mock Clover, or real Clover LAN WebSocket, enter required connection details, save/apply, then pay without restarting the local API. OAuth/install token exchange is not part of the first Cloud/REST versions; credentials are manually provisioned.

## Sale flow

1. POS calculates card amount without prefilled sale-item tips.
2. POS creates payment row with status `pending` and idempotency key.
3. POS sends the payment through the configured Clover adapter using the payment idempotency key as Clover `externalId`/`externalPaymentId`. Where supported by the transport/mock, the POS sale/ticket id is also carried as safe order/ticket metadata so recovery can match by Clover order id as well as by external payment id.
4. If on-device pre-payment tipping is enabled, POS first calls the Clover read-tip flow with `baseAmount`, then charges the returned total.
5. Customer taps/inserts/swipes.
6. Clover returns result, including the approved card amount and any terminal tip.
7. POS updates payment row:
   - `approved`
   - `declined`
   - `cancelled`
   - `failed`
8. POS stores Clover payment ID/reference when approved, including safe Clover sale/order ID when the adapter returns it.
9. Owner can view safe Clover matching references in the Payments report: POS ticket ID, Clover sale/order ID, Clover payment ID, auth code, brand, and last 4. If Clover batch review shows a mismatch, owner may correct only the safe reference IDs/auth code with a reason; amounts, tips, status, and card data are not editable through that correction.
10. If Clover returned a tip, Owner POS prompts the owner to allocate it either evenly between workers or by discounted service amount percentage. Even worker splits are automatically distributed across that worker's services by discounted service amount percentage.
11. Sale completes only if total paid is enough after allocated tips are included.

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
- Recovery matching by exact Clover `externalPaymentId` first, then provider payment id, and by Clover order/ticket id when a safe provider order reference is available.
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
- Provider sale/order ID.
- Card brand.
- Last 4.
- Auth/reference code.
- Amount.
- Tip.
- Status.
