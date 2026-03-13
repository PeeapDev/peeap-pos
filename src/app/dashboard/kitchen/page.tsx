"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  ChefHat,
  Clock,
  CheckCircle,
  Flame,
  Bell,
  Maximize,
  Minimize,
  Filter,
  Loader2,
  RefreshCw,
  UtensilsCrossed,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/utils/currency";

interface SaleItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  notes?: string;
}

interface KitchenOrder {
  id: string;
  sale_number: string;
  kitchen_status: "new" | "preparing" | "ready" | "completed";
  order_type?: string;
  total_amount: number;
  notes?: string;
  created_at: string;
  items: SaleItem[];
}

const STATUS_CONFIG = {
  new: {
    label: "New",
    color: "border-red-500 bg-red-50",
    badge: "bg-red-100 text-red-700",
    icon: Flame,
  },
  preparing: {
    label: "Preparing",
    color: "border-yellow-500 bg-yellow-50",
    badge: "bg-yellow-100 text-yellow-700",
    icon: ChefHat,
  },
  ready: {
    label: "Ready",
    color: "border-green-500 bg-green-50",
    badge: "bg-green-100 text-green-700",
    icon: CheckCircle,
  },
  completed: {
    label: "Completed",
    color: "border-gray-300 bg-gray-50",
    badge: "bg-gray-100 text-gray-700",
    icon: CheckCircle,
  },
};

const NEXT_STATUS: Record<string, string> = {
  new: "preparing",
  preparing: "ready",
  ready: "completed",
};

function getElapsedTime(createdAt: string): string {
  const diff = Date.now() - new Date(createdAt).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m ago`;
}

export default function KitchenPage() {
  const { token } = useAuth();
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevCountRef = useRef(0);

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }),
    [token]
  );

  const fetchOrders = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/sales?kitchen=true", { headers });
      const data = await res.json();
      const newOrders: KitchenOrder[] = data.sales || [];

      // Play sound on new orders
      const newCount = newOrders.filter(
        (o) => o.kitchen_status === "new"
      ).length;
      if (newCount > prevCountRef.current && prevCountRef.current >= 0) {
        try {
          if (!audioRef.current) {
            audioRef.current = new Audio(
              "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2JkY+Ff3V9hoyRjYN7c3uDi5GQiIF4cHmBipCRi4R7c3yEjZKSiYF5c3yEjZKSiYF5c3yEjQ=="
            );
          }
          audioRef.current.play().catch(() => {});
        } catch {
          // Audio play failed, no problem
        }
      }
      prevCountRef.current = newCount;

      setOrders(newOrders);
    } catch (err) {
      console.error("Failed to load kitchen orders:", err);
    } finally {
      setLoading(false);
    }
  }, [token, headers]);

  // Initial fetch and auto-refresh every 10 seconds
  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const updateStatus = async (orderId: string, newStatus: string) => {
    if (updating) return;
    setUpdating(orderId);
    try {
      const res = await fetch(`/api/sales?id=${orderId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ kitchen_status: newStatus }),
      });
      if (!res.ok) throw new Error("Update failed");
      await fetchOrders();
    } catch (err) {
      console.error("Failed to update order:", err);
    } finally {
      setUpdating(null);
    }
  };

  const toggleFullscreen = () => {
    try {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
        setIsFullscreen(true);
      } else {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    } catch {
      // Fullscreen not supported
    }
  };

  // Listen for fullscreen change
  useEffect(() => {
    const handler = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const filteredOrders = useMemo(() => {
    if (!statusFilter) return orders;
    return orders.filter((o) => o.kitchen_status === statusFilter);
  }, [orders, statusFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      new: 0,
      preparing: 0,
      ready: 0,
    };
    for (const order of orders) {
      if (counts[order.kitchen_status] !== undefined) {
        counts[order.kitchen_status]++;
      }
    }
    return counts;
  }, [orders]);

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ChefHat className="w-6 h-6" />
            Kitchen Display
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {orders.length} active orders
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Status filter pills */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setStatusFilter(null)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                !statusFilter
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              All ({orders.length})
            </button>
            {(["new", "preparing", "ready"] as const).map((s) => {
              const conf = STATUS_CONFIG[s];
              return (
                <button
                  key={s}
                  onClick={() =>
                    setStatusFilter(statusFilter === s ? null : s)
                  }
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    statusFilter === s
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {conf.label} ({statusCounts[s]})
                </button>
              );
            })}
          </div>

          <button
            onClick={fetchOrders}
            className="p-2 border rounded-lg hover:bg-gray-50 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4 text-gray-600" />
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-2 border rounded-lg hover:bg-gray-50 transition-colors"
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? (
              <Minimize className="w-4 h-4 text-gray-600" />
            ) : (
              <Maximize className="w-4 h-4 text-gray-600" />
            )}
          </button>
        </div>
      </div>

      {/* Orders Grid */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <UtensilsCrossed className="w-12 h-12 mb-3" />
            <p className="text-lg font-medium">No kitchen orders</p>
            <p className="text-sm mt-1">
              {statusFilter
                ? "No orders with this status"
                : "Orders will appear here when placed"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredOrders.map((order) => {
              const config =
                STATUS_CONFIG[order.kitchen_status] || STATUS_CONFIG.new;
              const StatusIcon = config.icon;
              const nextStatus = NEXT_STATUS[order.kitchen_status];
              const elapsed = getElapsedTime(order.created_at);
              const isOld =
                Date.now() - new Date(order.created_at).getTime() > 900000; // 15 min

              return (
                <div
                  key={order.id}
                  className={`rounded-xl border-2 ${config.color} p-4 flex flex-col transition-all ${
                    isOld && order.kitchen_status === "new"
                      ? "animate-pulse"
                      : ""
                  }`}
                >
                  {/* Order header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-gray-900">
                        #{order.sale_number}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.badge}`}
                      >
                        <StatusIcon className="w-3 h-3 inline-block mr-1" />
                        {config.label}
                      </span>
                    </div>
                    {order.order_type && (
                      <span className="text-xs font-medium text-gray-500 bg-white px-2 py-0.5 rounded-full border">
                        {order.order_type === "dine_in"
                          ? "Dine In"
                          : "Takeaway"}
                      </span>
                    )}
                  </div>

                  {/* Time elapsed */}
                  <div
                    className={`flex items-center gap-1.5 text-xs mb-3 ${
                      isOld ? "text-red-600 font-semibold" : "text-gray-500"
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    {elapsed}
                    {isOld && order.kitchen_status !== "ready" && (
                      <Bell className="w-3.5 h-3.5 text-red-500" />
                    )}
                  </div>

                  {/* Items */}
                  <div className="flex-1 space-y-1.5 mb-4">
                    {order.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start justify-between text-sm"
                      >
                        <div className="flex items-start gap-2">
                          <span className="font-bold text-gray-900 bg-white rounded px-1.5 py-0.5 text-xs min-w-[24px] text-center border">
                            {item.quantity}x
                          </span>
                          <span className="text-gray-800 font-medium">
                            {item.product_name}
                          </span>
                        </div>
                      </div>
                    ))}
                    {order.notes && (
                      <p className="text-xs text-gray-600 italic bg-white/50 rounded p-2 mt-2">
                        Note: {order.notes}
                      </p>
                    )}
                  </div>

                  {/* Action button */}
                  {nextStatus && (
                    <button
                      onClick={() => updateStatus(order.id, nextStatus)}
                      disabled={updating === order.id}
                      className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2 ${
                        order.kitchen_status === "new"
                          ? "bg-yellow-500 text-white hover:bg-yellow-600"
                          : order.kitchen_status === "preparing"
                          ? "bg-green-600 text-white hover:bg-green-700"
                          : "bg-gray-600 text-white hover:bg-gray-700"
                      } disabled:opacity-50`}
                    >
                      {updating === order.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          {order.kitchen_status === "new" && (
                            <>
                              <ChefHat className="w-4 h-4" />
                              Start Preparing
                            </>
                          )}
                          {order.kitchen_status === "preparing" && (
                            <>
                              <CheckCircle className="w-4 h-4" />
                              Mark Ready
                            </>
                          )}
                          {order.kitchen_status === "ready" && (
                            <>
                              <CheckCircle className="w-4 h-4" />
                              Complete
                            </>
                          )}
                        </>
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
