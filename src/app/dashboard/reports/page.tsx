"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  BarChart3,
  DollarSign,
  ShoppingBag,
  TrendingUp,
  Award,
  Loader2,
  Calendar,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/utils/currency";

interface ReportData {
  summary: {
    total_revenue: number;
    total_orders: number;
    average_order: number;
    total_profit: number;
  };
  daily_sales: Array<{
    date: string;
    revenue: number;
    orders: number;
  }>;
  payment_methods: Array<{
    method: string;
    count: number;
    total: number;
  }>;
  top_products: Array<{
    product_name: string;
    quantity_sold: number;
    revenue: number;
  }>;
}

export default function ReportsPage() {
  const { token } = useAuth();
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }),
    [token]
  );

  const fetchReport = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("start_date", startDate);
      if (endDate) params.set("end_date", endDate);

      const res = await fetch(`/api/reports?${params}`, { headers });
      const data = await res.json();
      setReport(data);
    } catch (err) {
      console.error("Failed to load reports:", err);
    } finally {
      setLoading(false);
    }
  }, [token, headers, startDate, endDate]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const maxDailyRevenue = useMemo(() => {
    if (!report?.daily_sales?.length) return 0;
    return Math.max(...report.daily_sales.map((d) => d.revenue), 1);
  }, [report]);

  const paymentLabel = (method: string) => {
    const labels: Record<string, string> = {
      cash: "Cash",
      mobile_money: "Mobile Money",
      card: "Card",
      qr: "QR Code",
      split: "Split",
    };
    return labels[method] || method;
  };

  const paymentColor = (method: string) => {
    const colors: Record<string, string> = {
      cash: "bg-green-500",
      mobile_money: "bg-blue-500",
      card: "bg-purple-500",
      qr: "bg-orange-500",
      split: "bg-gray-500",
    };
    return colors[method] || "bg-gray-400";
  };

  const totalPaymentAmount = useMemo(() => {
    if (!report?.payment_methods?.length) return 1;
    return report.payment_methods.reduce((s, p) => s + p.total, 0) || 1;
  }, [report]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const summary = report?.summary || {
    total_revenue: 0,
    total_orders: 0,
    average_order: 0,
    total_profit: 0,
  };

  const topProduct =
    report?.top_products?.[0]?.product_name || "N/A";

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500 mt-1">
            Business analytics and performance overview
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <span className="text-gray-400">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Revenue</p>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(summary.total_revenue)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Orders</p>
              <p className="text-xl font-bold text-gray-900">
                {summary.total_orders}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Avg. Order</p>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(summary.average_order)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Award className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Top Product</p>
              <p className="text-lg font-bold text-gray-900 truncate max-w-[160px]">
                {topProduct}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Sales Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-gray-400" />
            Daily Sales
          </h2>
          {report?.daily_sales?.length ? (
            <div className="space-y-0">
              {/* Y-axis labels */}
              <div className="flex items-end gap-1" style={{ height: 220 }}>
                {report.daily_sales.map((day, i) => {
                  const height =
                    maxDailyRevenue > 0
                      ? (day.revenue / maxDailyRevenue) * 100
                      : 0;
                  return (
                    <div
                      key={i}
                      className="flex-1 flex flex-col items-center justify-end group relative"
                      style={{ height: "100%" }}
                    >
                      {/* Tooltip */}
                      <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                        <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg">
                          <p className="font-medium">
                            {formatCurrency(day.revenue)}
                          </p>
                          <p className="text-gray-300">
                            {day.orders} order{day.orders !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                      <div
                        className="w-full bg-green-500 rounded-t-sm min-h-[2px] transition-all hover:bg-green-600"
                        style={{ height: `${Math.max(height, 1)}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              {/* X-axis labels */}
              <div className="flex gap-1 mt-2 overflow-hidden">
                {report.daily_sales.map((day, i) => {
                  // Show every nth label to avoid clutter
                  const showLabel =
                    report.daily_sales!.length <= 14 ||
                    i % Math.ceil(report.daily_sales!.length / 7) === 0;
                  return (
                    <div
                      key={i}
                      className="flex-1 text-center text-xs text-gray-400 truncate"
                    >
                      {showLabel
                        ? new Date(day.date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })
                        : ""}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-gray-400">
              <p className="text-sm">No sales data for this period</p>
            </div>
          )}
        </div>

        {/* Payment Method Breakdown */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Payment Methods
          </h2>
          {report?.payment_methods?.length ? (
            <div className="space-y-4">
              {report.payment_methods.map((pm) => {
                const pct = (pm.total / totalPaymentAmount) * 100;
                return (
                  <div key={pm.method}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-gray-700">
                        {paymentLabel(pm.method)}
                      </span>
                      <span className="text-sm text-gray-500">
                        {formatCurrency(pm.total)} ({pm.count})
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${paymentColor(
                          pm.method
                        )}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-gray-400">
              <p className="text-sm">No payment data</p>
            </div>
          )}
        </div>
      </div>

      {/* Top Products */}
      {report?.top_products?.length ? (
        <div className="bg-white rounded-xl border p-6 mt-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Top Selling Products
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left px-4 py-2 font-medium text-gray-600">
                    #
                  </th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">
                    Product
                  </th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">
                    Qty Sold
                  </th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">
                    Revenue
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {report.top_products.map((p, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-900">
                      {p.product_name}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-600">
                      {p.quantity_sold}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-gray-900">
                      {formatCurrency(p.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
