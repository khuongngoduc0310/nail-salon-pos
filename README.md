# Nail Salon POS — Codex Build Pack

This folder contains product and engineering documents to help Codex build a local-first nail salon POS system.

## First milestone scaffold

This repository now includes a TypeScript monorepo foundation for the first implementation milestone.

## Second milestone API foundation

The local API now has Prisma-backed route modules for the first backend CRUD surface:

- Service categories: `GET/POST/PATCH /api/service-categories`
- Services: `GET/POST/PATCH/DELETE /api/services`
- Workers: `GET/POST/PATCH /api/workers`, `PATCH /api/workers/:id/status`
- Customers: `GET/POST /api/customers`
- Appointments: `GET/POST/PATCH/DELETE /api/appointments`
- Check-ins: `GET/POST /api/checkins`, `PATCH /api/checkins/:id/status`

The app still does not implement full auth or role guards. That is the next backend milestone before exposing these operations broadly in the UI.

## Third milestone turn management

The local API now supports the core turn workflow:

- `GET /api/turns/dashboard`
- `POST /api/turns/suggest`
- `POST /api/turns/assign`
- `POST /api/turns/:id/start`
- `POST /api/turns/:id/complete`
- `POST /api/turns/:id/skip`

Turn counts are based on `startedAt`, not assignment. Assignment, start, complete, and skip actions update related worker and check-in records inside database transactions. The owner POS shell also reads the turn dashboard and waiting check-ins from the local API when it is running.

## Fourth milestone checkout MVP

The local API now supports checkout basics:

- `POST /api/sales`
- `POST /api/sales/:id/items`
- `PATCH /api/sales/:id/items/:itemId`
- `POST /api/sales/:id/discounts`
- `POST /api/sales/:id/payments/cash`
- `POST /api/sales/:id/payments/gift-card`
- `POST /api/sales/:id/payments/card/start`
- `POST /api/sales/:id/complete`

Sale items snapshot service name, category, price, worker, commission rate, commission amount, worker total, and business share. Cash and gift-card payments are recorded as approved payments. Mock card payments use the payment terminal adapter and only approved card payments count toward sale completion. Completing a sale requires approved payments to cover the total and marks the related check-in as paid.

### Workspace layout

```text
apps/
  owner-pos        React + Vite owner POS shell
  worker-pwa       React + Vite worker PWA shell
  customer-pwa     React + Vite customer PWA shell
  local-api        Fastify local API
packages/
  shared           Domain logic and tests
  db               Prisma schema, migration, and seed
  payment-terminal Payment terminal interface and mock adapter
  receipt-printer  Receipt printer interface and mock adapter
```

### Local startup

Create a local environment file:

```powershell
Copy-Item .env.example .env
```

Install dependencies:

```powershell
corepack pnpm install
```

Start local PostgreSQL:

```powershell
docker compose up -d postgres
```

Run the database migration and seed data:

```powershell
corepack pnpm db:migrate
corepack pnpm db:seed
```

Run tests:

```powershell
corepack pnpm test
```

Start the local API and app shells:

```powershell
corepack pnpm dev
```

Default local URLs:

- Owner POS: `http://localhost:5173`
- Worker PWA: `http://localhost:5174`
- Customer PWA: `http://localhost:5175`
- Local API health: `http://localhost:4000/api/health`

Owner POS opens directly to the floor view. Secure areas and actions use the seeded dev owner PIN: `1234`.

Owner POS dev-server troubleshooting:

- Start only the owner POS with `corepack pnpm dev:owner`.
- Verify `http://localhost:5173` returns `200`.
- If the browser logs `client:1035 WebSocket connection ... failed`, the owner dev server is not running or port `5173` is blocked.
- The API WebSocket is separate and uses `ws://localhost:4000/ws`.

## Business context

The system is for a single-store nail salon. It needs a local POS that works in the store even when the internet is down, while still supporting online appointments and remote worker/customer access through cloud sync.

## Primary apps

1. **Owner POS app** — web app usable from Windows or iPad.
2. **Worker app** — PWA for iPhone workers; no App Store required.
3. **Customer booking/check-in website** — mobile-friendly website/PWA.
4. **Local store server** — backend API, local database, printer service, Clover integration, sync service.
5. **Cloud service** — online appointments, backup, remote access, queued SMS/email receipt delivery.

## Payment terminal

The salon has a **Clover Mini**. Use Clover as the payment terminal, not as the main salon system of record.

Recommended integration: **Clover REST Pay Display API** with a local network connection where possible.

Key Clover docs:

- REST Pay Display introduction: https://docs.clover.com/dev/docs/rest-pay-intro
- Local connection: https://docs.clover.com/dev/docs/configuring-a-local-connection
- Connect POS to Clover device: https://docs.clover.com/dev/docs/rest-pay-connection
- Test merchants sandbox: https://docs.clover.com/dev/docs/use-test-merchants-dashboard
- Test card numbers: https://docs.clover.com/dev/docs/test-card-numbers
- Test REST Pay flows: https://docs.clover.com/dev/docs/testing-rest-pay-flows-us

## How to use with Codex

Start by giving Codex this instruction:

```text
Read this repository. Treat docs/PRODUCT_REQUIREMENTS.md, docs/ARCHITECTURE.md, db/SCHEMA.sql, api/API_SPEC.md, workflows/*.md, and tests/TEST_PLAN.md as source-of-truth. Build the system incrementally. Start with the local backend, database schema, owner POS web app, and worker/customer PWA shells. Do not implement Clover live payments until the mock payment adapter and test flows pass.
```

## Suggested implementation order

1. Database schema and migrations.
2. Local backend API.
3. Auth and role-based permissions.
4. Services/categories management.
5. Worker management and commission rates.
6. Customer check-in queue.
7. Turn dashboard and manual worker assignment.
8. Checkout with cash/mock card/gift-card split payments.
9. Reports.
10. Receipt printing adapter.
11. Worker PWA.
12. Customer booking/check-in PWA.
13. Clover Mini integration adapter.
14. Cloud sync.

## Non-negotiable rules

- Never store full card number, CVV, PIN, magstripe data, or raw EMV data.
- Store Clover payment references only.
- Worker commission must use a snapshot at checkout time.
- Tips belong 100% to the worker.
- Owner decides worker assignment; POS only suggests.
- Turn count increases when service starts, not when a customer merely checks in.
- Local POS must continue to operate for in-store workflows when internet is down.
