"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Settings,
  Building2,
  Receipt,
  Percent,
  FolderTree,
  Save,
  Loader2,
  Plus,
  Edit2,
  Trash2,
  Check,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import Modal from "@/components/ui/Modal";

type TabKey = "business" | "tax" | "receipt" | "categories";

interface Category {
  id: string;
  name: string;
  description: string | null;
  color: string;
  sort_order: number;
  is_active: boolean;
}

const tabs: { key: TabKey; label: string; icon: typeof Settings }[] = [
  { key: "business", label: "Business Info", icon: Building2 },
  { key: "tax", label: "Tax", icon: Percent },
  { key: "receipt", label: "Receipt", icon: Receipt },
  { key: "categories", label: "Categories", icon: FolderTree },
];

export default function SettingsPage() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>("business");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Business info
  const [storeName, setStoreName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  // Tax
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxRate, setTaxRate] = useState(0);
  const [taxInclusive, setTaxInclusive] = useState(false);

  // Receipt
  const [receiptHeader, setReceiptHeader] = useState("");
  const [receiptFooter, setReceiptFooter] = useState("");
  const [showLogo, setShowLogo] = useState(true);
  const [autoPrint, setAutoPrint] = useState(false);

  // Categories
  const [categories, setCategories] = useState<Category[]>([]);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [catName, setCatName] = useState("");
  const [catDescription, setCatDescription] = useState("");
  const [catColor, setCatColor] = useState("#3B82F6");
  const [catSaving, setCatSaving] = useState(false);

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }),
    [token]
  );

  const fetchSettings = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [settingsRes, catRes] = await Promise.all([
        fetch("/api/settings", { headers }),
        fetch("/api/categories", { headers }),
      ]);
      const settingsData = await settingsRes.json();
      const catData = await catRes.json();

      const s = settingsData.settings || settingsData;
      if (s) {
        setStoreName(s.store_name || "");
        setAddress(s.address || "");
        setPhone(s.phone || "");
        setEmail(s.email || "");
        setTaxEnabled(s.tax_rate > 0);
        setTaxRate(s.tax_rate || 0);
        setTaxInclusive(s.tax_inclusive || false);
        setReceiptHeader(s.receipt_header || "");
        setReceiptFooter(s.receipt_footer || "");
        setShowLogo(s.receipt_show_logo !== false);
        setAutoPrint(s.auto_print_receipt || false);
      }
      setCategories(catData.categories || []);
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setLoading(false);
    }
  }, [token, headers]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const saveSettings = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const body: Record<string, unknown> = {};
      if (activeTab === "business") {
        body.store_name = storeName;
        // address, phone, email stored as part of settings or store
      }
      if (activeTab === "tax") {
        body.tax_rate = taxEnabled ? Number(taxRate) : 0;
        body.tax_inclusive = taxInclusive;
      }
      if (activeTab === "receipt") {
        body.receipt_header = receiptHeader;
        body.receipt_footer = receiptFooter;
        body.receipt_show_logo = showLogo;
        body.auto_print_receipt = autoPrint;
      }

      const res = await fetch("/api/settings", {
        method: "PUT",
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Save failed");
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const openAddCategory = () => {
    setEditingCat(null);
    setCatName("");
    setCatDescription("");
    setCatColor("#3B82F6");
    setCatModalOpen(true);
  };

  const openEditCategory = (cat: Category) => {
    setEditingCat(cat);
    setCatName(cat.name);
    setCatDescription(cat.description || "");
    setCatColor(cat.color || "#3B82F6");
    setCatModalOpen(true);
  };

  const saveCategory = async () => {
    setCatSaving(true);
    try {
      const body = {
        name: catName,
        description: catDescription || undefined,
        color: catColor,
      };

      const url = editingCat
        ? `/api/categories?id=${editingCat.id}`
        : "/api/categories";
      const method = editingCat ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Save failed");
      }
      setCatModalOpen(false);
      fetchSettings();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save category");
    } finally {
      setCatSaving(false);
    }
  };

  const deleteCategory = async (id: string) => {
    if (!confirm("Delete this category?")) return;
    try {
      const res = await fetch(`/api/categories?id=${id}`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok) throw new Error("Delete failed");
      fetchSettings();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete category");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure your POS system
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border p-6">
        {/* Business Info */}
        {activeTab === "business" && (
          <div className="space-y-5 max-w-xl">
            <h2 className="text-lg font-semibold text-gray-900">
              Business Information
            </h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Business Name
              </label>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="My Store"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="123 Main Street"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="+232 XX XXX XXX"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="store@example.com"
                />
              </div>
            </div>

            <button
              onClick={saveSettings}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : saved ? (
                <Check className="w-4 h-4" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saved ? "Saved!" : "Save Changes"}
            </button>
          </div>
        )}

        {/* Tax */}
        {activeTab === "tax" && (
          <div className="space-y-5 max-w-xl">
            <h2 className="text-lg font-semibold text-gray-900">
              Tax Settings
            </h2>

            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setTaxEnabled(!taxEnabled)}
                className={`w-11 h-6 rounded-full transition-colors cursor-pointer flex items-center ${
                  taxEnabled ? "bg-green-600 justify-end" : "bg-gray-300 justify-start"
                }`}
              >
                <div className="w-5 h-5 bg-white rounded-full shadow mx-0.5" />
              </div>
              <span className="text-sm font-medium text-gray-700">
                Enable Tax
              </span>
            </label>

            {taxEnabled && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tax Rate (%)
                  </label>
                  <input
                    type="number"
                    value={taxRate}
                    onChange={(e) =>
                      setTaxRate(parseFloat(e.target.value) || 0)
                    }
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    min="0"
                    max="100"
                    step="0.1"
                  />
                </div>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={taxInclusive}
                    onChange={(e) => setTaxInclusive(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <span className="text-sm text-gray-700">
                    Prices include tax (tax-inclusive pricing)
                  </span>
                </label>
              </>
            )}

            <button
              onClick={saveSettings}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : saved ? (
                <Check className="w-4 h-4" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saved ? "Saved!" : "Save Changes"}
            </button>
          </div>
        )}

        {/* Receipt */}
        {activeTab === "receipt" && (
          <div className="space-y-5 max-w-xl">
            <h2 className="text-lg font-semibold text-gray-900">
              Receipt Settings
            </h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Receipt Header
              </label>
              <textarea
                value={receiptHeader}
                onChange={(e) => setReceiptHeader(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Text that appears at the top of the receipt"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Receipt Footer
              </label>
              <textarea
                value={receiptFooter}
                onChange={(e) => setReceiptFooter(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Thank you for shopping with us!"
              />
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={showLogo}
                onChange={(e) => setShowLogo(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <span className="text-sm text-gray-700">
                Show logo on receipt
              </span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={autoPrint}
                onChange={(e) => setAutoPrint(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <span className="text-sm text-gray-700">
                Auto-print receipt after sale
              </span>
            </label>

            <button
              onClick={saveSettings}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : saved ? (
                <Check className="w-4 h-4" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saved ? "Saved!" : "Save Changes"}
            </button>
          </div>
        )}

        {/* Categories */}
        {activeTab === "categories" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Categories
              </h2>
              <button
                onClick={openAddCategory}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Category
              </button>
            </div>

            {categories.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <FolderTree className="w-10 h-10 mx-auto mb-3" />
                <p className="font-medium">No categories yet</p>
                <p className="text-sm mt-1">Create categories to organize products</p>
              </div>
            ) : (
              <div className="space-y-2">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {cat.name}
                        </p>
                        {cat.description && (
                          <p className="text-xs text-gray-500">
                            {cat.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditCategory(cat)}
                        className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteCategory(cat.id)}
                        className="p-1.5 hover:bg-red-50 rounded-lg text-gray-500 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Category Modal */}
      <Modal
        open={catModalOpen}
        onClose={() => setCatModalOpen(false)}
        title={editingCat ? "Edit Category" : "Add Category"}
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="e.g. Food & Drinks"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <input
              type="text"
              value={catDescription}
              onChange={(e) => setCatDescription(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Color
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={catColor}
                onChange={(e) => setCatColor(e.target.value)}
                className="w-10 h-10 rounded border cursor-pointer"
              />
              <input
                type="text"
                value={catColor}
                onChange={(e) => setCatColor(e.target.value)}
                className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setCatModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={saveCategory}
              disabled={catSaving || !catName}
              className="px-6 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {catSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingCat ? "Update" : "Create"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
