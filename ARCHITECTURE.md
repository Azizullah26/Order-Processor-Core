# Architecture

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM (shared API server), SQLite built-in (order processor)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (ESM bundle)

## Structure

```text
project-root/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   ├── order-processor/    # Standalone order processing library + tests
│   └── order-ui/           # React + Vite frontend
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml     # pnpm workspace config
├── tsconfig.base.json      # Shared TS options
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

- **Always typecheck from the root**: `pnpm run typecheck`
- `emitDeclarationOnly` — only `.d.ts` files emitted during typecheck; bundling is handled by esbuild/vite
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array

## Root Scripts

- `pnpm run build` — typecheck then recursively build all packages
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly`

## Packages

### `artifacts/api-server`

Express 5 API server. Routes in `src/routes/` use `@workspace/api-zod` for validation, `@workspace/db` for persistence, and `@workspace/order-processor` for order logic.

- `GET /api/healthz` — health check
- `POST /api/orders` — submit order (idempotent via messageId)
- `GET /api/orders` — list all orders with items

### `artifacts/order-processor`

Standalone order processing library. Uses Node.js 22.5+ built-in `node:sqlite`.

- `processOrder(db, input)` — idempotency, validation, atomic SQLite transactions
- Jest test suite: `pnpm --filter @workspace/order-processor test`

### `artifacts/order-ui`

React + Vite frontend. Single-page app for testing order submission and idempotency.

### `lib/db`

Drizzle ORM + PostgreSQL. Requires `DATABASE_URL` environment variable.

### `lib/api-spec`

OpenAPI 3.1 spec + Orval codegen config. Run codegen:
```bash
pnpm --filter @workspace/api-spec run codegen
```
