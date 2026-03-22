"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  DollarSign,
  ShoppingBag,
  ShoppingCart,
  Package,
  AlertTriangle,
  Star,
  Plus,
  ExternalLink,
  TrendingUp,
  Clock,
} from "lucide-react";

interface OverviewData {
  today: {
    revenue: number;
    online_revenue: number;
    pos_revenue: number;
    online_orders: number;
    pos_sales: number;
  };
  pending_orders: Array<{
    id: string;
    order_number: string;
    customer_name: string;
    total_amount: number;
    created_at: string;
  }>;
  low_stock: Array<{
    id: string;
    name: string;
    stock_quantity: number;
    low_stock_threshold: number;
  }>;
  totals: {
    products: number;
    customers: number;
  };
  revenue_chart: Array<{ date: string; amount: number }>;
  recent_reviews: Array<{
    id: string;
    customer_name: string;
    rating: number;
    review_text: string;
    product: { name: string } | null;
    created_at: string;
  }>;
  store: {
    name: string;
    slug: string;
    average_rating: number;
    total_ratings: number;
    total_orders: number;
    total_revenue: number;
    is_published: boolean;
  } | null;
}

function formatCurrency(amount: number): string {
  return `NLe ${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return d.toLocaleDateString();
}

export default function DashboardOverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOverview() {
      try {
        const token = document.cookie
          .split("; ")
          .find((row) => row.startsWith("auth_token="))
          ?.split("=")[1];

        const res = await fetch("/api/dashboard/overview", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          setData(await res.json());
        }
      } catch (err) {
        console.error("Failed to load dashboard:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchOverview();
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 bg-gray-200 rounded-xl" />
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  const overview = data;

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {overview?.store?.name || "Store Overview"}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <div className="flex gap-2">
          {overview?.store?.slug && (
            <a
              href={`/shop/${overview.store.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
            >
              <ExternalLink className="w-4 h-4" />
              View Store
            </a>
          )}
          <Link
            href="/dashboard/products"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </Link>
        </div>
      </div>

      {/* Pending orders alert */}
      {overview?.pending_orders && overview.pending_orders.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-amber-700 font-medium mb-2">
            <Clock className="w-4 h-4" />
            {overview.pending_orders.length} order{overview.pending_orders.length > 1 ? "s" : ""} need{overview.pending_orders.length === 1 ? "s" : ""} attention
          </div>
          <div className="space-y-2">
            {overview.pending_orders.slice(0, 3).map((order) => (
              <Link
                key={order.id}
                href="/dashboard/orders"
                className="flex items-center justify-between text-sm text-amber-800 hover:bg-amber-100 rounded-lg px-3 py-1.5 -mx-1"
              >
                <span>
                  <span className="font-mono font-medium">{order.order_number}</span>
                  {" "}from {order.customer_name}
                </span>
                <span className="font-medium">
                  {formatCurrency(order.total_amount)} &middot; {formatTime(order.created_at)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Metrics cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 border">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500">Today&apos;s Revenue</span>
            <DollarSign className="w-4 h-4 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(overview?.today?.revenue || 0)}
          </p>
          <div className="mt-1 flex gap-3 text-xs text-gray-500">
            <span>Online: {formatCurrency(overview?.today?.online_revenue || 0)}</span>
            <span>POS: {formatCurrency(overview?.today?.pos_revenue || 0)}</span>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500">Online Orders</span>
            <ShoppingBag className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {overview?.today?.online_orders || 0}
          </p>
          <p className="mt-1 text-xs text-gray-500">today</p>
        </div>

        <div className="bg-white rounded-xl p-5 border">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500">POS Sales</span>
            <ShoppingCart className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {overview?.today?.pos_sales || 0}
          </p>
          <p className="mt-1 text-xs text-gray-500">today</p>
        </div>

        <div className="bg-white rounded-xl p-5 border">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500">Products</span>
            <Package className="w-4 h-4 text-orange-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {overview?.totals?.products || 0}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {overview?.totals?.customers || 0} customers
          </p>
        </div>
      </div>

      {/* Revenue chart + Alerts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 7-day revenue chart */}
        <div className="bg-white rounded-xl p-5 border lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              7-Day Revenue
            </h3>
            <span className="text-sm text-gray-500">
              Total: {formatCurrency(
                (overview?.revenue_chart || []).reduce((s, d) => s + d.amount, 0)
              )}
            </span>
          </div>
          <div className="flex items-end gap-2 h-40">
            {(overview?.revenue_chart || []).map((day) => {
              const max = Math.max(
                ...(overview?.revenue_chart || []).map((d) => d.amount),
                1
              );
              const height = Math.max((day.amount / max) * 100, 4);
              const dayName = new Date(day.date + "T12:00:00").toLocaleDateString("en-US", {
                weekday: "short",
              });

              return (
                <div
                  key={day.date}
                  className="flex-1 flex flex-col items-center gap-1"
                >
                  <span className="text-[10px] text-gray-500">
                    {day.amount > 0 ? formatCurrency(day.amount) : ""}
                  </span>
                  <div
                    className="w-full bg-green-500 rounded-t-md min-h-[4px] transition-all"
                    style={{ height: `${height}%` }}
                  />
                  <span className="text-[10px] text-gray-500">{dayName}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Low stock alerts */}
        <div className="bg-white rounded-xl p-5 border">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Low Stock
          </h3>
          {overview?.low_stock && overview.low_stock.length > 0 ? (
            <div className="space-y-3">
              {overview.low_stock.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-gray-700 truncate flex-1">
                    {item.name}
                  </span>
                  <span
                    className={`font-medium ml-2 ${
                      item.stock_quantity === 0
                        ? "text-red-600"
                        : "text-amber-600"
                    }`}
                  >
                    {item.stock_quantity === 0
                      ? "Out of stock"
                      : `${item.stock_quantity} left`}
                  </span>
                </div>
              ))}
              <Link
                href="/dashboard/inventory"
                className="text-sm text-green-600 hover:text-green-700 font-medium"
              >
                Manage Inventory →
              </Link>
            </div>
          ) : (
            <p className="text-sm text-gray-500">All products are well-stocked.</p>
          )}
        </div>
      </div>

      {/* Recent reviews + Quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent reviews */}
        <div className="bg-white rounded-xl p-5 border">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <Star className="w-4 h-4 text-yellow-500" />
            Recent Reviews
          </h3>
          {overview?.recent_reviews && overview.recent_reviews.length > 0 ? (
            <div className="space-y-3">
              {overview.recent_reviews.map((review) => (
                <div key={review.id} className="text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">
                      {review.customer_name}
                    </span>
                    <span className="text-yellow-500">
                      {"★".repeat(review.rating)}
                      {"☆".repeat(5 - review.rating)}
                    </span>
                  </div>
                  {review.product && (
                    <p className="text-xs text-gray-500">
                      on {review.product.name}
                    </p>
                  )}
                  {review.review_text && (
                    <p className="text-gray-600 mt-1 line-clamp-2">
                      {review.review_text}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No reviews yet.</p>
          )}
        </div>

        {/* Quick actions */}
        <div className="bg-white rounded-xl p-5 border">
          <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/dashboard/products"
              className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center">
                <Plus className="w-4 h-4 text-green-600" />
              </div>
              <span className="text-sm font-medium text-gray-700">
                Add Product
              </span>
            </Link>
            <Link
              href="/dashboard/orders"
              className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-gray-700">
                View Orders
              </span>
            </Link>
            <Link
              href="/dashboard/terminal"
              className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center">
                <ShoppingCart className="w-4 h-4 text-purple-600" />
              </div>
              <span className="text-sm font-medium text-gray-700">
                Open POS
              </span>
            </Link>
            {overview?.store?.slug && (
              <a
                href={`/shop/${overview.store.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 transition-colors"
              >
                <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center">
                  <ExternalLink className="w-4 h-4 text-orange-600" />
                </div>
                <span className="text-sm font-medium text-gray-700">
                  View Store
                </span>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
