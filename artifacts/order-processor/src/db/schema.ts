/**
 * DDL for the two tables used by the order processing system.
 *
 * orders       — one row per order, keyed by an auto-increment `id`.
 *                `message_id` carries a UNIQUE constraint to enforce
 *                idempotency at the database level.
 *
 * order_items  — one row per line item; foreign-keyed to orders(id).
 *                `line_total` is stored denormalised (quantity * unit_price)
 *                so queries don't need to compute it each time.
 */
export const CREATE_ORDERS_TABLE = `
  CREATE TABLE IF NOT EXISTS orders (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id       TEXT    NOT NULL UNIQUE,
    customer_id      TEXT    NOT NULL,
    user_name        TEXT    NOT NULL,
    mobile_number    TEXT    NOT NULL,
    shipping_address TEXT    NOT NULL,
    total_amount     REAL    NOT NULL DEFAULT 0,
    status           TEXT    NOT NULL DEFAULT 'pending',
    created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`;

export const CREATE_ORDER_ITEMS_TABLE = `
  CREATE TABLE IF NOT EXISTS order_items (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id     INTEGER NOT NULL REFERENCES orders(id),
    product_id   TEXT    NOT NULL,
    product_name TEXT    NOT NULL,
    quantity     INTEGER NOT NULL,
    unit_price   REAL    NOT NULL,
    line_total   REAL    NOT NULL
  );
`;
