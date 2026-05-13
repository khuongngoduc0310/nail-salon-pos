# Implementation Plan

## Phase 0 — Project setup

- Choose stack.
- Create monorepo.
- Add linting, formatting, tests.
- Add environment config.
- Add Docker Compose for local Postgres.

Recommended stack:

- Frontend: Next.js or React + Vite.
- Backend: Node.js/NestJS or FastAPI.
- Database: PostgreSQL.
- ORM: Prisma/Drizzle/SQLAlchemy.
- Mobile worker app: PWA.

## Phase 1 — Database and backend foundation

Build:

- Users.
- Roles.
- Workers.
- Customers.
- Service categories.
- Services.
- Audit logs.

Include seed data:

- Owner account.
- 3 workers.
- Example service categories and services.

## Phase 2 — Auth and permissions

Build:

- Owner login.
- Worker login.
- Customer appointment access token or phone verification placeholder.
- Role-based route guards.

Security:

- Password/PIN hashing.
- Session expiration.
- Audit sensitive actions.

## Phase 3 — Owner service management

Build:

- Create/edit/disable service categories.
- Create/edit/disable services.
- Sort categories/services.

## Phase 4 — Worker management

Build:

- Add/edit/disable worker.
- Set commission rate.
- Set status: available, in service, break, off today.

## Phase 5 — Check-in and appointment MVP

Build:

- Create customer.
- Walk-in check-in.
- Appointment creation.
- Queue dashboard.
- Status changes.

## Phase 6 — Turn management

Build:

- Suggested worker logic.
- Manual owner assignment.
- Start service.
- Complete service.
- Skip turn.
- Turn dashboard.

## Phase 7 — Checkout MVP

Build:

- Create sale from check-in/appointment.
- Add services/workers.
- Discounts.
- Tips.
- Cash payment.
- Mock card payment.
- Gift-card payment placeholder.
- Split payments.
- Mark sale paid only when full amount is collected.

## Phase 8 — Reports

Build:

- Date/time range sales report.
- Worker earnings report.
- Turn report.
- Refund/discount report.
- Payment method report.

## Phase 9 — Receipts

Build:

- Receipt document generator.
- Mock print.
- ESC/POS printer adapter.
- Reprint receipt.
- SMS/email queue placeholder.

## Phase 10 — Clover Mini integration

Build after mock payment flows are stable.

- Clover config screen.
- Verify Clover connection.
- Start payment for card amount only.
- Store Clover payment ID/reference.
- Handle approved/declined/cancelled/timeouts.
- Reconciliation/recovery screen.
- Refund path.

## Phase 11 — PWAs

Build:

- Worker PWA.
- Customer booking/check-in PWA.
- Add manifest and install prompts.

## Phase 12 — Cloud sync

Build:

- Sync event queue.
- Online appointment sync.
- Backup.
- Conflict review screen.
