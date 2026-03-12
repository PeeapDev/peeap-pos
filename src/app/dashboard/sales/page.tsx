"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Receipt,
  Loader2,
  DollarSign,
  TrendingUp,
  ShoppingBag,
  Eye,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/utils/currency";
import Modal from "@/components/ui/Modal";

interface SaleItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  discount_amount: number;
}

interface Sale {
  id: string;
  sale_number: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  payment_method: string;
  payment_details: Record<string, unknown> | null;
  status: string;
  customer_name: string | null;
  notes: string | null;
  items: SaleItem[];
  created_at: string;
}

export default function SalesPage() {
  const { token } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [detailSale, setDetailSale] = useState<Sale | null>(null);

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }),
    [token]
  );

  const fetchSales = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (startDate) params.set("start_date", startDate);
      if (endDate) params.set("end_date", endDate + "T23:59:59");

      const res = await fetch(`/api/sales?${params}`, { headers });
      const data = await res.json();
      setSales(data.sales || []);
    } catch (err) {
      console.error("Failed to load sales:", err);
    } finally {
      setLoading(false);
    }
  }, [token, headers, startDate, endDate]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  const stats = useMemo(() => {
    const completed = sales.filter((s) => s.status === "completed");
    const totalRevenue = completed.reduce((s, sale) => s + sale.total_amount, 0);
    const totalOrders = completed.length;
    const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    return { totalRevenue, totalOrders, avgOrder };
  }, [sales]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const paymentLabel = (method: string) => {
    const labels: Record<string, string> = {
      cash: "Cash",
      mobile_money: "Mobile Money",
      card: "Card",
      qr: "QR Code",
      split: "Split Payment",
    };
    return labels[method] || method;
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales History</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track and review all transactions
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Revenue</p>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(stats.totalRevenue)}
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
              <p className="text-sm text-gray-500">Total Sales</p>
              <p className="text-xl font-bold text-gray-900">
                {stats.totalOrders}
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
                {formatCurrency(stats.avgOrder)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Date Filter */}
      <div className="flex items-center gap-3 mb-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            From
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            To
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        {(startDate || endDate) && (
          <button
            onClick={() => {
              setStartDate("");
              setEndDate("");
            }}
            className="mt-5 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            Clear
          </button>
        )}
      </div>

      {/* Sales Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : sales.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Receipt className="w-12 h-12 mx-auto mb-3" />
            <p className="font-medium">No sales yet</p>
            <p className="text-sm mt-1">
              Sales will appear here once you process transactions
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Sale #
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Date
                  </th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">
                    Items
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">
                    Total
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Payment
                  </th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">
                    Status
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sales.map((sale) => (
                  <tr
                    key={sale.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {sale.sale_number}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {formatDate(sale.created_at)}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700">
                      {sale.items?.length || 0}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {formatCurrency(sale.total_amount)}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {paymentLabel(sale.payment_method)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          sale.status === "completed"
                            ? "bg-green-100 text-green-700"
                            : sale.status === "refunded"
                            ? "bg-red-100 text-red-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {sale.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setDetailSale(sale)}
                        className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sale Detail Modal */}
      <Modal
        open={!!detailSale}
        onClose={() => setDetailSale(null)}
        title={`Sale ${detailSale?.sale_number || ""}`}
      >
        {detailSale && (
          <div className="space-y-4">
            <div className="flex justify-between text-sm text-gray-500">
              <span>{formatDate(detailSale.created_at)}</span>
              <span
                className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                  detailSale.status === "completed"
                    ? "bg-green-100 text-green-700"
                    : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {detailSale.status}
              </span>
            </div>

            {detailSale.customer_name && (
              <p className="text-sm text-gray-600">
                Customer: <span className="font-medium">{detailSale.customer_name}</span>
              </p>
            )}

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left px-3 py-2 font-medium text-gray-600">
                      Item
                    </th>
                    <th className="text-center px-3 py-2 font-medium text-gray-600">
                      Qty
                    </th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600">
                      Price
                    </th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {detailSale.items?.map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2 text-gray-900">
                        {item.product_name}
                      </td>
                      <td className="px-3 py-2 text-center text-gray-600">
                        {item.quantity}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-600">
                        {formatCurrency(item.unit_price)}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-gray-900">
                        {formatCurrency(item.total_price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal</span>
                <span>{formatCurrency(detailSale.subtotal)}</span>
              </div>
              {detailSale.tax_amount > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>Tax</span>
                  <span>{formatCurrency(detailSale.tax_amount)}</span>
                </div>
              )}
              {detailSale.discount_amount > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>Discount</span>
                  <span>-{formatCurrency(detailSale.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-gray-900 pt-1.5 border-t">
                <span>Total</span>
                <span>{formatCurrency(detailSale.total_amount)}</span>
              </div>
            </div>

            <div className="text-sm text-gray-500">
              Payment: {paymentLabel(detailSale.payment_method)}
            </div>

            {detailSale.notes && (
              <div className="text-sm text-gray-500">
                Notes: {detailSale.notes}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
