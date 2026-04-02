import type { OrderInput } from "../types";

/**
 * Validation errors are thrown as a plain Error with a descriptive message.
 * Callers can catch and inspect `error.message` to determine the cause.
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Validate an OrderInput before attempting any database work.
 *
 * Rules:
 *  - shippingAddress must be a non-empty string (after trimming whitespace)
 *  - items array must contain at least one item
 *  - every item's quantity must be a positive integer (> 0)
 *  - every item's unitPrice must be a non-negative number
 *
 * Throws ValidationError on the first failed constraint.
 */
export function validateOrderInput(input: OrderInput): void {
  if (!input.shippingAddress || input.shippingAddress.trim().length === 0) {
    throw new ValidationError("shippingAddress must not be empty");
  }

  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new ValidationError("items must be a non-empty array");
  }

  for (const item of input.items) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new ValidationError(
        `Item '${item.productId}': quantity must be a positive integer, got ${item.quantity}`
      );
    }

    if (typeof item.unitPrice !== "number" || item.unitPrice < 0) {
      throw new ValidationError(
        `Item '${item.productId}': unitPrice must be a non-negative number, got ${item.unitPrice}`
      );
    }
  }
}
