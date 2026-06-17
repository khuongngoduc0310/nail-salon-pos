# Deploy Plan — Worker PWA Reports Release

## Scope

Ship the Worker PWA updates plus the required Local API route:

- Worker PWA phone-friendly login and session/offline improvements.
- Worker PWA Reports tab for reviewing the logged-in worker's own tickets.
- Local API endpoint: `GET /api/workers/:id/tickets`.

No database schema migration is required for this release.

## Target deployment model

Because this POS is local-first, deploy inside the salon LAN:

```text
Worker iPhones/iPads
        |
        v
https://salon.local/worker/  or  https://192.168.1.10/worker/
        |
        v
Local Store Server
  - static Worker PWA files
  - local-api on port 4000 or reverse-proxied under /api
  - PostgreSQL
```

Recommended production shape:

- PostgreSQL runs on the local store server or LAN server.
- `apps/local-api` runs as a long-lived Node service.
- `apps/worker-pwa/dist` is served by Caddy/Nginx/Apache or another local web server.
- Use HTTPS for the Worker PWA so service worker/PWA install works reliably on phones.

## Pre-deploy checklist

- [ ] Confirm all current changes intended for release are committed or otherwise saved.
- [ ] Confirm the Local API server has access to the production/local salon PostgreSQL `DATABASE_URL`.
- [ ] Confirm workers have valid PINs. For production, do not rely on dev placeholder PINs.
- [ ] Confirm the salon LAN hostname/IP that phones will use, for example:
  - `https://salon.local`
  - `https://192.168.1.10`
- [ ] Confirm HTTPS certificate/trust strategy for iPhones/iPads.
- [ ] Confirm firewall allows phones to reach the web server and Local API/reverse proxy.

## Build steps

From repo root:

```bash
corepack pnpm install
corepack pnpm --filter @nail/local-api typecheck
corepack pnpm --filter @nail/worker-pwa typecheck
corepack pnpm --filter @nail/worker-pwa build
```

If deploying the whole workspace, also run:

```bash
corepack pnpm typecheck
corepack pnpm test
```

## Environment configuration

### Local API

Set production/local-server env values, including:

```bash
NODE_ENV=production
DATABASE_URL=postgresql://...
PORT=4000
```

Include any existing Clover/printer/local settings required by the deployed POS.

### Worker PWA

Build with the API URL phones will use.

Option A — API exposed directly on port 4000:

```bash
VITE_API_BASE_URL=https://salon.local:4000/api corepack pnpm --filter @nail/worker-pwa build
```

Option B — recommended reverse proxy under same origin:

```bash
VITE_API_BASE_URL=https://salon.local/api corepack pnpm --filter @nail/worker-pwa build
```

Same-origin reverse proxy is preferred because it avoids CORS/LAN hostname drift and makes WebSocket URL derivation cleaner.

## Reverse proxy recommendation

Serve the Worker PWA and API from the same HTTPS origin:

```text
https://salon.local/worker/  -> apps/worker-pwa/dist
https://salon.local/api/*    -> http://127.0.0.1:4000/api/*
https://salon.local/ws       -> http://127.0.0.1:4000/ws with WebSocket upgrade
```

If serving Worker PWA at `/worker/`, verify Vite base path support before building. If not configured yet, simplest first deployment is serving it at its own origin/root, such as `https://worker.salon.local/` or `https://salon.local/` for Worker PWA only.

## Deploy steps

1. Stop or drain the existing Local API service.
2. Deploy updated Local API build/source to the local server.
3. Start Local API with production env.
4. Health check:

```bash
curl https://salon.local/api/health
```

5. Build Worker PWA with the final `VITE_API_BASE_URL`.
6. Copy `apps/worker-pwa/dist/*` to the web server static directory.
7. Restart/reload web server.
8. Open Worker PWA on a phone/tablet and verify install prompt/service worker.

## Smoke tests

On a phone connected to salon Wi-Fi:

- [ ] Open Worker PWA URL.
- [ ] Confirm login loads worker tiles, not a dropdown.
- [ ] Log in with a real worker PIN.
- [ ] Refresh page and confirm 12-hour session restore.
- [ ] Open Today tab and verify dashboard data.
- [ ] Open Reports tab.
- [ ] Switch Today / Yesterday / 7 Days / Month.
- [ ] Open a ticket detail bottom sheet.
- [ ] Confirm only the logged-in worker's line items appear.
- [ ] Stop internet but keep LAN active; confirm local API/PWA still works.
- [ ] Temporarily stop Local API; confirm API disconnected banner appears.

## Rollback plan

Keep the previous deployed artifacts:

- Previous Local API release directory/container/image.
- Previous Worker PWA `dist` directory.

Rollback steps:

1. Stop current Local API.
2. Restore previous Local API artifact.
3. Restore previous Worker PWA static files.
4. Reload web server.
5. Verify login/dashboard.

No DB rollback is expected because this release does not change schema.

## Release notes

Worker-facing changes:

- Faster tap-based login on phone.
- Desktop keyboard PIN entry still supported.
- Reports tab added for worker-owned tickets.
- Ticket detail view shows service, tip, commission, and pay.

Owner/admin note:

- Workers can only view their own tickets through the authenticated worker route.
- No all-store sales data is exposed in Worker PWA.
