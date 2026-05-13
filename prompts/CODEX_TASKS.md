# Codex Task Breakdown

## Task 1 — Scaffold repository

Create a monorepo with:

```text
/apps/owner-pos
/apps/worker-pwa
/apps/customer-pwa
/apps/local-api
/packages/shared
/packages/db
/packages/payment-terminal
/packages/receipt-printer
```

## Task 2 — Database migration

Convert `db/SCHEMA.sql` into migration files.

## Task 3 — Domain tests

Implement and test:

- Commission calculation.
- Turn count rules.
- Sale total calculation.
- Split payment completion rule.

## Task 4 — Backend CRUD

Implement:

- Services.
- Categories.
- Workers.
- Customers.
- Appointments.
- Check-ins.

## Task 5 — Turn dashboard

Implement:

- Worker status.
- Suggested worker ranking.
- Manual assignment.
- Start/complete/skip service.

## Task 6 — Checkout

Implement:

- Sale creation.
- Sale items.
- Discounts.
- Tips.
- Cash payment.
- Gift-card placeholder.
- Mock card payment.
- Sale completion.

## Task 7 — Reports

Implement:

- Sales report.
- Worker earnings report.
- Turn report.
- Payment report.
- Refund/discount report.

## Task 8 — Receipt generator

Implement printable receipt document and mock printer.

## Task 9 — Clover adapter

Implement after mock terminal tests pass.

## Task 10 — Cloud sync placeholder

Implement sync event queue, but defer full cloud sync until core POS is stable.
