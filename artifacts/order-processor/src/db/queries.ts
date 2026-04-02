import { DatabaseSync } from "node:sqlite";
import type { Order, OrderItem, OrderItemInput } from "../types";

/**
 * Look up an existing order by its messageId.
 * Returns undefined when not found.
 */
export function findOrderByMessageId(
  db: DatabaseSync,
  messageId: string
): Order | undefined {
  const stmt = db.prepare(
    "SELECT id, message_id AS messageId, customer_id AS customerId, shipping_address AS shippingAddress, total_amount AS totalAmount, status, created_at AS createdAt FROM orders WHERE message_id = ?"
  );
  const row = stmt.get(messageId) as unknown as Order | undefined;
  return row;
}

/**
 * Fetch all line items for a given orderId.
 */
export function findItemsByOrderId(
  db: DatabaseSync,
  orderId: number
): OrderItem[] {
  const stmt = db.prepare(
    "SELECT id, order_id AS orderId, product_id AS productId, product_name AS productName, quantity, unit_price AS unitPrice, line_total AS lineTotal FROM order_items WHERE order_id = ?"
  );
  return stmt.all(orderId) as unknown as OrderItem[];
}

/**
 * Insert a new order row and all its line items inside a single SQLite
 * transaction.  Either every INSERT succeeds or none of them do (atomicity).
 *
 * Throws if any statement fails — the caller's try/catch triggers a full
 * rollback via the explicit ROLLBACK in the transaction wrapper.
 */
export function insertOrderWithItems(
  db: DatabaseSync,
  params: {
    messageId: string;
    customerId: string;
    shippingAddress: string;
    items: OrderItemInput[];
  }
): { order: Order; items: OrderItem[] } {
  // Calculate the order total before entering the transaction
  const totalAmount = params.items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );

  // Wrap everything in a transaction for atomicity.
  // BEGIN / COMMIT / ROLLBACK are issued explicitly because node:sqlite
  // does not expose a higher-level transaction() helper like better-sqlite3.
  db.exec("BEGIN;");
  try {
    // --- Insert order header ---
    const insertOrder = db.prepare(
      "INSERT INTO orders (message_id, customer_id, shipping_address, total_amount) VALUES (?, ?, ?, ?)"
    );
    insertOrder.run(
      params.messageId,
      params.customerId,
      params.shippingAddress,
      totalAmount
    );

    // Retrieve the auto-generated id of the row we just inserted
    const { id: orderId } = db
      .prepare("SELECT last_insert_rowid() AS id")
      .get() as unknown as { id: number };

    // --- Insert each line item ---
    const insertItem = db.prepare(
      "INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?, ?)"
    );

    for (const item of params.items) {
      const lineTotal = item.quantity * item.unitPrice;
      insertItem.run(
        orderId,
        item.productId,
        item.productName,
        item.quantity,
        item.unitPrice,
        lineTotal
      );
    }

    db.exec("COMMIT;");

    // Re-read persisted rows so callers get DB-generated values (e.g. created_at)
    const order = findOrderByMessageId(db, params.messageId) as Order;
    const items = findItemsByOrderId(db, orderId);

    return { order, items };
  } catch (err) {
    // Rollback on any failure so the database is left in a clean state
    db.exec("ROLLBACK;");
    throw err;
  }
}
