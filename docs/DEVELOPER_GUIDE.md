# Developer Guide

## Prerequisites

- Node 18+ and npm.
- A ZTE router reachable on your LAN, and an active login session in the same
  browser (the app reuses the session cookie).

## Layout & dependency direction

```
pages → hooks → services → (api | signals | reverse | plugins) → types
components ─────────────────────────────────────────────────────┘
store (zustand) is used by hooks/components; it owns the live client.
```

Rules:
- **Downward imports only.** `services` never import `hooks`; `api` never
  imports `services`. This keeps the core testable without React.
- **One responsibility per file.** Transport, auth, parsing, classification,
  merging, and UI are separate modules.
- **No model-specific code outside `plugins/`.**

## Adding a feature page

1. Add a service function in `src/services/` (pure, takes a `GoformClient`).
2. Expose it via a hook in `src/hooks/` (TanStack Query).
3. Build the page in `src/pages/` from `components/ui` primitives.
4. Register the route + nav item in `src/router/nav.ts` and `src/App.tsx`.

## Mutations & safety

- Read hooks use `useQuery`; actions use `useMutation`.
- Every mutating action goes through `<ConfirmButton>` and reports via
  `<MutationResult>`. The client attaches `RD`/`AD` automatically.
- Firmware returning HTTP 200 with `result: "failure"` is treated as a failure
  (`isSuccess` in `services/lock-service.ts`).

## State

- `connection-store` owns the live `GoformClient` (not persisted) and the
  resolved plugin; only `baseUrl` is persisted.
- `theme-store`, `console-store` persist to `localStorage`.
- `devlog-store` is an in-memory ring buffer fed by the client's `onTraffic`
  hook — this powers Developer Mode.

## Testing

`npm run test` runs Vitest over `src/**/*.test.ts`. The core (auth, band-mask,
parser, database, signal engine, plugin detection) is covered without a browser.
Prefer testing pure functions in `signals/`, `reverse/`, `api/`, `plugins/`.

## Conventions

- Strict TypeScript (`noUncheckedIndexedAccess`, `noUnusedLocals`, …).
- Prettier + ESLint enforced; run `npm run format` and `npm run lint`.
- Path alias `@/` → `src/`.
