"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  ShoppingBag,
  RefreshCw,
  X,
  Clock,
  CreditCard,
  Package,
  Truck,
  CheckCircle2,
  XCircle,
  ChevronDown,
  Search,
  Volume2,
  VolumeX,
  Eye,
} from "lucide-react";

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  payment_method: string;
  payment_reference?: string;
  status: string;
  notes?: string;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
}

const statusTabs = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

const statusConfig: Record<
  string,
  { label: string; color: string; bgColor: string; icon: React.ElementType }
> = {
  pending: {
    label: "Pending",
    color: "text-yellow-700",
    bgColor: "bg-yellow-100",
    icon: Clock,
  },
  paid: {
    label: "Paid",
    color: "text-green-700",
    bgColor: "bg-green-100",
    icon: CreditCard,
  },
  processing: {
    label: "Processing",
    color: "text-blue-700",
    bgColor: "bg-blue-100",
    icon: Package,
  },
  shipped: {
    label: "Shipped",
    color: "text-purple-700",
    bgColor: "bg-purple-100",
    icon: Truck,
  },
  delivered: {
    label: "Delivered",
    color: "text-green-700",
    bgColor: "bg-green-100",
    icon: CheckCircle2,
  },
  cancelled: {
    label: "Cancelled",
    color: "text-red-700",
    bgColor: "bg-red-100",
    icon: XCircle,
  },
};

// Valid next statuses for the update dropdown
const nextStatuses: Record<string, string[]> = {
  pending: ["paid", "cancelled"],
  paid: ["processing", "cancelled"],
  processing: ["shipped", "delivered", "cancelled"],
  shipped: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

function getToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|; )token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const prevOrderCount = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchOrders = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    try {
      const params = new URLSearchParams();
      if (activeTab !== "all") params.set("status", activeTab);
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
      params.set("limit", "100");

      const res = await fetch(`/api/orders?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to fetch orders");
      const data = await res.json();

      const newOrders: Order[] = data.orders || [];
      const newTotal: number = data.total || 0;

      // Check for new orders and play sound
      if (
        prevOrderCount.current > 0 &&
        newTotal > prevOrderCount.current &&
        soundEnabled
      ) {
        playNotificationSound();
      }
      prevOrderCount.current = newTotal;

      setOrders(newOrders);
      setTotal(newTotal);
      setError(null);
    } catch (err) {
      console.error("Error fetching orders:", err);
      setError("Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, [activeTab, fromDate, toDate, soundEnabled]);

  useEffect(() => {
    setLoading(true);
    fetchOrders();

    // Auto-refresh every 30 seconds
    intervalRef.current = setInterval(fetchOrders, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchOrders]);

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    const token = getToken();
    if (!token) return;

    setUpdatingId(orderId);
    setError(null);

    try {
      const res = await fetch("/api/orders", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: orderId, status: newStatus }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update order");
      }

      const data = await res.json();
      const updatedOrder: Order = data.order;

      // Update local state
      setOrders((prev) =>
        prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
      );

      if (selectedOrder?.id === updatedOrder.id) {
        setSelectedOrder(updatedOrder);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update order"
      );
    } finally {
      setUpdatingId(null);
    }
  };

  function playNotificationSound() {
    try {
      const ctx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      gain.gain.value = 0.3;
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.value = 1000;
        gain2.gain.value = 0.3;
        osc2.start();
        osc2.stop(ctx.currentTime + 0.2);
      }, 200);
    } catch {
      // Audio not supported or blocked - ignore
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShoppingBag className="w-6 h-6" />
            Orders
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {total} order{total !== 1 ? "s" : ""} total
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-lg border ${
              soundEnabled
                ? "text-green-600 border-green-200 bg-green-50"
                : "text-gray-400 border-gray-200"
            }`}
            title={
              soundEnabled
                ? "Sound notifications on"
                : "Sound notifications off"
            }
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4" />
            ) : (
              <VolumeX className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={() => {
              setLoading(true);
              fetchOrders();
            }}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-white border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw
              className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          {/* Date range */}
          <div className="flex items-center gap-2 text-sm">
            <label className="text-gray-500">From:</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm"
            />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <label className="text-gray-500">To:</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm"
            />
          </div>
          {(fromDate || toDate) && (
            <button
              onClick={() => {
                setFromDate("");
                setToDate("");
              }}
              className="text-sm text-red-500 hover:text-red-700"
            >
              Clear dates
            </button>
          )}
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
        {statusTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.value
                ? "bg-green-600 text-white"
                : "bg-white text-gray-600 hover:bg-gray-50 border"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Orders Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {loading && orders.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3" />
            Loading orders...
          </div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg font-medium">No orders found</p>
            <p className="text-sm mt-1">
              Orders from your online store will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Order
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Customer
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">
                    Phone
                  </th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">
                    Items
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">
                    Total
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">
                    Payment
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">
                    Date
                  </th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {orders.map((order) => {
                  const sc = statusConfig[order.status] || statusConfig.pending;
                  const StatusIcon = sc.icon;
                  const itemCount = (order.items || []).reduce(
                    (sum, item) => sum + item.quantity,
                    0
                  );

                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-medium text-gray-900">
                          {order.order_number}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900">
                          {order.customer_name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                        {order.customer_phone}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600 hidden lg:table-cell">
                        {itemCount}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        NLe {order.total_amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-gray-600 capitalize hidden md:table-cell">
                        {order.payment_method?.replace("_", " ")}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${sc.bgColor} ${sc.color}`}
                        >
                          <StatusIcon className="w-3 h-3" />
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs hidden lg:table-cell">
                        {formatDate(order.created_at)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="text-green-600 hover:text-green-700 p-1"
                          title="View order"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white rounded-t-xl">
              <h2 className="text-lg font-bold text-gray-900">
                Order {selectedOrder.order_number}
              </h2>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Status */}
              {(() => {
                const sc =
                  statusConfig[selectedOrder.status] || statusConfig.pending;
                const StatusIcon = sc.icon;
                return (
                  <div
                    className={`flex items-center gap-2 p-3 rounded-lg ${sc.bgColor}`}
                  >
                    <StatusIcon className={`w-5 h-5 ${sc.color}`} />
                    <span className={`font-medium ${sc.color}`}>
                      {sc.label}
                    </span>
                  </div>
                );
              })()}

              {/* Customer Info */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Customer
                </h3>
                <div className="text-sm space-y-1">
                  <p className="font-medium text-gray-900">
                    {selectedOrder.customer_name}
                  </p>
                  <p className="text-gray-600">
                    {selectedOrder.customer_phone}
                  </p>
                  {selectedOrder.customer_email && (
                    <p className="text-gray-600">
                      {selectedOrder.customer_email}
                    </p>
                  )}
                </div>
              </div>

              {/* Items */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Items
                </h3>
                <div className="space-y-2">
                  {(selectedOrder.items || []).map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between text-sm"
                    >
                      <div>
                        <span className="text-gray-900">
                          {item.product_name}
                        </span>
                        <span className="text-gray-500 ml-1">
                          x{item.quantity}
                        </span>
                        <span className="text-gray-400 ml-1">
                          @ NLe {item.unit_price.toLocaleString()}
                        </span>
                      </div>
                      <span className="font-medium text-gray-900">
                        NLe {item.total_price.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="border-t pt-3 space-y-1 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>
                    NLe {selectedOrder.subtotal.toLocaleString()}
                  </span>
                </div>
                {selectedOrder.tax_amount > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Tax</span>
                    <span>
                      NLe {selectedOrder.tax_amount.toLocaleString()}
                    </span>
                  </div>
                )}
                {selectedOrder.discount_amount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>
                      -NLe {selectedOrder.discount_amount.toLocaleString()}
                    </span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-gray-900 text-base pt-1 border-t">
                  <span>Total</span>
                  <span>
                    NLe {selectedOrder.total_amount.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Payment Info */}
              <div className="text-sm">
                <span className="text-gray-500">Payment: </span>
                <span className="text-gray-900 capitalize">
                  {selectedOrder.payment_method?.replace("_", " ")}
                </span>
                {selectedOrder.payment_reference && (
                  <span className="text-gray-400 ml-2 font-mono text-xs">
                    Ref: {selectedOrder.payment_reference}
                  </span>
                )}
              </div>

              {/* Notes */}
              {selectedOrder.notes && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Notes
                  </h3>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded p-2">
                    {selectedOrder.notes}
                  </p>
                </div>
              )}

              {/* Date */}
              <p className="text-xs text-gray-400">
                Placed on{" "}
                {new Date(selectedOrder.created_at).toLocaleDateString(
                  "en-US",
                  {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }
                )}
              </p>

              {/* Status Update */}
              {(nextStatuses[selectedOrder.status] || []).length > 0 && (
                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
                    Update Status
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {nextStatuses[selectedOrder.status].map(
                      (newStatus) => {
                        const sc =
                          statusConfig[newStatus] || statusConfig.pending;
                        return (
                          <button
                            key={newStatus}
                            onClick={() =>
                              updateOrderStatus(
                                selectedOrder.id,
                                newStatus
                              )
                            }
                            disabled={updatingId === selectedOrder.id}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                              updatingId === selectedOrder.id
                                ? "opacity-50 cursor-not-allowed"
                                : "hover:opacity-80"
                            } ${sc.bgColor} ${sc.color}`}
                          >
                            {updatingId === selectedOrder.id
                              ? "Updating..."
                              : `Mark as ${sc.label}`}
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
