# API Spec — v1 Draft

Base URL local:

```text
http://salon.local/api
```

## Auth

### POST /auth/login

Request:

```json
{
  "emailOrPhone": "owner@example.com",
  "passwordOrPin": "1234"
}
```

Response:

```json
{
  "token": "jwt-or-session-token",
  "user": { "id": "uuid", "name": "Owner", "role": "owner" }
}
```

### POST /auth/logout

Ends session.

## Services

### GET /service-categories

Returns active categories with services.

### POST /service-categories

Owner only.

### PATCH /service-categories/:id

Owner only.

### GET /services

Query:

- `active=true|false`
- `categoryId=uuid`

### POST /services

Owner only.

### PATCH /services/:id

Owner only.

### DELETE /services/:id

Soft-delete or deactivate only.

## Workers

### GET /workers

Owner sees all. Worker sees self only.

### POST /workers

Owner only.

Request includes worker profile fields, commission rate, and a required 4-6 digit `pin` for Worker PWA login.

### PATCH /workers/:id

Owner only. May include `pin` to replace the worker's login PIN; omit `pin` to keep the existing PIN.

### PATCH /workers/:id/status

Owner or the worker themselves can update own availability status if allowed.

Request:

```json
{ "status": "available" }
```

### GET /workers/:id/dashboard

Worker sees own dashboard. Owner can view any worker.

Response includes:

```json
{
  "workerId": "uuid",
  "status": "available",
  "turnsTakenToday": 3,
  "activeTurn": null,
  "serviceSalesTodayCents": 24000,
  "tipsTodayCents": 4500,
  "commissionTodayCents": 14400,
  "totalPayTodayCents": 18900,
  "appointmentsToday": []
}
```

## Sessions

### POST /sessions/current/worker-checkin

Clock a worker into the current open salon session. If the worker already has a session row and previously clocked out, this reopens that row by clearing `checkedOutAt`.

Request:

```json
{ "workerId": "uuid" }
```

Response:

```json
{
  "id": "uuid",
  "workerId": "uuid",
  "name": "Amy",
  "checkedInAt": "2026-05-12T09:15:00.000Z",
  "checkedOutAt": null
}
```

### POST /sessions/current/worker-clockout

Clock a worker out of the current open salon session. Fails if the worker has an active assigned or in-service turn in the current session.

Request:

```json
{ "workerId": "uuid" }
```

Response uses the same worker-session shape as worker check-in, with `checkedOutAt` populated.

### GET /sessions/current/workers

Returns current-session worker clock records, including both actively clocked-in and clocked-out workers.

## Customers and check-in

### POST /customers

Create customer.
Phone is required and normalized to E.164-style (`+15551234567`).

## Customer auth (phone-first)

### POST /customer/auth/start

Simple customer login/sign-up with phone identity.

Request:

```json
{
  "phone": "(555) 123-4567",
  "name": "Mary"
}
```

Response:

```json
{
  "customer": {
    "id": "uuid",
    "name": "Mary",
    "phone": "+15551234567"
  },
  "token": "customer-session-token",
  "expiresAt": "2026-05-25T21:00:00.000Z"
}
```

### GET /customer/me

Returns authenticated customer profile.

### GET /customer/me/appointments

Returns authenticated customer's appointments.

### POST /customer/me/appointments

Creates appointment for authenticated customer.

### GET /customer/me/checkins

Returns authenticated customer's check-ins.

### POST /customer/me/checkins

Creates walk-in or appointment check-in for authenticated customer.

### POST /checkins

Create walk-in or appointment check-in.

Request:

```json
{
  "customer": { "name": "Mary", "phone": "5551234567" },
  "appointmentId": null,
  "requestedWorkerId": null,
  "notes": "Walk-in pedicure"
}
```

### GET /checkins

Query:

- `status=waiting`
- `date=YYYY-MM-DD`

### PATCH /checkins/:id/status

Owner only for most statuses.

## Appointments

### POST /appointments

Owner, worker for self, or customer.

### GET /appointments

Query:

- `workerId`
- `customerId`
- `start`
- `end`
- `status`

### PATCH /appointments/:id

Owner or owning worker.

### DELETE /appointments/:id

Soft-cancel appointment.

## Turns

### GET /turns/dashboard

Owner only.

Response:

```json
{
  "workers": [
    {
      "workerId": "uuid",
      "name": "Amy",
      "status": "available",
      "turnsTakenToday": 3,
      "lastTurnEndedAt": "2026-05-12T13:20:00-05:00",
      "activeTurn": null,
      "salesTodayCents": 24000,
      "tipsTodayCents": 4500,
      "suggestionRank": 1,
      "checkedIn": true
    }
  ]
}
```

### POST /turns/suggest

Returns suggested workers for a check-in. Only workers clocked into the current open salon session and not clocked out are eligible for suggestions.

### POST /turns/assign

Owner assigns customer to worker.

Request:

```json
{
  "checkinId": "uuid",
  "workerId": "uuid",
  "turnType": "walk_in",
  "suggestedWorkerId": "uuid-or-null",
  "ownerOverrideReason": "optional"
}
```

### POST /turns/:id/start

Starts service and increments turn count by creating `started_at`.

### POST /turns/:id/complete

Completes service.

### POST /turns/:id/skip

Marks skipped.

## Sales and checkout

### POST /sales

Create sale from check-in/appointment.

### POST /sales/:id/items

Add service item assigned to worker. Checkout may assign sale items to an existing worker for correct commission and later tip attribution; it does not require the worker to be currently clocked in or otherwise available for turn assignment. Use `serviceId` for catalog services, or omit `serviceId` and provide `serviceName` plus `priceCents` for a one-time custom checkout service that is not added to the service catalog. Do not include or prefill `tipCents` when adding sale items; tips are determined by the Clover/payment-terminal flow after the sale is sent for payment.

### PATCH /sales/:id/items/:itemId

Edit worker, price, or discount before sale completion. Do not edit sale-item tips before payment.

### POST /sales/:id/discounts

Owner only.

### POST /sales/:id/payments/cash

Records cash payment.

### POST /sales/:id/payments/gift-card

Redeems gift card.

### POST /sales/:id/payments/card

Creates a backend `pending` card payment, starts card payment through the configured terminal adapter, then updates the payment from the terminal result. `/sales/:id/payments/card/start` remains as a backwards-compatible alias.

Request:

```json
{
  "amountCents": 6000,
  "idempotencyKey": "uuid"
}
```

`idempotencyKey` is optional; the API generates one when omitted.

Response:

```json
{
  "payment": {
    "id": "uuid",
    "status": "approved",
    "amountCents": 7000,
    "tipCents": 1000
  },
  "sale": {},
  "terminalStatus": "approved"
}
```

`amountCents` is the approved terminal charge including any Clover-returned tip. The POS sends the pre-tip card amount to Clover and does not prefill the tip.

### POST /payments/:paymentId/reconcile

Reconciles a pending/uncertain card payment through the configured terminal adapter. If the terminal confirms an approved payment matching the stored provider reference or idempotency key, the backend updates the payment to `approved` and recomputes the sale. If no approved terminal payment is found, the sale remains unpaid or partially paid.

### POST /sales/:id/payments/card/callback

Internal endpoint for terminal adapter to update payment result.

### POST /sales/:id/tips/allocate

Allocates an approved Clover-returned card tip to sale items for worker/service reporting. Required before completing a sale when a card payment has an unallocated returned tip.

Request:

```json
{
  "paymentId": "uuid",
  "splitMode": "even_workers"
}
```

`splitMode` may be `even_workers` or `service_amount_percentage`. `service_amount_percentage` distributes the tip across all active sale items by discounted service amount. `even_workers` gives each worker an equal share and automatically divides each worker's share across that worker's services by discounted service amount percentage.

### POST /sales/:id/complete

Completes sale only if `amount_paid_cents >= total_cents`.

### POST /sales/:id/refunds

Records a refund against a paid sale. Card refunds call the configured payment terminal adapter when the payment has a provider reference. Cash and gift-card refunds are recorded locally.

Request:

```json
{
  "paymentId": "uuid-optional",
  "amountCents": 12000,
  "reason": "Customer refund",
  "approvedByUserId": "uuid-optional"
}
```

Response:

```json
{
  "refund": { "id": "uuid", "saleId": "uuid", "amountCents": 12000 },
  "sale": { "id": "uuid", "status": "refunded" },
  "terminalRefund": null
}
```

The API rejects refunds for unpaid sales and rejects amounts above the approved payment total minus existing refunds.

## Receipts

### POST /sales/:id/receipts/print

Prints custom salon receipt.

### POST /sales/:id/receipts/sms

Queues SMS receipt.

### POST /sales/:id/receipts/email

Queues email receipt.

## Reports

All reports accept:

- `start=ISO_DATE_TIME`
- `end=ISO_DATE_TIME`

### GET /reports/sales

### GET /reports/workers

### GET /reports/turns

### GET /reports/payments

### GET /reports/refunds

### GET /reports/discounts

## Clover configuration

### GET /terminal/config

Returns safe current terminal configuration for the Checkout tab. Secret fields such as Clover access tokens, app secrets, and auth tokens are not returned in full; response only includes configured flags and masked previews.

### PATCH /terminal/config

Applies terminal configuration from the Checkout tab and rebuilds the active local API terminal adapter without restarting the API.

Supported fields include:

- `transport`: `mock`, `ws-lan`, `rest-cloud`, `rest-local`, or `usb-sidecar`
- `wsHost`, `wsPort`, `wsPath`, `wsSecure` for real Clover LAN WebSocket
- `remoteApplicationId`, `posName`, `serialNumber`, optional `authToken`
- `cloudBaseUrl`, `merchantId`, `appId`, `deviceId`, `posId`, optional `remoteApplicationId`, `accessToken`, and `appSecret` for Clover Cloud REST Pay Display
- `deviceBaseUrl`, `deviceId`, `posId`, optional `accessToken` for REST-local/mock Clover

Blank `accessToken`, `appSecret`, or `authToken` updates preserve any existing local secret. Clover OAuth/install flow is not exposed by this endpoint; tokens are manually provisioned for the first Cloud REST version.

Returns `{ config, status }`.

### GET /terminal/status

Returns configured payment terminal status. For Clover LAN pairing this may include `pairingRequired` and `pairingCode`; the pairing code must be entered on the Clover device and the returned auth token must remain local/secret.

### POST /terminal/pair/start

Starts or resumes Clover LAN pairing/connection through the configured `remote-pay-cloud` adapter. Returns the same shape as `/terminal/status`.

### GET /terminal/pair/status

Returns current Clover LAN pairing/connection state.

### POST /terminal/verify-connection

Owner only.

### POST /terminal/cancel-current-action

Owner only.
