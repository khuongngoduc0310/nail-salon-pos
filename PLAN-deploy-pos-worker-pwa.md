# Deploy Plan — Owner POS + Worker PWA

## Scope

Deploy the in-store production setup for:

- Owner POS web app: `apps/owner-pos`
- Worker PWA: `apps/worker-pwa`
- Local API required by both apps: `apps/local-api`
- Local PostgreSQL database

This plan is for a local-first single-store deployment on the salon LAN. Clover remains only the payment terminal; the POS/local API remains the system of record.

## Target topology

Recommended salon LAN topology:

```text
Owner Windows/iPad browser
Worker iPhones/iPads PWA
        |
        v
https://salon.local
        |
        +-- /pos/      -> Owner POS static app
        +-- /worker/   -> Worker PWA static app
        +-- /api/*     -> Local API reverse proxy
        +-- /ws        -> Local API WebSocket reverse proxy
        |
        v
Local Store Server
        +-- Node local-api
        +-- PostgreSQL
        +-- Clover/printer adapters as configured
```

Use one stable LAN address, preferably `https://salon.local`, or a reserved static IP such as `https://192.168.1.10`.

## Server prerequisites

- [ ] Local server has stable LAN IP or hostname.
- [ ] PostgreSQL is installed/running or available through Docker Compose.
- [ ] Node/Corepack/pnpm are installed for build/runtime, or CI produces build artifacts.
- [ ] HTTPS certificate is installed/trusted by owner and worker devices.
- [ ] Firewall allows LAN devices to reach HTTPS web server.
- [ ] Firewall allows local API internally, or reverse proxy can reach `127.0.0.1:4000`.
- [ ] Clover/printer LAN access is configured if those features are used.

## Environment strategy

Prefer serving both frontends and the API from the same HTTPS origin:

```text
VITE_API_BASE_URL=https://salon.local/api
```

This avoids CORS problems and keeps Worker PWA WebSocket derivation consistent.

Local API environment example:

```bash
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://USER:PASSWORD@127.0.0.1:5432/nail_pos
```

Add existing payment-terminal/printer variables as needed. Do not commit secrets, Clover tokens, database URLs, or device credentials.

## Build commands

From repository root:

```bash
corepack pnpm install
corepack pnpm --filter @nail/local-api typecheck
corepack pnpm --filter @nail/owner-pos typecheck
corepack pnpm --filter @nail/worker-pwa typecheck
```

Build frontends with production API URL:

```bash
VITE_API_BASE_URL=https://salon.local/api corepack pnpm --filter @nail/owner-pos build
VITE_API_BASE_URL=https://salon.local/api corepack pnpm --filter @nail/worker-pwa build
```

Recommended final validation before release:

```bash
corepack pnpm typecheck
corepack pnpm test
```

## Database deploy

- [ ] Back up current PostgreSQL database.
- [ ] Confirm `DATABASE_URL` points to the salon production/local database.
- [ ] Run migrations if there are pending DB changes:

```bash
corepack pnpm db:migrate
```

- [ ] Seed only if this is a new installation:

```bash
corepack pnpm db:seed
```

Do not reseed an existing live salon database unless intentionally updating seed-safe values.

## Static app hosting

Copy built apps to the web server:

```text
apps/owner-pos/dist   -> /var/www/nail-pos/pos
apps/worker-pwa/dist  -> /var/www/nail-pos/worker
```

Important: if serving Vite apps under `/pos/` and `/worker/`, confirm each app is built with the correct base path. If base paths are not configured yet, the safest deployment is separate hostnames or root paths, for example:

```text
https://pos.salon.local/      -> owner-pos dist
https://worker.salon.local/   -> worker-pwa dist
https://api.salon.local/api   -> local-api
```

If using one hostname with subpaths, add Vite `base` config or build-time base support before final deployment.

## Reverse proxy routing

Recommended routing:

```text
/pos/*      -> Owner POS static files, fallback to /pos/index.html
/worker/*   -> Worker PWA static files, fallback to /worker/index.html
/api/*      -> http://127.0.0.1:4000/api/*
/ws         -> http://127.0.0.1:4000/ws with WebSocket upgrade
```

Worker PWA service workers are scope-sensitive. Verify that `/worker/manifest.webmanifest`, icons, and service worker paths are correct for the chosen hosting path.

## Local API service

Run `apps/local-api` as a long-lived service using the team's preferred process manager, for example:

- Windows service
- systemd service
- Docker container
- PM2

Deploy steps:

1. Stop current local API service.
2. Deploy updated source/build artifact.
3. Install production dependencies if needed.
4. Start local API with production env.
5. Verify health:

```bash
curl https://salon.local/api/health
```

## Device setup

Owner POS:

- [ ] Open Owner POS URL on owner Windows/iPad device.
- [ ] Pin/bookmark it for daily use.
- [ ] Verify owner PIN-protected areas.
- [ ] Verify Clover/printer settings if configured.

Worker PWA:

- [ ] Open Worker PWA URL on each worker iPhone/iPad.
- [ ] Install to Home Screen.
- [ ] Confirm manifest/icon/service worker install correctly.
- [ ] Log in as a worker and verify session restore after refresh.

## Smoke test checklist

### API and database

- [ ] `GET /api/health` returns OK.
- [ ] Workers load in Owner POS and Worker PWA.
- [ ] Services load in Owner POS checkout/service management.
- [ ] Current salon session/check-in flows work.

### Owner POS

- [ ] Dashboard opens.
- [ ] Check-in queue loads.
- [ ] Worker turn dashboard loads.
- [ ] Owner can assign a worker manually.
- [ ] Start/complete service updates state.
- [ ] Checkout creates/updates sale through backend.
- [ ] Cash/mock/card flow records approved backend `Payment` before paid state.
- [ ] Reports screen loads.
- [ ] Worker/service management protected by owner PIN.

### Worker PWA

- [ ] Phone-friendly tap login loads worker tiles.
- [ ] PIN login works with real worker PIN.
- [ ] Desktop keyboard PIN input works if opened on desktop/tablet keyboard.
- [ ] Today tab shows worker status, active turn, sales/tips/pay.
- [ ] Appointments tab loads worker appointments.
- [ ] Earnings tab shows worker-only totals.
- [ ] Reports tab shows worker-only tickets.
- [ ] Ticket detail bottom sheet works on phone.
- [ ] API disconnected banner appears if local API is stopped.

### Local-first behavior

- [ ] Disconnect internet while keeping LAN/server running.
- [ ] Owner POS still reaches local API.
- [ ] Worker PWA still reaches local API.
- [ ] In-store workflows continue without cloud access.

## Rollback plan

Keep prior known-good artifacts:

```text
previous owner-pos dist
previous worker-pwa dist
previous local-api artifact/source
latest database backup
```

Rollback steps:

1. Stop local API.
2. Restore previous local API artifact.
3. Restore previous Owner POS static files.
4. Restore previous Worker PWA static files.
5. Reload/restart web server.
6. Start local API.
7. Run smoke tests.

Only restore database backup if a migration or data-writing release caused data issues. Do not roll back live sales data casually.

## Release notes for salon staff

Owner POS:

- Continue using Owner POS as the source of truth for check-ins, turns, checkout, payments, receipts, and reports.

Worker PWA:

- Workers log in by tapping their name and entering PIN.
- Worker app can be installed to the phone Home Screen.
- Workers can view their own dashboard, appointments, earnings, and ticket reports.

## Known deployment decisions to confirm

- [ ] Single hostname with subpaths vs separate hostnames.
- [ ] HTTPS certificate approach for iOS devices.
- [ ] Process manager for `apps/local-api`.
- [ ] PostgreSQL backup schedule.
- [ ] Whether Owner POS and Worker PWA should be accessible only on salon Wi-Fi.
