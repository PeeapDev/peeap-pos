"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Tag,
  Plus,
  Search,
  Edit2,
  Trash2,
  Loader2,
  AlertTriangle,
  Percent,
  DollarSign,
  Gift,
  Calendar,
  Copy,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/utils/currency";
import Modal from "@/components/ui/Modal";

interface Discount {
  id: string;
  name: string;
  code: string | null;
  type: "percentage" | "fixed";
  value: number;
  min_order_amount: number;
  max_discount_amount: number | null;
  usage_limit: number | null;
  usage_count: number;
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  applies_to: "all" | "category" | "product";
  created_at: string;
}

const TYPE_BADGES = {
  percentage: {
    color: "bg-blue-100 text-blue-700",
    icon: Percent,
  },
  fixed: {
    color: "bg-green-100 text-green-700",
    icon: DollarSign,
  },
};

function getDiscountStatus(discount: Discount): {
  label: string;
  color: string;
} {
  if (!discount.is_active) {
    return { label: "Inactive", color: "bg-gray-100 text-gray-600" };
  }

  const now = new Date();

  if (discount.starts_at && new Date(discount.starts_at) > now) {
    return { label: "Upcoming", color: "bg-yellow-100 text-yellow-700" };
  }

  if (discount.expires_at && new Date(discount.expires_at) < now) {
    return { label: "Expired", color: "bg-red-100 text-red-700" };
  }

  if (
    discount.usage_limit != null &&
    discount.usage_count >= discount.usage_limit
  ) {
    return { label: "Limit Reached", color: "bg-orange-100 text-orange-700" };
  }

  return { label: "Active", color: "bg-green-100 text-green-700" };
}

export default function DiscountsPage() {
  const { token } = useAuth();
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Discount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Discount | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState<"percentage" | "fixed">("percentage");
  const [value, setValue] = useState("");
  const [minPurchase, setMinPurchase] = useState("");
  const [maxDiscount, setMaxDiscount] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [usageLimit, setUsageLimit] = useState("");
  const [appliesTo, setAppliesTo] = useState<"all" | "category" | "product">(
    "all"
  );

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }),
    [token]
  );

  const fetchDiscounts = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch("/api/discounts?active=false", { headers });
      const data = await res.json();
      setDiscounts(data.discounts || []);
    } catch (err) {
      console.error("Failed to load discounts:", err);
    } finally {
      setLoading(false);
    }
  }, [token, headers]);

  useEffect(() => {
    fetchDiscounts();
  }, [fetchDiscounts]);

  const filteredDiscounts = useMemo(() => {
    if (!search.trim()) return discounts;
    const q = search.toLowerCase();
    return discounts.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        (d.code && d.code.toLowerCase().includes(q))
    );
  }, [discounts, search]);

  const openAdd = () => {
    setEditing(null);
    setName("");
    setCode("");
    setType("percentage");
    setValue("");
    setMinPurchase("");
    setMaxDiscount("");
    setStartsAt("");
    setExpiresAt("");
    setUsageLimit("");
    setAppliesTo("all");
    setModalOpen(true);
  };

  const openEdit = (discount: Discount) => {
    setEditing(discount);
    setName(discount.name);
    setCode(discount.code || "");
    setType(discount.type);
    setValue(discount.value.toString());
    setMinPurchase(
      discount.min_order_amount ? discount.min_order_amount.toString() : ""
    );
    setMaxDiscount(
      discount.max_discount_amount
        ? discount.max_discount_amount.toString()
        : ""
    );
    setStartsAt(
      discount.starts_at
        ? new Date(discount.starts_at).toISOString().slice(0, 16)
        : ""
    );
    setExpiresAt(
      discount.expires_at
        ? new Date(discount.expires_at).toISOString().slice(0, 16)
        : ""
    );
    setUsageLimit(
      discount.usage_limit != null ? discount.usage_limit.toString() : ""
    );
    setAppliesTo(discount.applies_to);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !value) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        type,
        value: parseFloat(value),
        applies_to: appliesTo,
      };

      if (code.trim()) body.code = code.trim();
      if (minPurchase) body.min_order_amount = parseFloat(minPurchase);
      if (maxDiscount) body.max_discount_amount = parseFloat(maxDiscount);
      if (startsAt) body.starts_at = new Date(startsAt).toISOString();
      if (expiresAt) body.expires_at = new Date(expiresAt).toISOString();
      if (usageLimit) body.usage_limit = parseInt(usageLimit);

      const url = editing
        ? `/api/discounts?id=${editing.id}`
        : "/api/discounts";
      const method = editing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");

      setModalOpen(false);
      fetchDiscounts();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save discount");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/discounts?id=${deleteTarget.id}`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok) throw new Error("Delete failed");
      setDeleteTarget(null);
      fetchDiscounts();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete discount");
    }
  };

  const copyCode = (discountCode: string) => {
    try {
      navigator.clipboard.writeText(discountCode);
    } catch {
      // Clipboard not available
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Tag className="w-6 h-6" />
            Discounts
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {discounts.length} discounts total
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Discount
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name or code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : filteredDiscounts.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Tag className="w-12 h-12 mx-auto mb-3" />
            <p className="font-medium">No discounts found</p>
            <p className="text-sm mt-1">
              {search
                ? "Try a different search"
                : "Create your first discount"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Name
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Code
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Type
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">
                    Value
                  </th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">
                    Usage
                  </th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Dates
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredDiscounts.map((discount) => {
                  const typeBadge = TYPE_BADGES[discount.type];
                  const TypeIcon = typeBadge.icon;
                  const status = getDiscountStatus(discount);

                  return (
                    <tr
                      key={discount.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">
                          {discount.name}
                        </p>
                        <p className="text-xs text-gray-400 capitalize">
                          Applies to: {discount.applies_to}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {discount.code ? (
                          <button
                            onClick={() => copyCode(discount.code!)}
                            className="flex items-center gap-1.5 px-2 py-1 bg-gray-100 rounded font-mono text-xs text-gray-700 hover:bg-gray-200 transition-colors"
                            title="Click to copy"
                          >
                            {discount.code}
                            <Copy className="w-3 h-3 text-gray-400" />
                          </button>
                        ) : (
                          <span className="text-gray-400">Auto</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${typeBadge.color}`}
                        >
                          <TypeIcon className="w-3 h-3" />
                          {discount.type.charAt(0).toUpperCase() +
                            discount.type.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {discount.type === "percentage"
                          ? `${discount.value}%`
                          : formatCurrency(discount.value)}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">
                        {discount.usage_count}
                        {discount.usage_limit != null
                          ? ` / ${discount.usage_limit}`
                          : ""}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-gray-500 space-y-0.5">
                          {discount.starts_at && (
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              From:{" "}
                              {new Date(
                                discount.starts_at
                              ).toLocaleDateString()}
                            </div>
                          )}
                          {discount.expires_at && (
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Until:{" "}
                              {new Date(
                                discount.expires_at
                              ).toLocaleDateString()}
                            </div>
                          )}
                          {!discount.starts_at && !discount.expires_at && (
                            <span className="text-gray-400">No date limit</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(discount)}
                            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(discount)}
                            className="p-1.5 hover:bg-red-50 rounded-lg text-gray-500 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Discount" : "Create Discount"}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="e.g. Summer Sale 20%"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Code
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="e.g. SUMMER20"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type
              </label>
              <select
                value={type}
                onChange={(e) =>
                  setType(e.target.value as "percentage" | "fixed")
                }
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Value *
              </label>
              <input
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder={type === "percentage" ? "e.g. 20" : "e.g. 50"}
                min="0"
                step={type === "percentage" ? "1" : "0.01"}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Min. Purchase Amount
              </label>
              <input
                type="number"
                value={minPurchase}
                onChange={(e) => setMinPurchase(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max. Discount Amount
              </label>
              <input
                type="number"
                value={maxDiscount}
                onChange={(e) => setMaxDiscount(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="No limit"
                min="0"
                step="0.01"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Usage Limit
              </label>
              <input
                type="number"
                value={usageLimit}
                onChange={(e) => setUsageLimit(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Unlimited"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Applies To
              </label>
              <select
                value={appliesTo}
                onChange={(e) =>
                  setAppliesTo(
                    e.target.value as "all" | "category" | "product"
                  )
                }
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="all">All Products</option>
                <option value="category">Specific Categories</option>
                <option value="product">Specific Products</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !name.trim() || !value}
              className="px-6 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editing ? "Update" : "Create"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Discount"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-gray-700">
              Are you sure you want to deactivate the discount{" "}
              <span className="font-semibold">{deleteTarget?.name}</span>?
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setDeleteTarget(null)}
              className="px-4 py-2 text-sm font-medium text-gray-700 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Deactivate
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
