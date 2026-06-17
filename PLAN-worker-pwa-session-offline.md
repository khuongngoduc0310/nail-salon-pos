# Worker PWA Session Persistence + Offline/API Status Plan

## Context

The Worker PWA currently keeps the authenticated worker and token only in React state in `apps/worker-pwa/src/main.tsx`. A page refresh returns the worker to login, and network/API failures are mostly silent. The app is also PWA-oriented, but `apps/worker-pwa/public/manifest.webmanifest` has no icons and there is no service worker registration/cached app shell yet.

Goal: make the Worker PWA more usable day-to-day by preserving a logged-in session across refreshes and clearly showing when the device/API connection is offline, while staying lightweight and local-first.

Notes from initial scan:
- Worker app is a single-file React/Vite app with state-based views, per project convention.
- API base is configured by `VITE_API_BASE_URL` with `http://localhost:4000/api` fallback.
- WebSocket currently hardcodes `location.hostname:4000/ws`, which can drift from the configured API base.
- There are no existing service worker utilities in worker/customer apps.
- There are many unrelated modified files in the worktree; implementation should avoid touching them.

## Approach

Use timed browser session persistence and lightweight connectivity state without adding new dependencies:

1. Store the worker token, worker id, and `expiresAt` timestamp after successful login, with a 12-hour client-side TTL.
2. On app startup, restore the session by validating `expiresAt` locally and fetching `/workers/:id/dashboard` with the stored token.
3. If the saved session is expired or restore fails with auth errors, clear the stored session and show login.
4. Add a visible connection banner for browser offline state and API/WebSocket disconnected state.
5. Fix WebSocket URL derivation so it follows `VITE_API_BASE_URL` instead of assuming `:4000` on the page host.
6. Add a logout action to clear session state and storage.
7. Add minimal PWA app-shell support: manifest icons plus service worker registration/caching for built static assets only. Do not queue Start Service, Complete Service, or status-change writes offline in this pass.

## Files to modify

- `apps/worker-pwa/src/main.tsx`
- `apps/worker-pwa/src/styles.css`
- `apps/worker-pwa/public/manifest.webmanifest`
- `apps/worker-pwa/src/worker-sw.ts` or equivalent TypeScript service worker source
- `apps/worker-pwa/vite.config.ts` if needed to emit the service worker as a root static asset
- Possibly `apps/worker-pwa/public/*.svg` for lightweight app icons

## Reuse

- Reuse existing `get`, `post`, `patch`, `buildHeaders` helpers in `apps/worker-pwa/src/main.tsx`.
- Reuse existing CSS variables and mobile shell classes in `apps/worker-pwa/src/styles.css`.
- Reuse the current dashboard API endpoint: `GET /workers/:id/dashboard`.
- Reuse the current auth endpoint: `POST /auth/worker-login`.
- Follow existing project guidance from `AGENTS.md` and `prompts/CODEX_RULES.md`: React + Vite, state-based navigation, no routing library, lightweight PWA.

## Steps

- [ ] Add a named `WORKER_SESSION_TTL_MS = 12 * 60 * 60 * 1000` constant and use `localStorage` with an explicit `expiresAt` value.
- [ ] Add storage constants and helper functions for saving/loading/clearing `{ workerId, token, expiresAt }`.
- [ ] Add initial app boot state (`restoringSession`) that attempts dashboard refresh from stored, unexpired credentials before showing login.
- [ ] Update login success to save credentials and worker state.
- [ ] Add logout button/action that clears React state and storage.
- [ ] Add connection status state based on `navigator.onLine`, failed API calls, and WebSocket open/close events.
- [ ] Derive WebSocket URL from `VITE_API_BASE_URL` so local LAN deployments work consistently.
- [ ] Add non-blocking offline/API-disconnected banner styles.
- [ ] Add service worker registration in the Worker PWA entrypoint.
- [ ] Add a TypeScript service worker that caches the app shell and serves cached static assets while offline; configure Vite emission if required.
- [ ] Add manifest icons using small local SVG/PNG assets and update manifest metadata as needed.

## Verification

- [ ] Run `corepack pnpm --filter @nail/worker-pwa typecheck`.
- [ ] Run `corepack pnpm --filter @nail/worker-pwa build`.
- [ ] Manual: log in, refresh the page, confirm dashboard restores without entering PIN again.
- [ ] Manual: click logout, refresh, confirm login screen appears.
- [ ] Manual: stop or disconnect the local API, confirm a clear connection warning appears and the app shell remains usable.
- [ ] Manual: try Start Service/Complete/Status actions while API is disconnected, confirm they fail visibly and are not queued.
- [ ] Manual: restore API, confirm WebSocket/API status recovers and dashboard refresh works.
- [ ] Manual: inspect installability in browser devtools; confirm manifest has icons and service worker is registered.

## Decisions

- Session persistence: timed expiry using persistent browser storage plus an `expiresAt` timestamp.
- Timeout: 12 hours after PIN login.
- Offline scope: status-only in this first pass; cache the app shell and show connectivity warnings, but do not queue worker actions.
- Backend scope: no API token-expiry change in this first pass; enforce the 12-hour timeout in the Worker PWA and clear expired saved credentials before API use.
