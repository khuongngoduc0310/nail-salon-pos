# Plan: Flexible Clover LAN WebSocket Configuration

## Context

The real Clover LAN WebSocket integration currently expects a full `CLOVER_WS_URL` such as `wss://192.168.1.20:12345/remote_pay`. The user wants a more flexible option to configure the Clover LAN WebSocket server/host and port separately, so setup does not require hand-building the full WebSocket URL.

## Approach

Keep the existing full URL configuration as the highest-priority override, and add host/port/path-based configuration for convenience:

- Existing supported form:
  - `CLOVER_WS_URL=wss://192.168.1.20:12345/remote_pay`
  - or `CLOVER_ENDPOINT=...`
- New supported form:
  - `CLOVER_WS_HOST=192.168.1.20`
  - `CLOVER_WS_PORT=12345`
  - `CLOVER_WS_PATH=/remote_pay` optional, default `/remote_pay`
  - `CLOVER_WS_SECURE=true|false` optional, default `true`

Build the effective `wsUrl` in `loadCloverPaymentConfig()` so the existing `CloverRemotePayLanAdapter` can continue using `config.wsUrl` without larger adapter changes.

## Files to modify

- `packages/clover-payment/src/index.ts`
- `packages/clover-payment/src/index.test.ts`
- `docs/ARCHITECTURE.md`
- `workflows/CLOVER_FLOW.md`
- `tests/CLOVER_PAYMENT_TEST_PLAN.md`

## Reuse

- Reuse existing env parsing helpers in `packages/clover-payment/src/index.ts`:
  - `trimOptional()`
  - `parseOptionalPositiveInteger()`
  - `requireConfig()`
  - `requireConfigValue()`
- Reuse existing `ws-lan` adapter path; do not change Owner POS or local API payment flow.

## Steps

- [ ] Add optional `wsHost`, `wsPort`, `wsPath`, and `wsSecure` fields to `CloverPaymentConfig` for visibility/debugging.
- [ ] Add helper `resolveWsUrl(env)`:
  - return `CLOVER_WS_URL` if set
  - else return `CLOVER_ENDPOINT` if set
  - else build URL from `CLOVER_WS_HOST` / `CLOVER_WS_SERVER` / `CLOVER_LAN_HOST`
  - use `CLOVER_WS_PORT` / `CLOVER_LAN_PORT` if supplied
  - default path to `/remote_pay`
  - default protocol to `wss`, or `ws` when `CLOVER_WS_SECURE=false`
- [ ] Update `validateCloverPaymentConfig()` error text to mention host/port option.
- [ ] Add config tests:
  - full URL still wins
  - host + port builds `wss://host:port/remote_pay`
  - host + custom path builds correctly
  - secure false builds `ws://...`
- [ ] Update docs with CMD examples for real Clover.

## Verification

Run:

```cmd
corepack pnpm --filter @nail/clover-payment typecheck
corepack pnpm --filter @nail/clover-payment test
```

Manual real-Clover CMD example after implementation:

```cmd
set CLOVER_TRANSPORT=ws-lan
set CLOVER_WS_HOST=192.168.1.20
set CLOVER_WS_PORT=12345
set CLOVER_WS_PATH=/remote_pay
set CLOVER_REMOTE_APP_ID=com.example.nail-pos:1.0.0
set CLOVER_POS_NAME=Nail Salon POS
set CLOVER_SERIAL_NUMBER=owner-pos-1
corepack pnpm dev:api
```
