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

  // Initialise schema
  db.exec(CREATE_ORDERS_TABLE);
  db.exec(CREATE_ORDER_ITEMS_TABLE);

  return db;
}
