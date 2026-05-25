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

### PATCH /workers/:id

Owner only.

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
      "suggestionRank": 1
    }
  ]
}
```

### POST /turns/suggest

Returns suggested workers for a check-in.

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

Add service item assigned to worker.

### PATCH /sales/:id/items/:itemId

Edit worker, price, discount, or tip before sale completion.

### POST /sales/:id/discounts

Owner only.

### POST /sales/:id/payments/cash

Records cash payment.

### POST /sales/:id/payments/gift-card

Redeems gift card.

### POST /sales/:id/payments/card/start

Starts card payment through configured terminal adapter.

Request:

```json
{
  "amountCents": 6000,
  "tipCents": 1000,
  "idempotencyKey": "uuid"
}
```

Response:

```json
{
  "paymentId": "uuid",
  "status": "pending",
  "terminalStatus": "awaiting_customer"
}
```

### POST /sales/:id/payments/card/callback

Internal endpoint for terminal adapter to update payment result.

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

### GET /settings/clover

Owner only.

### PATCH /settings/clover

Owner only.

### POST /terminal/verify-connection

Owner only.

### POST /terminal/cancel-current-action

Owner only.
