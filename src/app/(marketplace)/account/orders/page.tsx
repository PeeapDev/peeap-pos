"use client";

import { useEffect, useState } from "react";
import { ShoppingBag, Package, ExternalLink } from "lucide-react";

interface Order {
  id: string;
  order_number: string;
  total_amount: number;
  status: string;
  created_at: string;
  items: Array<{ product_name: string; quantity: number; total_price: number }>;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  paid: "bg-blue-100 text-blue-700",
  processing: "bg-purple-100 text-purple-700",
  shipped: "bg-indigo-100 text-indigo-700",
  delivered: "bg-green-100 text-green-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Customer order history requires auth — for now show empty state
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Orders</h1>

      {orders.length > 0 ? (
        <div className="space-y-3">
          {orders.map((order) => (
            <div
              key={order.id}
              className="bg-white border rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-sm font-medium text-gray-900">
                  {order.order_number}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    statusColors[order.status] || "bg-gray-100 text-gray-700"
                  }`}
                >
                  {order.status}
                </span>
              </div>
              <div className="text-sm text-gray-500">
                {order.items.map((item, i) => (
                  <span key={i}>
                    {item.product_name} x{item.quantity}
                    {i < order.items.length - 1 ? ", " : ""}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between mt-2 text-sm">
                <span className="text-gray-400">
                  {new Date(order.created_at).toLocaleDateString()}
                </span>
                <span className="font-medium text-gray-900">
                  NLe {order.total_amount.toLocaleString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-gray-900">No orders yet</h2>
          <p className="text-sm text-gray-500 mt-1">
            Your order history will appear here after your first purchase
          </p>
        </div>
      )}
    </div>
  );
}
