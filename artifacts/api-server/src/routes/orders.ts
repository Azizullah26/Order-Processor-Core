import { Router, type IRouter } from "express";
import { DatabaseSync } from "node:sqlite";
import { openDatabase, processOrder, ValidationError } from "@workspace/order-processor";

const router: IRouter = Router();

// Shared SQLite database for the lifetime of this server process.
// Using a file-based DB so orders persist across restarts.
let db: DatabaseSync;

function getDb(): DatabaseSync {
  if (!db) {
    db = openDatabase("orders.db");
  }
  return db;
}

/**
 * POST /api/orders
 * Submit a new order (or replay an existing one via messageId idempotency).
 */
router.post("/orders", (req, res) => {
  const { messageId, customerId, userName, mobileNumber, shippingAddress, items } = req.body as {
    messageId?: string;
    customerId?: string;
    userName?: string;
    mobileNumber?: string;
    shippingAddress?: string;
    items?: unknown[];
  };

  if (!messageId || typeof messageId !== "string") {
    res.status(400).json({ error: "messageId is required" });
    return;
  }
  if (!customerId || typeof customerId !== "string") {
    res.status(400).json({ error: "customerId is required" });
    return;
  }
  if (!userName || typeof userName !== "string") {
    res.status(400).json({ error: "userName is required" });
    return;
  }
  if (!mobileNumber || typeof mobileNumber !== "string") {
    res.status(400).json({ error: "mobileNumber is required" });
    return;
  }

  try {
    const result = processOrder(getDb(), {
      messageId,
      customerId,
      userName,
      mobileNumber,
      shippingAddress: shippingAddress ?? "",
      items: (items ?? []) as Array<{
        productId: string;
        productName: string;
        quantity: number;
        unitPrice: number;
      }>,
    });

    res.status(result.isDuplicate ? 200 : 201).json(result);
  } catch (err) {
    if (err instanceof ValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    req.log.error({ err }, "Failed to process order");
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/orders
 * List all orders (with their items).
 */
router.get("/orders", (_req, res) => {
  const database = getDb();
  const orders = database
    .prepare(
      "SELECT id, message_id AS messageId, customer_id AS customerId, user_name AS userName, mobile_number AS mobileNumber, shipping_address AS shippingAddress, total_amount AS totalAmount, status, created_at AS createdAt FROM orders ORDER BY id DESC"
    )
    .all() as Array<{
      id: number;
      messageId: string;
      customerId: string;
      userName: string;
      mobileNumber: string;
      shippingAddress: string;
      totalAmount: number;
      status: string;
      createdAt: string;
    }>;

  const result = orders.map((order) => {
    const items = database
      .prepare(
        "SELECT id, order_id AS orderId, product_id AS productId, product_name AS productName, quantity, unit_price AS unitPrice, line_total AS lineTotal FROM order_items WHERE order_id = ? ORDER BY id"
      )
      .all(order.id) as Array<{
        id: number;
        orderId: number;
        productId: string;
        productName: string;
        quantity: number;
        unitPrice: number;
        lineTotal: number;
      }>;
    return { ...order, items };
  });

  res.json({ orders: result });
});

export default router;
