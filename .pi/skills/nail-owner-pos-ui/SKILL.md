---
name: nail-owner-pos-ui
description: Build or modify the React + Vite owner POS UI. Use for owner workflows, checkout screens, reports, worker/service management, API client changes, styles, or state-driven view changes in apps/owner-pos.
---

# Nail Owner POS UI

Use this skill when working in `apps/owner-pos`.

## Read first

- `docs/PRODUCT_REQUIREMENTS.md` for owner permissions and workflows.
- Relevant `workflows/*.md` file.
- `api/API_SPEC.md` and `packages/shared/src/api.ts` for backend contracts.
- Existing files: `apps/owner-pos/src/main.tsx`, `apps/owner-pos/src/api.ts`, `apps/owner-pos/src/components.tsx`, `apps/owner-pos/src/styles.css`.

## UI rules

- React + Vite only; do not add Next.js, SSR, or a routing library.
- Use React state for view switching and follow existing local component patterns.
- Use `import.meta.env.VITE_API_BASE_URL` for API base URL configuration.
- Frontend never accesses the database directly.
- Prefer shared contracts/utilities from `@nail/shared`.
- Keep owner workflows fast for repeated in-store use.
- Do not silently assign workers; owner must confirm assignment.
- Do not display checkout as paid based only on local UI state. Reflect backend-created approved `Payment` records.
- Do not persist UI-only statuses like `cancelled` if Prisma/shared enums use different values.

## API client rules

- Add or update functions in `apps/owner-pos/src/api.ts` when endpoints change.
- Keep request/response shapes aligned with `api/API_SPEC.md` and shared API types.
- Surface API errors clearly; avoid hiding failed payment/checkout writes.

## Verification

```bash
corepack pnpm --filter @nail/owner-pos typecheck
```

For behavior covered by tests, run focused Vitest files, for example:

```bash
corepack pnpm test -- apps/owner-pos/src/workerForm.test.ts apps/owner-pos/src/reportTarget.test.ts
```
