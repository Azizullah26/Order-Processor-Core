import { useState, useEffect, useCallback } from "react";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal?: number;
}

interface Order {
  id: number;
  messageId: string;
  customerId: string;
  userName: string;
  mobileNumber: string;
  shippingAddress: string;
  totalAmount: number;
  status: string;
  createdAt: string;
  items: OrderItem[];
}

interface ProcessResult {
  order: Order;
  items: OrderItem[];
  isDuplicate: boolean;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function submitOrder(body: unknown): Promise<ProcessResult> {
  const res = await fetch(`${BASE}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Request failed");
  return json as ProcessResult;
}

async function fetchOrders(): Promise<Order[]> {
  const res = await fetch(`${BASE}/api/orders`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Request failed");
  return (json as { orders: Order[] }).orders;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function genMessageId() {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Badge({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "success" | "warning" | "error" }) {
  const styles = {
    default: "bg-secondary text-secondary-foreground",
    success: "bg-emerald-100 text-emerald-800",
    warning: "bg-amber-100 text-amber-800",
    error: "bg-red-100 text-red-800",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[variant]}`}>
      {children}
    </span>
  );
}

function ItemRow({ item, onRemove }: { item: OrderItem; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg text-sm">
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{item.productName}</div>
        <div className="text-muted-foreground text-xs">{item.productId}</div>
      </div>
      <div className="text-muted-foreground text-xs w-12 text-center">×{item.quantity}</div>
      <div className="font-mono text-xs w-16 text-right">{fmt(item.unitPrice)}</div>
      <div className="font-mono text-xs w-20 text-right font-semibold">{fmt(item.quantity * item.unitPrice)}</div>
      <button
        type="button"
        onClick={onRemove}
        className="ml-1 text-muted-foreground hover:text-destructive transition-colors"
        aria-label="Remove item"
      >
        ✕
      </button>
    </div>
  );
}

function OrderCard({ order, highlight }: { order: Order; highlight?: boolean }) {
  const [expanded, setExpanded] = useState(highlight ?? false);
  return (
    <div
      className={`rounded-xl border bg-card shadow-sm transition-all ${highlight ? "border-primary ring-2 ring-primary/20" : "border-border"
        }`}
    >
      <button
        className="w-full text-left p-4 flex items-start justify-between gap-3"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm truncate">#{order.id}</span>
            <Badge variant={highlight ? "success" : "default"}>{order.status}</Badge>
            {highlight && <Badge variant="success">New</Badge>}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 truncate">
            {order.messageId} · Customer: {order.customerId} · User: {order.userName} ({order.mobileNumber})
          </div>
          <div className="text-xs text-muted-foreground truncate">{order.shippingAddress}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-mono font-bold text-sm">{fmt(order.totalAmount)}</div>
          <div className="text-xs text-muted-foreground">{order.items.length} item{order.items.length !== 1 ? "s" : ""}</div>
        </div>
        <span className="text-muted-foreground text-xs shrink-0 mt-1">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="border-t px-4 pb-4 pt-3 space-y-1.5">
          {order.items.map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="flex-1 text-muted-foreground font-medium truncate">{item.productName}</span>
              <span className="text-muted-foreground w-8 text-center">×{item.quantity}</span>
              <span className="font-mono w-16 text-right">{fmt(item.unitPrice)}</span>
              <span className="font-mono font-semibold w-20 text-right">{fmt((item.lineTotal ?? item.quantity * item.unitPrice))}</span>
            </div>
          ))}
          <div className="border-t pt-2 flex justify-between items-center">
            <span className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleString()}</span>
            <span className="font-mono font-bold text-sm">{fmt(order.totalAmount)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main App
// ---------------------------------------------------------------------------

export default function App() {
  const { toast } = useToast();

  // --- Form state ---
  const [messageId, setMessageId] = useState(genMessageId);
  const [customerId, setCustomerId] = useState("cust-001");
  const [userName, setUserName] = useState("John Doe");
  const [mobileNumber, setMobileNumber] = useState("+1234567890");
  const [shippingAddress, setShippingAddress] = useState("123 Main St, Springfield, IL 62701");
  const [items, setItems] = useState<OrderItem[]>([
    { productId: "sku-001", productName: "Widget Pro", quantity: 2, unitPrice: 19.99 },
  ]);

  // New item fields
  const [newPid, setNewPid] = useState("sku-002");
  const [newPname, setNewPname] = useState("Gadget Plus");
  const [newQty, setNewQty] = useState("1");
  const [newPrice, setNewPrice] = useState("49.50");

  // --- Orders state ---
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<ProcessResult | null>(null);
  const [activeTab, setActiveTab] = useState<"form" | "orders">("form");

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchOrders();
      setOrders(list);
    } catch (err) {
      toast({ title: "Failed to load orders", description: String(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  function addItem() {
    const qty = parseInt(newQty, 10);
    const price = parseFloat(newPrice);
    if (!newPid || !newPname || isNaN(qty) || qty <= 0 || isNaN(price) || price < 0) {
      toast({ title: "Invalid item", description: "Check product ID, name, quantity (> 0), and price (≥ 0).", variant: "destructive" });
      return;
    }
    setItems((prev) => [...prev, { productId: newPid, productName: newPname, quantity: qty, unitPrice: price }]);
    setNewPid(`sku-00${items.length + 2}`);
    setNewPname("");
    setNewQty("1");
    setNewPrice("0.00");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setLastResult(null);
    try {
      const result = await submitOrder({ messageId, customerId, userName, mobileNumber, shippingAddress, items });
      setLastResult(result);
      await loadOrders();
      setActiveTab("orders");
      if (result.isDuplicate) {
        toast({ title: "Duplicate request", description: `Order #${result.order.id} already exists for this messageId.` });
      } else {
        toast({ title: "Order created", description: `Order #${result.order.id} — ${fmt(result.order.totalAmount)}`, variant: "default" });
        setMessageId(genMessageId());
      }
    } catch (err) {
      toast({ title: "Order failed", description: String(err), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  const total = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-foreground">Order Processing System</h1>
            <p className="text-xs text-muted-foreground">Test idempotency · validation · atomic transactions</p>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab("form")}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${activeTab === "form" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
            >
              Submit Order
            </button>
            <button
              onClick={() => { setActiveTab("orders"); loadOrders(); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${activeTab === "orders" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
            >
              Orders {orders.length > 0 && <span className="ml-1 text-[10px] opacity-70">({orders.length})</span>}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        {/* ------------------------------------------------------------------ */}
        {/* ORDER FORM TAB                                                       */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === "form" && (
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Feature badges */}
            <div className="flex flex-wrap gap-2">
              {[
                ["Idempotent", "Same messageId returns existing order"],
                ["Validated", "Address, items, quantities checked"],
                ["Atomic", "All-or-nothing SQLite transaction"],
              ].map(([label, tip]) => (
                <div key={label} title={tip} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent text-accent-foreground text-xs font-medium cursor-default select-none">
                  <span>✓</span> {label}
                </div>
              ))}
            </div>

            {/* Core fields */}
            <div className="rounded-xl border bg-card p-4 space-y-3">
              <h2 className="text-sm font-semibold">Order Details</h2>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs text-muted-foreground mb-1">Message ID <span className="text-muted-foreground/60">(idempotency key)</span></label>
                  <div className="flex gap-2">
                    <input
                      value={messageId}
                      onChange={(e) => setMessageId(e.target.value)}
                      className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setMessageId(genMessageId())}
                      className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground bg-muted rounded-lg transition-colors"
                      title="Generate new ID"
                    >
                      ↺ New
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">Submit twice with the same ID to test idempotency</p>
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs text-muted-foreground mb-1">Customer ID</label>
                  <input
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    required
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs text-muted-foreground mb-1">User Name</label>
                  <input
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    required
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs text-muted-foreground mb-1">Mobile Number</label>
                  <input
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    required
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs text-muted-foreground mb-1">Shipping Address</label>
                  <input
                    value={shippingAddress}
                    onChange={(e) => setShippingAddress(e.target.value)}
                    placeholder="Leave empty to test validation"
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">Clear to trigger validation error</p>
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="rounded-xl border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Line Items</h2>
                <span className="text-xs text-muted-foreground">{items.length} item{items.length !== 1 ? "s" : ""}</span>
              </div>

              {items.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">No items — add one below, or submit empty to test validation</p>
              ) : (
                <div className="space-y-1.5">
                  {items.map((item, i) => (
                    <ItemRow
                      key={i}
                      item={item}
                      onRemove={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}
                    />
                  ))}
                  <div className="flex justify-end pt-1 border-t text-sm font-mono font-bold">
                    Total: {fmt(total)}
                  </div>
                </div>
              )}

              {/* Add item row */}
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-2">Add item</p>
                <div className="grid grid-cols-12 gap-2 text-sm">
                  <input
                    value={newPid}
                    onChange={(e) => setNewPid(e.target.value)}
                    placeholder="Product ID"
                    className="col-span-3 rounded-lg border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                  />
                  <input
                    value={newPname}
                    onChange={(e) => setNewPname(e.target.value)}
                    placeholder="Product name"
                    className="col-span-4 rounded-lg border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <input
                    value={newQty}
                    onChange={(e) => setNewQty(e.target.value)}
                    placeholder="Qty"
                    type="number"
                    min="1"
                    className="col-span-2 rounded-lg border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring text-center"
                  />
                  <input
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    placeholder="Price"
                    type="number"
                    min="0"
                    step="0.01"
                    className="col-span-2 rounded-lg border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                  />
                  <button
                    type="button"
                    onClick={addItem}
                    className="col-span-1 rounded-lg bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-medium transition-colors flex items-center justify-center"
                  >
                    +
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">Set qty to 0 or negative to test quantity validation</p>
              </div>
            </div>

            {/* Last result banner */}
            {lastResult && (
              <div className={`rounded-xl border p-3 text-sm ${lastResult.isDuplicate ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"}`}>
                <div className="font-semibold text-xs mb-1 uppercase tracking-wide text-muted-foreground">
                  {lastResult.isDuplicate ? "Duplicate — existing order returned" : "New order created"}
                </div>
                <div>Order <span className="font-mono font-bold">#{lastResult.order.id}</span> · {fmt(lastResult.order.totalAmount)} · {lastResult.items.length} item{lastResult.items.length !== 1 ? "s" : ""}</div>
                <div className="font-mono text-xs text-muted-foreground mt-0.5">{lastResult.order.messageId}</div>
              </div>
            )}

            {/* Submit */}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {submitting ? "Processing…" : "Submit Order"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setItems([]);
                  setShippingAddress("");
                  setCustomerId("cust-bad");
                  setUserName("");
                  setMobileNumber("");
                }}
                className="px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 rounded-xl transition-colors"
                title="Set up a validation failure scenario"
              >
                Test Error
              </button>
            </div>

            {/* Scenario hints */}
            <div className="rounded-xl border border-dashed bg-muted/30 p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Test scenarios</p>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                <li><strong className="text-foreground">Idempotency:</strong> Submit an order, then submit again with the same Message ID — the second call returns the existing order.</li>
                <li><strong className="text-foreground">Duplicate Check:</strong> Order "Widget Pro", then try to order it again with the same Name and Mobile — it will block you!</li>
                <li><strong className="text-foreground">Validation — empty address:</strong> Clear the shipping address and submit.</li>
                <li><strong className="text-foreground">Validation — no items:</strong> Remove all items and submit.</li>
                <li><strong className="text-foreground">Validation — bad quantity:</strong> Add an item with quantity 0 or negative.</li>
                <li><strong className="text-foreground">Test Error button:</strong> Clears items and address at once to trigger a validation error.</li>
              </ul>
            </div>
          </form>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* ORDERS LIST TAB                                                      */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === "orders" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">{orders.length} Order{orders.length !== 1 ? "s" : ""}</h2>
              <button
                onClick={loadOrders}
                disabled={loading}
                className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
              >
                {loading ? "Loading…" : "↺ Refresh"}
              </button>
            </div>

            {orders.length === 0 && !loading && (
              <div className="text-center py-12 text-muted-foreground text-sm">
                No orders yet — submit one using the form.
              </div>
            )}

            {orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                highlight={lastResult?.order.id === order.id}
              />
            ))}
          </div>
        )}
      </main>

      <Toaster />
    </div>
  );
}
