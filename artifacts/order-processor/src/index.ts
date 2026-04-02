/**
 * Public API surface for the order-processor package.
 */
export { openDatabase } from "./db/database";
export { processOrder } from "./processOrder";
export type {
  Order,
  OrderInput,
  OrderItem,
  OrderItemInput,
  ProcessOrderResult,
} from "./types";
export { ValidationError } from "./validation";
