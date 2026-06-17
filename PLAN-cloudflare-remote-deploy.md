# Cloudflare Remote Deploy Plan — Owner POS + Worker PWA

## Goal

Allow Owner POS and Worker PWA to be accessed from anywhere with internet, while the system remains local-first inside the salon.

Remote access should use **Cloudflare Tunnel**, not router port forwarding.

## Recommended architecture

```text
Owner / Worker device
        |
        v
Cloudflare HTTPS domain
        |
        v
Cloudflare Tunnel
        |
        v
Mini PC at salon
        |
        +-- Owner POS static app
        +-- Worker PWA static app
        +-- Local API
        +-- PostgreSQL
```

The mini PC remains the source of truth. PostgreSQL stays local. Clover/printer integrations stay local.

## Important caveat

Remote access requires:

- salon internet online
- mini PC powered on
- Cloudflare Tunnel running
- Local API running
- PostgreSQL running

If internet is down:

- remote public URLs will not work
- in-store LAN access can still work if configured locally

## Recommended domain setup

Use separate subdomains because they are easier to secure:

```text
pos.yourdomain.com      -> Owner POS
worker.yourdomain.com   -> Worker PWA
```

Both route through Cloudflare Tunnel to the mini PC.

## Security requirement

Enable **Cloudflare Access**.

Do not expose Owner POS publicly without Access protection.

Suggested Access rules:

```text
pos.yourdomain.com
  allow only owner email/account

worker.yourdomain.com
  allow worker/staff emails or staff group
```

The Worker PWA still uses worker PIN login after Cloudflare Access. Cloudflare Access protects the public website; the app PIN protects worker identity inside the POS.

## Mini PC services

Run these on the mini PC:

- PostgreSQL
- `apps/local-api` on `localhost:4000`
- static server/reverse proxy, e.g. Caddy or Nginx
- `cloudflared` tunnel service

Recommended local routing on the mini PC:

```text
localhost:8080/pos      -> apps/owner-pos/dist
localhost:8080/worker   -> apps/worker-pwa/dist
localhost:8080/api      -> http://localhost:4000/api
localhost:8080/ws       -> http://localhost:4000/ws
```

Then Cloudflare Tunnel exposes:

```text
https://app.yourdomain.com -> http://localhost:8080
```

Alternative, cleaner subdomain routing:

```text
pos.yourdomain.com      -> http://localhost:8081
worker.yourdomain.com   -> http://localhost:8082
api.yourdomain.com      -> http://localhost:4000
```

But if exposing `api.yourdomain.com`, protect it carefully and ensure CORS/Access rules are correct.

## Preferred simple setup

Use one reverse proxy on the mini PC:

```text
https://app.yourdomain.com/pos
https://app.yourdomain.com/worker
https://app.yourdomain.com/api
https://app.yourdomain.com/ws
```

Build both frontends with:

```bash
VITE_API_BASE_URL=https://app.yourdomain.com/api
```

Commands:

```bash
VITE_API_BASE_URL=https://app.yourdomain.com/api corepack pnpm --filter @nail/owner-pos build
VITE_API_BASE_URL=https://app.yourdomain.com/api corepack pnpm --filter @nail/worker-pwa build
```

Note: if serving apps under `/pos` and `/worker`, verify Vite `base` path support. If not configured, use separate hostnames or serve one app per root domain.

## Cloudflare Tunnel example

Example `cloudflared` config:

```yaml
tunnel: nail-salon-pos
credentials-file: C:\cloudflared\nail-salon-pos.json

ingress:
  - hostname: app.yourdomain.com
    service: http://localhost:8080
  - service: http_status:404
```

For separate subdomains:

```yaml
tunnel: nail-salon-pos
credentials-file: C:\cloudflared\nail-salon-pos.json

ingress:
  - hostname: pos.yourdomain.com
    service: http://localhost:8081
  - hostname: worker.yourdomain.com
    service: http://localhost:8082
  - hostname: api.yourdomain.com
    service: http://localhost:4000
  - service: http_status:404
```

## Deployment steps

1. Buy or assign a domain in Cloudflare.
2. Install `cloudflared` on the mini PC.
3. Create a tunnel:

```bash
cloudflared tunnel create nail-salon-pos
```

4. Create DNS routes:

```bash
cloudflared tunnel route dns nail-salon-pos app.yourdomain.com
```

or for subdomains:

```bash
cloudflared tunnel route dns nail-salon-pos pos.yourdomain.com
cloudflared tunnel route dns nail-salon-pos worker.yourdomain.com
cloudflared tunnel route dns nail-salon-pos api.yourdomain.com
```

5. Configure local reverse proxy.
6. Build Owner POS and Worker PWA with production `VITE_API_BASE_URL`.
7. Copy `dist` outputs to static hosting directories.
8. Start/restart Local API.
9. Start `cloudflared` as a service.
10. Enable Cloudflare Access rules.
11. Run smoke tests.

## Smoke tests

Remote tests from outside salon Wi-Fi:

- [ ] Open Owner POS public URL.
- [ ] Confirm Cloudflare Access blocks unauthorized users.
- [ ] Sign in through Cloudflare Access as owner.
- [ ] Confirm Owner POS loads API data.
- [ ] Open Worker PWA public URL.
- [ ] Confirm Cloudflare Access blocks unauthorized users.
- [ ] Sign in through Cloudflare Access as staff.
- [ ] Tap worker name and log in with PIN.
- [ ] Confirm Today tab loads.
- [ ] Confirm Appointments tab loads.
- [ ] Confirm Earnings tab loads.
- [ ] Confirm Reports tab loads worker-only tickets.
- [ ] Confirm WebSocket/live update behavior works.

Local-first tests inside salon:

- [ ] Access local LAN URL directly if configured.
- [ ] Disconnect internet but keep Wi-Fi/LAN running.
- [ ] Confirm local Owner POS still reaches local API.
- [ ] Confirm local Worker PWA still reaches local API.

## Cheapest path

Cheapest secure remote setup:

```text
Used mini PC: one-time cost
Cloudflare Tunnel: free
Cloudflare Access: free tier if user count fits
PostgreSQL: local/free
Domain: ~$10–15/year
```

Avoid router port forwarding. Cloudflare Tunnel is safer and usually free.

## Rollback

Keep previous deployed artifacts:

- previous Owner POS `dist`
- previous Worker PWA `dist`
- previous Local API release
- latest PostgreSQL backup

Rollback steps:

1. Stop Local API.
2. Restore previous Local API artifact.
3. Restore previous static app files.
4. Restart reverse proxy.
5. Restart Local API.
6. Confirm Cloudflare Tunnel still routes.
7. Run remote and local smoke tests.

## Final recommendation

Use Cloudflare Tunnel with Cloudflare Access:

```text
pos.yourdomain.com      -> owner only
worker.yourdomain.com   -> staff only
```

Keep a local LAN fallback URL for in-store use during internet outages.
