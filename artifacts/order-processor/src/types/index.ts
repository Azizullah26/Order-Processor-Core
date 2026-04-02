/**
 * Input shape expected by processOrder().
 * messageId is used for idempotency — duplicate calls with the same
 * messageId return the previously created order without re-inserting.
 */
export interface OrderInput {
  messageId: string;
  customerId: string;
  userName: string;
  mobileNumber: string;
  shippingAddress: string;
  items: OrderItemInput[];
}

/**
 * A single line item inside an order.
 */
export interface OrderItemInput {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

/**
 * Persisted order row returned after a successful processOrder() call.
 * Field names are camelCase (mapped from snake_case DB columns via aliases).
 */
export interface Order {
  id: number;
  messageId: string;
  customerId: string;
  userName: string;
  mobileNumber: string;
  shippingAddress: string;
  totalAmount: number;
  status: string;
  createdAt: string;
}

/**
 * Persisted order-item row.
 */
export interface OrderItem {
  id: number;
  orderId: number;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

/**
 * Full result returned by processOrder(): the order plus its line items.
 */
export interface ProcessOrderResult {
  order: Order;
  items: OrderItem[];
  /** true when the result came from a previously processed messageId */
  isDuplicate: boolean;
}
