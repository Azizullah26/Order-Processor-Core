import { DatabaseSync } from "node:sqlite";
import {
  findItemsByOrderId,
  findOrderByMessageId,
  insertOrderWithItems,
} from "./db/queries";
import type { OrderInput, ProcessOrderResult } from "./types";
import { validateOrderInput } from "./validation";

/**
 * processOrder — the main entry point for order processing.
 *
 * Behaviour:
 *  1. Validate the input (address, items, quantities).  Throws ValidationError
 *     on any violation — no DB work is performed.
 *  2. Check for an existing order with the same messageId (idempotency).
 *     If one exists, return it immediately without writing to the database.
 *  3. Insert the order and all its items in a single atomic SQLite transaction.
 *     If any statement fails the transaction is rolled back, leaving the DB
 *     in the pre-call state.
 *
 * @param db     - An open node:sqlite DatabaseSync instance.
 * @param input  - The order request.
 * @returns      - The persisted order + items, plus an `isDuplicate` flag.
 */
export function processOrder(
  db: DatabaseSync,
  input: OrderInput
): ProcessOrderResult {
  // Step 1: validate before touching the database
  validateOrderInput(input);

  // Step 2: idempotency check
  const existingOrder = findOrderByMessageId(db, input.messageId);
  if (existingOrder) {
    const items = findItemsByOrderId(db, existingOrder.id);
    return { order: existingOrder, items, isDuplicate: true };
  }

  // Step 3: atomic insert (throws + rolls back on failure)
  const { order, items } = insertOrderWithItems(db, {
    messageId: input.messageId,
    customerId: input.customerId,
    shippingAddress: input.shippingAddress,
    items: input.items,
  });

  return { order, items, isDuplicate: false };
}
