# Order Processing System

A Node.js + TypeScript monorepo demonstrating a robust order processing system with:

- **Idempotent** order submission via `messageId`
- **Validated** inputs (address, items, quantities)
- **Atomic** SQLite transactions — all-or-nothing inserts
- **REST API** built on Express 5
- **React UI** for interactive testing

## Requirements

| Tool | Version |
|---|---|
| Node.js | 22.5 or later (24 recommended) |
| pnpm | 9 or later |

Install pnpm if you don't have it:
```bash
npm install -g pnpm
```

---

## Quick Start — Local Deployment

### 1. Install dependencies

```bash
pnpm install
```

### 2. Run the Jest test suite (no server needed)

```bash
pnpm --filter @workspace/order-processor test
```

All 8 tests should pass. This validates the core logic independently of any web server.

### 3. Start the API server

```bash
PORT=8080 pnpm --filter @workspace/api-server run dev
```

The server starts at `http://localhost:8080`. Available endpoints:

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/healthz` | Health check |
| `POST` | `/api/orders` | Submit an order |
| `GET` | `/api/orders` | List all orders |

### 4. Start the React UI (separate terminal)

```bash
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/order-ui run dev
```

Open `http://localhost:3000` in your browser.

> **Note:** The UI calls the API at `/api/orders`. If you run the API on a different port, you need a reverse proxy (like nginx or Caddy) to route `/api` to port 8080 and `/` to port 3000. The simplest setup is to use the same port by running both behind a proxy — see the [Proxy Setup](#optional-proxy-setup) section below.

---

## Project Structure

```
project-root/
├── artifacts/
│   ├── api-server/         # Express 5 REST API
│   ├── order-processor/    # Core library + Jest tests
│   └── order-ui/           # React + Vite frontend
├── lib/
│   ├── api-spec/           # OpenAPI spec (source of truth)
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod validators
│   └── db/                 # Drizzle ORM + PostgreSQL schema
├── scripts/                # Utility scripts
├── ARCHITECTURE.md         # Detailed architecture notes
└── README.md               # This file
```

---

## Running Individual Pieces

### Core library tests only
```bash
pnpm --filter @workspace/order-processor test
```

### API server only
```bash
PORT=8080 pnpm --filter @workspace/api-server run dev
```

### UI only (points to API at same origin)
```bash
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/order-ui run dev
```

### Type-check everything
```bash
pnpm run typecheck
```

---

## Manual API Testing

With the API server running on port 8080:

**Submit an order:**
```bash
curl -s -X POST http://localhost:8080/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "messageId": "msg-001",
    "customerId": "cust-abc",
    "shippingAddress": "123 Main St, Springfield, IL 62701",
    "items": [
      { "productId": "sku-1", "productName": "Widget", "quantity": 2, "unitPrice": 19.99 }
    ]
  }' | jq .
```

**Submit the same messageId again (idempotency):**
```bash
curl -s -X POST http://localhost:8080/api/orders \
  -H "Content-Type: application/json" \
  -d '{ "messageId": "msg-001", "customerId": "cust-abc", "shippingAddress": "123 Main St", "items": [{ "productId": "sku-1", "productName": "Widget", "quantity": 2, "unitPrice": 19.99 }] }' \
  | jq .isDuplicate
# → true
```

**Trigger validation error (empty address):**
```bash
curl -s -X POST http://localhost:8080/api/orders \
  -H "Content-Type: application/json" \
  -d '{ "messageId": "msg-002", "customerId": "cust-abc", "shippingAddress": "", "items": [] }' \
  | jq .error
```

**List all orders:**
```bash
curl -s http://localhost:8080/api/orders | jq .
```

---

## Optional Proxy Setup

To serve both the API and UI from a single port (e.g., 3000), use a simple nginx config:

```nginx
server {
    listen 3000;

    location /api/ {
        proxy_pass http://localhost:8080;
    }

    location / {
        proxy_pass http://localhost:3001;
    }
}
```

Or use [http-proxy-middleware](https://github.com/chimurai/http-proxy-middleware) / [Caddy](https://caddyserver.com/) for a simpler setup.

---

## Environment Variables

| Variable | Used by | Default | Description |
|---|---|---|---|
| `PORT` | api-server, order-ui | — | Port to listen on (required) |
| `BASE_PATH` | order-ui | `/` | URL base path for the UI |
| `DATABASE_URL` | db (lib/db) | — | PostgreSQL connection string (not needed for order-processor tests) |
| `NODE_ENV` | api-server | `development` | Set to `production` for prod logging |

---

## Production Build

```bash
# Build the API server (outputs dist/index.mjs)
pnpm --filter @workspace/api-server run build

# Build the UI (outputs static files to dist/public/)
BASE_PATH=/ pnpm --filter @workspace/order-ui run build

# Run the built API server
PORT=8080 NODE_ENV=production node artifacts/api-server/dist/index.mjs
```

Serve the static UI files from `artifacts/order-ui/dist/public/` using nginx, Caddy, or any static file server.
