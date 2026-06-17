# Worker PWA Phone-Friendly Tap Login Plan

## Context

The next requested change is to add a Worker PWA report tab so a logged-in worker can review their own tickets from phone or tablet. The Owner POS already has richer reports, including ticket-style sales reporting. The Worker PWA should reuse the same concepts but must remain scoped to the authenticated worker only.

Current relevant files:
- `apps/worker-pwa/src/main.tsx`
- `apps/worker-pwa/src/styles.css`
- `apps/local-api/src/routes/worker-dashboard.ts`
- `apps/local-api/src/server.ts` already registers worker dashboard routes, so adding a route in that module should not need server wiring.

Important product constraints:
- Workers can view their own service totals, tips, commission, estimated pay, and appointments.
- Workers must not view all-store sales or other workers' private earnings.
- Frontend must access data through `apps/local-api`, not the database.

## Approach

Add a protected worker-only ticket report endpoint and a new Worker PWA bottom-nav tab:

1. Add `GET /api/workers/:id/tickets` in `apps/local-api/src/routes/worker-dashboard.ts`.
2. Reuse the existing worker token access pattern from `GET /api/workers/:id/dashboard` so workers can only request their own tickets.
3. Return ticket rows filtered to sale items for the requested worker only.
4. Include worker-safe totals: ticket count, service count, service total, tips, commission, total pay.
5. Add `reports` to the Worker PWA view union and bottom navigation.
6. Build a mobile/tablet-friendly report screen with date preset chips, summary cards, ticket cards, and a ticket detail pop-out/bottom sheet.
7. Do not expose all-store payment totals, other workers' line items, refunds from unrelated items, or owner-only reports.

## Files to modify

- `apps/local-api/src/routes/worker-dashboard.ts`
  - Add protected worker ticket report route.
  - Add small local helpers for date range and worker-ticket shaping.
- `apps/worker-pwa/src/main.tsx`
  - Add report view state/nav item.
  - Add worker ticket report types.
  - Add `WorkerReportsScreen` component.
- `apps/worker-pwa/src/styles.css`
  - Add responsive report summary, filter chips, ticket cards, and pop-out styles.

## Reuse

- Reuse `verifyWorkerToken` and same ownership check from `apps/local-api/src/routes/worker-dashboard.ts`.
- Reuse existing Worker PWA `get()` HTTP helper and auth token flow.
- Reuse `formatMoney`, `formatTime`, `todayStr`, and current pop-out/bottom-sheet visual language.
- Reuse the report ticket concepts from `apps/local-api/src/routes/reports.ts` but return only worker-owned line items.

## Steps

- [ ] Add local report types for worker ticket summary, tickets, and service rows in Worker PWA.
- [ ] Add `reports` to the Worker PWA `View` type and bottom nav.
- [ ] Add `GET /api/workers/:id/tickets` with worker-token ownership enforcement.
- [ ] Implement date range support with default today and presets in UI: Today, Yesterday, 7 Days, Month.
- [ ] Render worker-safe summary cards: Tickets, Services, Service Total, Tips, Commission, Total Pay.
- [ ] Render ticket cards with customer, completed time, services, service total, tips, commission, pay.
- [ ] Add a ticket detail bottom sheet/modal showing the selected ticket's service lines.
- [ ] Add loading, empty, and error states with retry.
- [ ] Add responsive CSS for phone and tablet layouts.
- [ ] Ensure API auth failures clear stored worker session like other worker endpoints.

## Verification

- [ ] Run `corepack pnpm --filter @nail/local-api typecheck`.
- [ ] Run `corepack pnpm --filter @nail/worker-pwa typecheck`.
- [ ] Run `corepack pnpm --filter @nail/worker-pwa build`.
- [ ] Manual: log in as worker and open Reports tab.
- [ ] Manual: confirm only that worker's tickets/line items appear.
- [ ] Manual: switch date presets and refresh.
- [ ] Manual phone-size check: cards and bottom sheet fit without horizontal scrolling.
- [ ] Manual tablet-size check: summary/ticket cards use wider layout cleanly.

## Out of scope

- Owner-only all-store reports.
- Printing/exporting reports.
- Editing tickets from Worker PWA.
- Offline queuing or cached report data beyond the existing app shell.
