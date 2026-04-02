# Order Processor

A Node.js + TypeScript backend module demonstrating a robust order processing system built on SQLite (Node 22.5+ built-in `node:sqlite`).

## Features

| Feature | Details |
|---|---|
| **Idempotency** | Each request carries a `messageId`. Duplicate calls return the original result without re-inserting. |
| **Validation** | Empty shipping address, empty items array, and zero/negative quantities are all rejected before the DB is touched. |
| **Atomic transactions** | All inserts for an order (header + items) run inside a single SQLite transaction. A mid-transaction failure rolls back everything. |
| **Strong typing** | Full TypeScript strict-mode coverage. |
| **Modular structure** | `db/`, `validation/`, `types/` — each concern is isolated. |
| **Zero native deps** | Uses Node 22.5+ built-in `node:sqlite` — no native compilation needed. |

## Project Structure

```
artifacts/order-processor/
├── src/
│   ├── index.ts              # Public exports
│   ├── processOrder.ts       # Core processOrder() function
│   ├── db/
│   │   ├── database.ts       # openDatabase() — opens SQLite, runs DDL
│   │   ├── queries.ts        # findOrderByMessageId, insertOrderWithItems
│   │   └── schema.ts         # CREATE TABLE statements
│   ├── types/
│   │   └── index.ts          # OrderInput, Order, OrderItem, etc.
│   └── validation/
│       └── index.ts          # validateOrderInput + ValidationError
├── __tests__/
│   └── processOrder.test.ts  # Jest test suite (4 groups, 8 test cases)
├── jest.config.js
├── package.json
└── tsconfig.json
```

## Requirements

- Node.js 22.5+ (for the built-in `node:sqlite` module)
- pnpm (workspace manager)

## Quick Start

```bash
# From the workspace root:
pnpm --filter @workspace/order-processor install
pnpm --filter @workspace/order-processor test

# Or navigate into the package directory:
cd artifacts/order-processor
pnpm install
pnpm test
```

## Usage

```typescript
import { openDatabase, processOrder } from "./src";

const db = openDatabase("orders.db");  // or ":memory:" for ephemeral storage

const result = processOrder(db, {
  messageId: "msg-unique-123",
  customerId: "cust-456",
  shippingAddress: "123 Main St, Springfield, IL 62701",
  items: [
    { productId: "sku-001", productName: "Widget", quantity: 2, unitPrice: 9.99 },
  ],
});

console.log(result.order);       // { id, messageId, totalAmount, status, ... }
console.log(result.items);       // [{ id, orderId, lineTotal, ... }]
console.log(result.isDuplicate); // false (first call) / true (replay)
```

## API

### `openDatabase(filePath?: string): DatabaseSync`

Opens a SQLite database and ensures the schema exists. Pass `":memory:"` for an ephemeral in-process database (used in tests).

### `processOrder(db, input): ProcessOrderResult`

| Step | What happens |
|---|---|
| 1 | `validateOrderInput` — throws `ValidationError` on bad input; no DB touch |
| 2 | Idempotency check — if `messageId` exists, returns stored result with `isDuplicate: true` |
| 3 | Atomic transaction — inserts `orders` + `order_items` or rolls back on any error |

### `ValidationError`

Thrown by `processOrder` when validation fails. Extends `Error`; detect with `instanceof ValidationError` or `error.name === "ValidationError"`.

## Database Schema

```sql
-- One row per order; message_id UNIQUE enforces idempotency at DB level
CREATE TABLE orders (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id       TEXT    NOT NULL UNIQUE,
  customer_id      TEXT    NOT NULL,
  shipping_address TEXT    NOT NULL,
  total_amount     REAL    NOT NULL DEFAULT 0,
  status           TEXT    NOT NULL DEFAULT 'pending',
  created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- One row per line item; foreign-keyed to orders
CREATE TABLE order_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id     INTEGER NOT NULL REFERENCES orders(id),
  product_id   TEXT    NOT NULL,
  product_name TEXT    NOT NULL,
  quantity     INTEGER NOT NULL,
  unit_price   REAL    NOT NULL,
  line_total   REAL    NOT NULL   -- denormalised: quantity * unit_price
);
```

## Test Suite

```
pnpm test
```

Four test groups covering all required scenarios:

| # | Group | What is verified |
|---|---|---|
| 1 | **Success case** | Order header fields, total amount calculation, line item line totals |
| 2 | **Duplicate messageId** | Second call returns same order; DB row counts stay at 1 / 2 |
| 3 | **Validation failures** | Empty address, no items, zero/negative quantity; no DB rows on failure |
| 4 | **Transaction rollback** | Mid-insert crash leaves both tables empty |
