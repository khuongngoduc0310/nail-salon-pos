---
name: nail-shared-domain
description: Implement or review shared nail salon POS business logic. Use for turn rotation/counting, sales totals, commission/tips, money formatting, API types, websocket contracts, or logic used by both API and frontends.
---

# Nail Shared Domain

Use this skill when changing `packages/shared` or any business rule that should be consistent across API and UI.

## Read first

- `prompts/CODEX_RULES.md`
- `docs/PRODUCT_REQUIREMENTS.md`
- Relevant workflow doc, especially `workflows/TURN_FLOW.md` or `workflows/CHECKOUT_FLOW.md`
- Existing files in `packages/shared/src/`

## Placement rules

Put reusable logic in `packages/shared/src` and export it from `packages/shared/src/index.ts`.

Common homes:

- `turns.ts` — turn count, ranking, suggested workers, effective turns.
- `sales.ts` — sale totals, discounts, taxes if any, paid/balance logic.
- `money.ts` — cents formatting/parsing helpers.
- `api.ts` — API request/response types shared with frontends.
- `ws-client.ts` — websocket/event contracts.

## Business rules to preserve

- Turn count increases when service starts; assignment alone does not increase turn count unless the shared documented effective-turn function says active assigned turns are counted for queue visibility.
- Round-robin suggestion ranks by `lastTurnEndedAt`, not fewest turns first.
- `calculateTurnCount(priceCents, threshold, serviceTurnCount)` handles service override first, then price threshold.
- Owner may manually toggle turn count between 0 and 1.
- Tips belong 100% to worker.
- Commission is calculated from snapshotted commission rate, not live worker data.
- Keep tunable values as named constants; no magic business numbers.
- Use cents; avoid floats for persisted monetary values.

## Verification

```bash
corepack pnpm --filter @nail/shared typecheck
corepack pnpm test -- packages/shared/src/domain.test.ts
```

If frontends/API consume changed exports, run their typechecks too.
