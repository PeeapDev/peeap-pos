"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  FolderTree,
  Package,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const CATEGORY_TEMPLATES = [
  { name: "Food", color: "#EF4444", description: "Food items and meals" },
  { name: "Drinks", color: "#3B82F6", description: "Beverages and drinks" },
  { name: "Electronics", color: "#8B5CF6", description: "Electronic devices and accessories" },
  { name: "Clothing", color: "#EC4899", description: "Apparel and fashion items" },
  { name: "General", color: "#6B7280", description: "General merchandise" },
];

const steps = [
  { label: "Business", icon: Building2 },
  { label: "Categories", icon: FolderTree },
  { label: "Product", icon: Package },
  { label: "Done", icon: CheckCircle },
];

export default function SetupPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Step 1: Business
  const [businessName, setBusinessName] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");

  // Step 2: Categories
  const [selectedCategories, setSelectedCategories] = useState<number[]>([
    0, 1, 4,
  ]);

  // Step 3: Product
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productCategory, setProductCategory] = useState(0);
  const [createdCategories, setCreatedCategories] = useState<
    Array<{ id: string; name: string }>
  >([]);

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }),
    [token]
  );

  const toggleCategory = (index: number) => {
    setSelectedCategories((prev) =>
      prev.includes(index)
        ? prev.filter((i) => i !== index)
        : [...prev, index]
    );
  };

  const handleStep1 = async () => {
    if (!businessName.trim()) {
      setError("Business name is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers,
        body: JSON.stringify({
          store_name: businessName,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save settings");
      }
      setStep(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleStep2 = async () => {
    if (selectedCategories.length === 0) {
      setError("Select at least one category");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const created: Array<{ id: string; name: string }> = [];
      for (const idx of selectedCategories) {
        const template = CATEGORY_TEMPLATES[idx];
        const res = await fetch("/api/categories", {
          method: "POST",
          headers,
          body: JSON.stringify({
            name: template.name,
            color: template.color,
            description: template.description,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          created.push({
            id: data.category.id,
            name: data.category.name,
          });
        }
      }
      setCreatedCategories(created);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create categories");
    } finally {
      setSaving(false);
    }
  };

  const handleStep3 = async () => {
    if (!productName.trim() || !productPrice) {
      setError("Product name and price are required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const body: Record<string, unknown> = {
        name: productName,
        price: parseFloat(productPrice),
      };
      if (createdCategories[productCategory]) {
        body.category_id = createdCategories[productCategory].id;
      }

      const res = await fetch("/api/products", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create product");
      }
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create product");
    } finally {
      setSaving(false);
    }
  };

  const goToTerminal = () => {
    router.push("/dashboard/terminal");
  };

  return (
    <div className="min-h-full flex items-center justify-center p-6">
      <div className="w-full max-w-xl">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((s, i) => {
            const Icon = s.icon;
            const isActive = i === step;
            const isDone = i < step;
            return (
              <div key={i} className="flex items-center gap-2">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                    isDone
                      ? "bg-green-600 text-white"
                      : isActive
                      ? "bg-green-100 text-green-700 ring-2 ring-green-600"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {isDone ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>
                {i < steps.length - 1 && (
                  <div
                    className={`w-12 h-0.5 ${
                      isDone ? "bg-green-600" : "bg-gray-200"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="bg-white rounded-2xl border shadow-sm p-8">
          {/* Step 1: Business Details */}
          {step === 0 && (
            <div className="space-y-5">
              <div className="text-center mb-2">
                <h2 className="text-xl font-bold text-gray-900">
                  Welcome to Peeap POS
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Let&apos;s set up your business in a few steps
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Business Name *
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="e.g. John's Mini Mart"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={businessAddress}
                  onChange={(e) => setBusinessAddress(e.target.value)}
                  className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="e.g. 15 Siaka Stevens Street, Freetown"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={businessPhone}
                  onChange={(e) => setBusinessPhone(e.target.value)}
                  className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="+232 XX XXX XXX"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}

              <button
                onClick={handleStep1}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {saving ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Continue
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          )}

          {/* Step 2: Categories */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="text-center mb-2">
                <h2 className="text-xl font-bold text-gray-900">
                  Choose Categories
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Select templates to organize your products
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {CATEGORY_TEMPLATES.map((cat, i) => {
                  const selected = selectedCategories.includes(i);
                  return (
                    <button
                      key={i}
                      onClick={() => toggleCategory(i)}
                      className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                        selected
                          ? "border-green-500 bg-green-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      {selected && (
                        <CheckCircle className="absolute top-2 right-2 w-5 h-5 text-green-600" />
                      )}
                      <div
                        className="w-6 h-6 rounded-full mb-2"
                        style={{ backgroundColor: cat.color }}
                      />
                      <p className="font-medium text-gray-900 text-sm">
                        {cat.name}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {cat.description}
                      </p>
                    </button>
                  );
                })}
              </div>

              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(0)}
                  className="flex items-center gap-2 px-4 py-3 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <button
                  onClick={handleStep2}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: First Product */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="text-center mb-2">
                <h2 className="text-xl font-bold text-gray-900">
                  Add Your First Product
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  You can always add more products later
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="e.g. Coca Cola 500ml"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Price (NLe) *
                </label>
                <input
                  type="number"
                  value={productPrice}
                  onChange={(e) => setProductPrice(e.target.value)}
                  className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>

              {createdCategories.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <select
                    value={productCategory}
                    onChange={(e) =>
                      setProductCategory(parseInt(e.target.value))
                    }
                    className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    {createdCategories.map((cat, i) => (
                      <option key={cat.id} value={i}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex items-center gap-2 px-4 py-3 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <button
                  onClick={handleStep3}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      Create Product
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              <button
                onClick={() => setStep(3)}
                className="w-full text-center text-sm text-gray-400 hover:text-gray-600"
              >
                Skip for now
              </button>
            </div>
          )}

          {/* Step 4: Done */}
          {step === 3 && (
            <div className="text-center space-y-5 py-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <Sparkles className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  You&apos;re All Set!
                </h2>
                <p className="text-sm text-gray-500 mt-2">
                  Your POS system is ready to use. Head to the terminal to start
                  selling, or add more products from the Products page.
                </p>
              </div>

              <button
                onClick={goToTerminal}
                className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors"
              >
                Go to Terminal
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="flex gap-3 justify-center text-sm">
                <button
                  onClick={() => router.push("/dashboard/products")}
                  className="text-green-600 hover:text-green-700 font-medium"
                >
                  Add More Products
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={() => router.push("/dashboard/settings")}
                  className="text-green-600 hover:text-green-700 font-medium"
                >
                  Configure Settings
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
