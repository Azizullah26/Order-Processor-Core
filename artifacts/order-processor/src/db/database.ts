import { DatabaseSync } from "node:sqlite";
import { CREATE_ORDER_ITEMS_TABLE, CREATE_ORDERS_TABLE } from "./schema";

/**
 * Open (or create) a SQLite database at the given file path and run the DDL
 * to ensure both tables exist.
 *
 * Passing ":memory:" gives an ephemeral, in-process database — ideal for
 * tests because each suite gets an isolated store that disappears on close.
 *
 * node:sqlite (Node 22.5+) is used so no native compilation is required.
 */
export function openDatabase(filePath: string = ":memory:"): DatabaseSync {
  const db = new DatabaseSync(filePath);

  // Enforce foreign-key constraints (SQLite disables them by default)
  db.exec("PRAGMA foreign_keys = ON;");

  // Initialise schema (no-op if tables already exist)
  db.exec(CREATE_ORDERS_TABLE);
  db.exec(CREATE_ORDER_ITEMS_TABLE);

  // -------------------------------------------------------------------------
  // Schema migrations — add columns introduced after the initial schema.
  // -------------------------------------------------------------------------
  const existingColumns = (
    db.prepare("PRAGMA table_info(orders)").all() as Array<{ name: string }>
  ).map((c) => c.name);

  if (!existingColumns.includes("user_name")) {
    db.exec("ALTER TABLE orders ADD COLUMN user_name TEXT NOT NULL DEFAULT '';");
  }
  if (!existingColumns.includes("mobile_number")) {
    db.exec("ALTER TABLE orders ADD COLUMN mobile_number TEXT NOT NULL DEFAULT '';");
  }

  return db;
}
