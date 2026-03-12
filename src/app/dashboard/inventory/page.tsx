"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Boxes,
  Loader2,
  AlertTriangle,
  ArrowUpDown,
  Search,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/utils/currency";
import Modal from "@/components/ui/Modal";

interface Product {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  stock_quantity: number;
  low_stock_threshold: number;
  track_inventory: boolean;
  is_active: boolean;
}

type StockFilter = "all" | "low" | "out";

export default function InventoryPage() {
  const { token } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StockFilter>("all");
  const [search, setSearch] = useState("");
  const [adjustModal, setAdjustModal] = useState<Product | null>(null);
  const [adjustType, setAdjustType] = useState<"add" | "remove">("add");
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [saving, setSaving] = useState(false);

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }),
    [token]
  );

  const fetchProducts = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch("/api/products?active=false", { headers });
      const data = await res.json();
      const tracked = (data.products || []).filter(
        (p: Product) => p.track_inventory
      );
      setProducts(tracked);
    } catch (err) {
      console.error("Failed to load inventory:", err);
    } finally {
      setLoading(false);
    }
  }, [token, headers]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const filtered = useMemo(() => {
    let list = products;
    if (filter === "low") {
      list = list.filter(
        (p) =>
          p.stock_quantity > 0 &&
          p.stock_quantity <= p.low_stock_threshold
      );
    } else if (filter === "out") {
      list = list.filter((p) => p.stock_quantity <= 0);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.sku && p.sku.toLowerCase().includes(q))
      );
    }
    return list;
  }, [products, filter, search]);

  const stockStatus = (product: Product) => {
    if (product.stock_quantity <= 0) return "out";
    if (product.stock_quantity <= product.low_stock_threshold) return "low";
    return "ok";
  };

  const counts = useMemo(() => {
    const low = products.filter(
      (p) =>
        p.stock_quantity > 0 &&
        p.stock_quantity <= p.low_stock_threshold
    ).length;
    const out = products.filter((p) => p.stock_quantity <= 0).length;
    return { all: products.length, low, out };
  }, [products]);

  const openAdjust = (product: Product) => {
    setAdjustModal(product);
    setAdjustType("add");
    setAdjustQty("");
    setAdjustReason("");
  };

  const handleAdjust = async () => {
    if (!adjustModal || !adjustQty) return;
    setSaving(true);
    try {
      const qtyChange =
        adjustType === "add"
          ? parseInt(adjustQty)
          : -parseInt(adjustQty);

      const res = await fetch("/api/inventory", {
        method: "POST",
        headers,
        body: JSON.stringify({
          product_id: adjustModal.id,
          type: adjustType === "add" ? "restock" : "adjustment",
          quantity_change: qtyChange,
          reason: adjustReason || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Adjustment failed");
      }

      setAdjustModal(null);
      fetchProducts();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to adjust stock");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage stock levels for tracked products
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 mb-4">
        {(
          [
            { key: "all", label: "All", count: counts.all },
            { key: "low", label: "Low Stock", count: counts.low },
            { key: "out", label: "Out of Stock", count: counts.out },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === tab.key
                ? "bg-green-600 text-white"
                : "bg-white border text-gray-600 hover:bg-gray-50"
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span
                className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                  filter === tab.key
                    ? "bg-green-500 text-white"
                    : tab.key === "out"
                    ? "bg-red-100 text-red-600"
                    : tab.key === "low"
                    ? "bg-yellow-100 text-yellow-600"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}

        <div className="ml-auto relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Boxes className="w-12 h-12 mx-auto mb-3" />
            <p className="font-medium">No inventory items found</p>
            <p className="text-sm mt-1">
              Enable &ldquo;Track Inventory&rdquo; on products to manage stock
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Product
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    SKU
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">
                    Price
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">
                    Current Stock
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">
                    Threshold
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
                {filtered.map((product) => {
                  const status = stockStatus(product);
                  return (
                    <tr
                      key={product.id}
                      className={`transition-colors ${
                        status === "out"
                          ? "bg-red-50 hover:bg-red-100"
                          : status === "low"
                          ? "bg-yellow-50 hover:bg-yellow-100"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">
                          {product.name}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {product.sku || "-"}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {formatCurrency(product.price)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-semibold ${
                          status === "out"
                            ? "text-red-600"
                            : status === "low"
                            ? "text-yellow-600"
                            : "text-gray-900"
                        }`}
                      >
                        {product.stock_quantity}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500">
                        {product.low_stock_threshold}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {status === "out" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            <AlertTriangle className="w-3 h-3" />
                            Out of Stock
                          </span>
                        ) : status === "low" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                            <AlertTriangle className="w-3 h-3" />
                            Low Stock
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            In Stock
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openAdjust(product)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <ArrowUpDown className="w-3 h-3" />
                          Adjust
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

      {/* Adjust Stock Modal */}
      <Modal
        open={!!adjustModal}
        onClose={() => setAdjustModal(null)}
        title={`Adjust Stock - ${adjustModal?.name || ""}`}
        size="sm"
      >
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <p className="text-gray-500">
              Current stock:{" "}
              <span className="font-semibold text-gray-900">
                {adjustModal?.stock_quantity || 0}
              </span>
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setAdjustType("add")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                adjustType === "add"
                  ? "bg-green-600 text-white border-green-600"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              Add Stock
            </button>
            <button
              onClick={() => setAdjustType("remove")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                adjustType === "remove"
                  ? "bg-red-600 text-white border-red-600"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              Remove Stock
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quantity
            </label>
            <input
              type="number"
              value={adjustQty}
              onChange={(e) => setAdjustQty(e.target.value)}
              placeholder="0"
              min="1"
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason (optional)
            </label>
            <input
              type="text"
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              placeholder="e.g. Restock from supplier"
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {adjustQty && adjustModal && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
              New stock will be:{" "}
              <span className="font-semibold text-gray-900">
                {adjustType === "add"
                  ? (adjustModal.stock_quantity || 0) + parseInt(adjustQty || "0")
                  : Math.max(
                      0,
                      (adjustModal.stock_quantity || 0) -
                        parseInt(adjustQty || "0")
                    )}
              </span>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setAdjustModal(null)}
              className="px-4 py-2 text-sm font-medium text-gray-700 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleAdjust}
              disabled={saving || !adjustQty || parseInt(adjustQty) <= 0}
              className={`px-6 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
                adjustType === "add"
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-red-600 hover:bg-red-700"
              }`}
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {adjustType === "add" ? "Add" : "Remove"} Stock
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
