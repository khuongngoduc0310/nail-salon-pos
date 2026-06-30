# Owner POS source layout

- `main.tsx` only mounts React.
- `app/` contains the app shell and top-level view switching.
- `screens/` contains screen-specific components, helpers, types, and CSS.
- `api.ts` remains the boundary for all backend calls; screen code should not fetch the API directly or access the database.
- Keep reusable UI primitives in `components.tsx` unless a component is only used by one screen.
- Keep UI-only formatting in the screen/app layer; move reusable business logic to `packages/shared`.
