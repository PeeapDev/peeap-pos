"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Package,
  Loader2,
  AlertTriangle,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/utils/currency";
import Modal from "@/components/ui/Modal";
import ImageEnhancer from "@/components/ui/ImageEnhancer";

interface Category {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  barcode: string | null;
  price: number;
  cost_price: number;
  category_id: string | null;
  category: Category | null;
  image_url: string | null;
  track_inventory: boolean;
  stock_quantity: number;
  is_active: boolean;
  is_published: boolean;
  slug: string | null;
  seo_title: string | null;
  seo_description: string | null;
  created_at: string;
}

const emptyForm = {
  name: "",
  description: "",
  price: 0,
  cost_price: 0,
  sku: "",
  barcode: "",
  category_id: "",
  image_url: "",
  track_inventory: false,
  stock_quantity: 0,
  is_published: false,
  slug: "",
  seo_title: "",
  seo_description: "",
};

export default function ProductsPage() {
  const { token } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [enhancerOpen, setEnhancerOpen] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }),
    [token]
  );

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [prodRes, catRes] = await Promise.all([
        fetch(`/api/products?active=false`, { headers }),
        fetch("/api/categories", { headers }),
      ]);
      const prodData = await prodRes.json();
      const catData = await catRes.json();
      setProducts(prodData.products || []);
      setCategories(catData.categories || []);
    } catch (err) {
      console.error("Failed to load products:", err);
    } finally {
      setLoading(false);
    }
  }, [token, headers]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => {
    let list = products;
    if (categoryFilter) {
      list = list.filter((p) => p.category_id === categoryFilter);
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
  }, [products, categoryFilter, search]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditing(product);
    setForm({
      name: product.name,
      description: product.description || "",
      price: product.price,
      cost_price: product.cost_price || 0,
      sku: product.sku || "",
      barcode: product.barcode || "",
      category_id: product.category_id || "",
      image_url: product.image_url || "",
      track_inventory: product.track_inventory,
      stock_quantity: product.stock_quantity || 0,
      is_published: product.is_published,
      slug: product.slug || "",
      seo_title: product.seo_title || "",
      seo_description: product.seo_description || "",
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        price: Number(form.price),
        cost_price: Number(form.cost_price),
        track_inventory: form.track_inventory,
        stock_quantity: Number(form.stock_quantity),
        is_published: form.is_published,
      };
      if (form.description) body.description = form.description;
      if (form.sku) body.sku = form.sku;
      if (form.barcode) body.barcode = form.barcode;
      if (form.category_id) body.category_id = form.category_id;
      if (form.image_url) body.image_url = form.image_url;
      if (form.slug) body.slug = form.slug;
      if (form.seo_title) body.seo_title = form.seo_title;
      if (form.seo_description) body.seo_description = form.seo_description;

      const url = editing ? `/api/products?id=${editing.id}` : "/api/products";
      const method = editing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");

      setModalOpen(false);
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/products?id=${deleteTarget.id}`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok) throw new Error("Delete failed");
      setDeleteTarget(null);
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete product");
    }
  };

  const updateField = (field: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-sm text-gray-500 mt-1">
            {products.length} products total
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Product
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Package className="w-12 h-12 mx-auto mb-3" />
            <p className="font-medium">No products found</p>
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
                    SKU
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">
                    Price
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">
                    Stock
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Category
                  </th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">
                    Status
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((product) => (
                  <tr
                    key={product.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">
                        {product.name}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {product.sku || "-"}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatCurrency(product.price)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {product.track_inventory ? (
                        <span
                          className={
                            product.stock_quantity <= 5
                              ? "text-red-600 font-medium"
                              : "text-gray-700"
                          }
                        >
                          {product.stock_quantity}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {product.category?.name || "-"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          product.is_active
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {product.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {product.image_url && (
                          <button
                            onClick={() => {
                              openEdit(product);
                              setTimeout(() => setEnhancerOpen(true), 100);
                            }}
                            className="p-1.5 hover:bg-purple-50 rounded-lg text-gray-500 hover:text-purple-600"
                            title="AI Enhance Image"
                          >
                            <Sparkles className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => openEdit(product)}
                          className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(product)}
                          className="p-1.5 hover:bg-red-50 rounded-lg text-gray-500 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Product" : "Add Product"}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Product Name *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="e.g. Coca Cola 500ml"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            {/* Product Image */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Product Image
              </label>
              <div className="flex items-start gap-4">
                {/* Image preview */}
                <div className="w-24 h-24 rounded-lg border bg-gray-50 overflow-hidden flex items-center justify-center shrink-0">
                  {form.image_url ? (
                    <img
                      src={form.image_url}
                      alt="Product"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package className="w-8 h-8 text-gray-300" />
                  )}
                </div>

                <div className="flex-1 space-y-2">
                  {/* URL input */}
                  <input
                    type="url"
                    value={form.image_url}
                    onChange={(e) => updateField("image_url", e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="https://example.com/image.jpg"
                  />

                  <div className="flex items-center gap-2">
                    {/* File upload */}
                    <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                      <Upload className="w-3.5 h-3.5" />
                      Upload
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file || !token) return;
                          setUploadingImage(true);
                          try {
                            // Show instant blob preview
                            const previewUrl = URL.createObjectURL(file);
                            updateField("image_url", previewUrl);

                            // Upload to Cloudflare Images
                            const formData = new FormData();
                            formData.append("file", file);
                            const res = await fetch("/api/upload", {
                              method: "POST",
                              headers: { Authorization: `Bearer ${token}` },
                              body: formData,
                            });
                            const data = await res.json();
                            if (res.ok && data.url) {
                              updateField("image_url", data.url);
                              URL.revokeObjectURL(previewUrl);
                            } else {
                              console.error("Upload failed:", data.error);
                              // Keep blob preview — user can still paste URL manually
                            }
                          } catch (err) {
                            console.error("Upload error:", err);
                          } finally {
                            setUploadingImage(false);
                          }
                        }}
                      />
                    </label>

                    {/* AI Enhance button */}
                    {form.image_url && (
                      <button
                        type="button"
                        onClick={() => setEnhancerOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        AI Enhance
                      </button>
                    )}

                    {/* Clear image */}
                    {form.image_url && (
                      <button
                        type="button"
                        onClick={() => updateField("image_url", "")}
                        className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                        title="Remove image"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {uploadingImage && (
                      <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Selling Price *
              </label>
              <input
                type="number"
                value={form.price}
                onChange={(e) => updateField("price", parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                min="0"
                step="0.01"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cost Price
              </label>
              <input
                type="number"
                value={form.cost_price}
                onChange={(e) =>
                  updateField("cost_price", parseFloat(e.target.value) || 0)
                }
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                min="0"
                step="0.01"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                SKU
              </label>
              <input
                type="text"
                value={form.sku}
                onChange={(e) => updateField("sku", e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="e.g. CC-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Barcode
              </label>
              <input
                type="text"
                value={form.barcode}
                onChange={(e) => updateField("barcode", e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={form.category_id}
                onChange={(e) => updateField("category_id", e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">No Category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Stock Quantity
              </label>
              <input
                type="number"
                value={form.stock_quantity}
                onChange={(e) =>
                  updateField("stock_quantity", parseInt(e.target.value) || 0)
                }
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                min="0"
              />
            </div>

            <div className="col-span-2 flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.track_inventory}
                  onChange={(e) =>
                    updateField("track_inventory", e.target.checked)
                  }
                  className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                <span className="text-sm text-gray-700">Track Inventory</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_published}
                  onChange={(e) =>
                    updateField("is_published", e.target.checked)
                  }
                  className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                <span className="text-sm text-gray-700">
                  Publish to Online Store
                </span>
              </label>
            </div>
          </div>

          {/* SEO Section */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              SEO & Online Store
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL Slug
                </label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => updateField("slug", e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="coca-cola-500ml"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SEO Title
                </label>
                <input
                  type="text"
                  value={form.seo_title}
                  onChange={(e) => updateField("seo_title", e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  maxLength={160}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SEO Description
                </label>
                <textarea
                  value={form.seo_description}
                  onChange={(e) =>
                    updateField("seo_description", e.target.value)
                  }
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  maxLength={320}
                />
              </div>
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
              disabled={saving || !form.name}
              className="px-6 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editing ? "Update" : "Create"} Product
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Product"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-gray-700">
                Are you sure you want to delete{" "}
                <span className="font-semibold">{deleteTarget?.name}</span>?
                This action cannot be undone.
              </p>
            </div>
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
              Delete
            </button>
          </div>
        </div>
      </Modal>

      {/* AI Image Enhancer */}
      {enhancerOpen && form.image_url && (
        <ImageEnhancer
          imageUrl={form.image_url}
          productName={form.name || undefined}
          onEnhanced={(newUrl) => {
            updateField("image_url", newUrl);
            setEnhancerOpen(false);
          }}
          onClose={() => setEnhancerOpen(false)}
        />
      )}
    </div>
  );
}
