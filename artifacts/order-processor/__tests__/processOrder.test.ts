import { DatabaseSync } from "node:sqlite";
import { openDatabase } from "../src/db/database";
import { processOrder } from "../src/processOrder";
import type { OrderInput } from "../src/types";
import { ValidationError } from "../src/validation";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a fresh in-memory database for each test. */
function makeDb(): DatabaseSync {
  return openDatabase(":memory:");
}

/** A valid order input used as the baseline across multiple tests. */
function validInput(overrides: Partial<OrderInput> = {}): OrderInput {
  return {
    messageId: "msg-001",
    customerId: "cust-abc",
    userName: "John Doe",
    mobileNumber: "+1234567890",
    shippingAddress: "123 Main Street, Springfield, IL 62701",
    items: [
      {
        productId: "prod-1",
        productName: "Widget Pro",
        quantity: 2,
        unitPrice: 19.99,
      },
      {
        productId: "prod-2",
        productName: "Gadget Plus",
        quantity: 1,
        unitPrice: 49.5,
      },
    ],
    ...overrides,
  } as OrderInput;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("processOrder", () => {
  // -------------------------------------------------------------------------
  // 1. Success case
  // -------------------------------------------------------------------------
  describe("success case", () => {
    it("creates an order and returns the persisted data", () => {
      const db = makeDb();
      const input = validInput();

      const result = processOrder(db, input);

      // Order header
      expect(result.isDuplicate).toBe(false);
      expect(result.order.messageId).toBe(input.messageId);
      expect(result.order.customerId).toBe(input.customerId);
      expect(result.order.shippingAddress).toBe(input.shippingAddress);
      expect(result.order.status).toBe("pending");
      expect(result.order.id).toBeGreaterThan(0);

      // Total amount: 2 * 19.99 + 1 * 49.50 = 89.48
      expect(result.order.totalAmount).toBeCloseTo(89.48, 2);

      // Line items
      expect(result.items).toHaveLength(2);

      const widget = result.items.find((i) => i.productId === "prod-1");
      expect(widget).toBeDefined();
      expect(widget!.quantity).toBe(2);
      expect(widget!.unitPrice).toBeCloseTo(19.99, 2);
      expect(widget!.lineTotal).toBeCloseTo(39.98, 2);

      const gadget = result.items.find((i) => i.productId === "prod-2");
      expect(gadget).toBeDefined();
      expect(gadget!.lineTotal).toBeCloseTo(49.5, 2);

      db.close();
    });
  });

  // -------------------------------------------------------------------------
  // 2. Idempotency — duplicate messageId
  // -------------------------------------------------------------------------
  describe("duplicate messageId", () => {
    it("returns the original order on a second call with the same messageId", () => {
      const db = makeDb();
      const input = validInput();

      const first = processOrder(db, input);
      const second = processOrder(db, input);

      // Both calls must return the same persisted order
      expect(second.isDuplicate).toBe(true);
      expect(second.order.id).toBe(first.order.id);
      expect(second.order.messageId).toBe(first.order.messageId);
      expect(second.items).toHaveLength(first.items.length);

      // Only one order row should exist in the database
      const row = db
        .prepare(
          "SELECT COUNT(*) AS n FROM orders WHERE message_id = ?"
        )
        .get(input.messageId) as { n: number };
      expect(row.n).toBe(1);

      db.close();
    });

    it("does not insert additional item rows on duplicate", () => {
      const db = makeDb();
      const input = validInput();

      processOrder(db, input);
      processOrder(db, input);

      const row = db
        .prepare("SELECT COUNT(*) AS n FROM order_items")
        .get() as { n: number };
      // Still only the original 2 items
      expect(row.n).toBe(2);

      db.close();
    });
  });

  // -------------------------------------------------------------------------
  // 3. Validation failures
  // -------------------------------------------------------------------------
  describe("validation failures", () => {
    it("rejects an empty shippingAddress", () => {
      const db = makeDb();
      expect(() =>
        processOrder(db, validInput({ shippingAddress: "" }))
      ).toThrow(ValidationError);
      expect(() =>
        processOrder(db, validInput({ shippingAddress: "   " }))
      ).toThrow(ValidationError);
      db.close();
    });

    it("rejects an order with empty userName or mobileNumber", () => {
      const db = makeDb();
      expect(() =>
        processOrder(db, validInput({ userName: "" }))
      ).toThrow(ValidationError);
      expect(() =>
        processOrder(db, validInput({ mobileNumber: "" }))
      ).toThrow(ValidationError);
      db.close();
    });

    it("rejects duplicate product order from the same user", () => {
      const db = makeDb();
      const input = validInput();
      processOrder(db, input);

      // Same user, different messageId, but same item
      const duplicateItemInput = validInput({ messageId: "msg-002" });
      expect(() => processOrder(db, duplicateItemInput)).toThrow(ValidationError);
      expect(() => processOrder(db, duplicateItemInput)).toThrow(/You already have an order for "Widget Pro"/);
      
      // Different user, same item (should pass)
      const diffUserInput = validInput({ messageId: "msg-003", userName: "Jane Doe" });
      const diffResult = processOrder(db, diffUserInput);
      expect(diffResult.isDuplicate).toBe(false);

      db.close();
    });

    it("rejects an order with no items", () => {
      const db = makeDb();
      expect(() =>
        processOrder(db, validInput({ items: [] }))
      ).toThrow(ValidationError);
      db.close();
    });

    it("rejects items with quantity <= 0", () => {
      const db = makeDb();

      const withZeroQty = validInput({
        items: [
          {
            productId: "p1",
            productName: "X",
            quantity: 0,
            unitPrice: 10,
          },
        ],
      });
      expect(() => processOrder(db, withZeroQty)).toThrow(ValidationError);

      const withNegQty = validInput({
        items: [
          {
            productId: "p1",
            productName: "X",
            quantity: -3,
            unitPrice: 10,
          },
        ],
      });
      expect(() => processOrder(db, withNegQty)).toThrow(ValidationError);

      db.close();
    });

    it("does not insert any rows when validation fails", () => {
      const db = makeDb();

      try {
        processOrder(db, validInput({ shippingAddress: "" }));
      } catch {
        // expected
      }

      const row = db
        .prepare("SELECT COUNT(*) AS n FROM orders")
        .get() as { n: number };
      expect(row.n).toBe(0);

      db.close();
    });
  });

  // -------------------------------------------------------------------------
  // 4. Atomic transaction / rollback
  // -------------------------------------------------------------------------
  describe("transaction rollback", () => {
    it("leaves the database clean when an insert fails mid-transaction", () => {
      const db = makeDb();

      /**
       * Force a failure during the order_items INSERT by injecting a bad SQL
       * statement directly.  We temporarily replace the real table with a view
       * that raises an error when inserted into, simulating a mid-transaction crash.
       *
       * The implementation uses an explicit BEGIN/ROLLBACK in insertOrderWithItems,
       * so a throw mid-transaction triggers a full rollback.
       */

      // We'll test rollback by calling insertOrderWithItems directly and
      // breaking one of the item inserts by making quantity violate a
      // CHECK constraint we add for this test.
      db.exec("DROP TABLE IF EXISTS order_items;");
      db.exec(`
        CREATE TABLE order_items (
          id           INTEGER PRIMARY KEY AUTOINCREMENT,
          order_id     INTEGER NOT NULL REFERENCES orders(id),
          product_id   TEXT    NOT NULL,
          product_name TEXT    NOT NULL,
          quantity     INTEGER NOT NULL CHECK(quantity > 0),
          unit_price   REAL    NOT NULL,
          line_total   REAL    NOT NULL
        );
      `);

      // Pass an item with quantity=0 which will fail the CHECK on INSERT
      const badInput: OrderInput = {
        ...validInput(),
        items: [
          { productId: "ok", productName: "OK Item", quantity: 1, unitPrice: 5 },
          // This item bypasses our JS validation (we set it directly) but
          // will fail the DB CHECK constraint during insert
          { productId: "bad", productName: "Bad Item", quantity: -1, unitPrice: 5 },
        ],
      };

      // Bypass JS validation by calling insertOrderWithItems directly
      const { insertOrderWithItems } = require("../src/db/queries");

      expect(() =>
        insertOrderWithItems(db, {
          messageId: "rollback-test",
          customerId: "c1",
          userName: "Test",
          mobileNumber: "123",
          shippingAddress: "123 Street",
          items: badInput.items,
        })
      ).toThrow();

      // Neither the order row nor any item rows should be present
      const orderCount = (
        db
          .prepare("SELECT COUNT(*) AS n FROM orders")
          .get() as { n: number }
      ).n;
      expect(orderCount).toBe(0);

      const itemCount = (
        db
          .prepare("SELECT COUNT(*) AS n FROM order_items")
          .get() as { n: number }
      ).n;
      expect(itemCount).toBe(0);

      db.close();
    });
  });
});
