# Local API route layout

- Keep route URLs and response shapes stable when splitting modules.
- Small CRUD areas may stay as a single `*.ts` route file.
- Larger workflows should use a subdirectory with one registration function per route group.
- Put route-only helpers next to their route group, for example `checkout/checkout-helpers.ts`.
- Move reusable non-UI business logic to `packages/shared` when multiple route groups or apps need it.
- Run `corepack pnpm --filter @nail/local-api typecheck` after each route extraction.
