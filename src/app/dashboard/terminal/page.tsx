"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Banknote,
  CheckCircle,
  X,
  Loader2,
  Wifi,
  WifiOff,
  RefreshCw,
  Smartphone,
  QrCode,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { formatCurrency } from "@/utils/currency";
import Modal from "@/components/ui/Modal";

interface Category {
  id: string;
  name: string;
  color: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  cost_price: number;
  sku: string | null;
  image_url: string | null;
  stock_quantity: number;
  track_inventory: boolean;
  is_active: boolean;
  category_id: string | null;
  category: Category | null;
  tax_rate: number;
}

interface CartItem {
  product_id: string;
  product_name: string;
  product_sku: string;
  unit_price: number;
  cost_price: number;
  quantity: number;
  tax_amount: number;
  discount_amount: number;
  total_price: number;
  tax_rate: number;
}

interface PosDevice {
  device_sn: string;
  terminal_label: string | null;
  last_seen_at: string | null;
}

type PaymentMethod = "cash" | "scan_to_pay";
type ScanState =
  | "idle"
  | "pushing"
  | "waiting"
  | "paid"
  | "expired"
  | "cancelled"
  | "error";

export default function TerminalPage() {
  const { token } = useAuth();
  const { isOnline, pendingCount, syncNow, addToQueue, isSyncing } =
    useOfflineSync(token);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [amountReceived, setAmountReceived] = useState("");
  const [processing, setProcessing] = useState(false);
  const [successSale, setSuccessSale] = useState<string | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [posDevices, setPosDevices] = useState<PosDevice[]>([]);
  const [selectedDeviceSn, setSelectedDeviceSn] = useState<string | null>(null);
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [scanSessionId, setScanSessionId] = useState<string | null>(null);
  const [scanOrderId, setScanOrderId] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

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
        fetch("/api/products", { headers }),
        fetch("/api/categories", { headers }),
      ]);
      const prodData = await prodRes.json();
      const catData = await catRes.json();
      setProducts(prodData.products || []);
      setCategories(catData.categories || []);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  }, [token, headers]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Load org-owned scan-to-pay devices once.
  const fetchDevices = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/vendor/pos/devices", { headers });
      if (!res.ok) return;
      const data = await res.json();
      const list: PosDevice[] = data.devices || [];
      setPosDevices(list);
      if (list.length === 1) setSelectedDeviceSn(list[0].device_sn);
    } catch {
      // ignore — scan-to-pay is optional
    }
  }, [token, headers]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const filteredProducts = useMemo(() => {
    let filtered = products;
    if (selectedCategory) {
      filtered = filtered.filter((p) => p.category_id === selectedCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.sku && p.sku.toLowerCase().includes(q))
      );
    }
    return filtered;
  }, [products, selectedCategory, search]);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product_id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product_id === product.id
            ? {
                ...i,
                quantity: i.quantity + 1,
                total_price: (i.quantity + 1) * i.unit_price,
                tax_amount:
                  ((i.quantity + 1) * i.unit_price * i.tax_rate) / 100,
              }
            : i
        );
      }
      const taxAmt = (product.price * product.tax_rate) / 100;
      return [
        ...prev,
        {
          product_id: product.id,
          product_name: product.name,
          product_sku: product.sku || "",
          unit_price: product.price,
          cost_price: product.cost_price || 0,
          quantity: 1,
          tax_rate: product.tax_rate || 0,
          tax_amount: taxAmt,
          discount_amount: 0,
          total_price: product.price,
        },
      ];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.product_id !== productId) return i;
          const newQty = i.quantity + delta;
          if (newQty <= 0) return null;
          return {
            ...i,
            quantity: newQty,
            total_price: newQty * i.unit_price,
            tax_amount: (newQty * i.unit_price * i.tax_rate) / 100,
          };
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.product_id !== productId));
  };

  const subtotal = cart.reduce((s, i) => s + i.total_price, 0);
  const taxTotal = cart.reduce((s, i) => s + i.tax_amount, 0);
  const grandTotal = subtotal + taxTotal;

  const change = useMemo(() => {
    const received = parseFloat(amountReceived) || 0;
    return Math.max(0, received - grandTotal);
  }, [amountReceived, grandTotal]);

  const canPay =
    (parseFloat(amountReceived) || 0) >= grandTotal && grandTotal > 0;

  // Reset scan flow whenever the modal closes/opens.
  useEffect(() => {
    if (!payModalOpen) {
      setScanState("idle");
      setScanSessionId(null);
      setScanOrderId(null);
      setScanError(null);
    }
  }, [payModalOpen]);

  // Poll the session status every 2s while waiting for payment.
  useEffect(() => {
    if (scanState !== "waiting" || !scanSessionId) return;

    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(
          `/api/vendor/pos/charge/status/${encodeURIComponent(scanSessionId)}`,
          { headers }
        );
        if (cancelled) return;
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === "paid") {
          setScanState("paid");
          // Record the sale locally so inventory + reports stay accurate.
          completeScanSale(data);
        } else if (data.status === "expired") {
          setScanState("expired");
        } else if (data.status === "cancelled") {
          setScanState("cancelled");
        }
      } catch {
        // transient — keep polling
      }
    };

    const interval = setInterval(tick, 2000);
    tick();
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanState, scanSessionId, headers]);

  const completeScanSale = async (sessionData: any) => {
    try {
      const salePayload = {
        subtotal,
        tax_amount: taxTotal,
        discount_amount: 0,
        total_amount: grandTotal,
        payment_method: "peeap_wallet",
        payment_details: {
          session_id: sessionData.session_id,
          order_id: scanOrderId,
          paid_by_user_id: sessionData.paid_by_user_id,
          paid_at: sessionData.paid_at,
        },
        items: cart,
      };
      const res = await fetch("/api/sales", {
        method: "POST",
        headers,
        body: JSON.stringify(salePayload),
      });
      const data = await res.json().catch(() => ({}));
      const saleNo = data.sale?.sale_number || sessionData.session_id?.slice(-8);
      setSuccessSale(saleNo || "Paid");
      setCart([]);
      setAmountReceived("");
      // Keep modal open briefly to show paid state, then close.
      setTimeout(() => {
        setPayModalOpen(false);
        fetchData();
      }, 1500);
    } catch {
      // Even if local recording fails, the wallet transfer is the source
      // of truth. Show success and let support reconcile if needed.
      setSuccessSale("Paid");
      setCart([]);
      setTimeout(() => setPayModalOpen(false), 1500);
    }
  };

  const handlePushToDevice = async () => {
    if (!selectedDeviceSn || grandTotal <= 0 || !isOnline) return;
    setScanError(null);
    setScanState("pushing");
    try {
      const res = await fetch("/api/vendor/pos/charge", {
        method: "POST",
        headers,
        body: JSON.stringify({
          device_sn: selectedDeviceSn,
          amount: grandTotal,
          line_items: cart.map((i) => ({
            name: i.product_name,
            qty: i.quantity,
            price: i.unit_price,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setScanState("error");
        setScanError(data.detail || data.error || "Could not push to device.");
        return;
      }
      setScanSessionId(data.session_id);
      setScanOrderId(data.order_id);
      setScanState("waiting");
    } catch (e: any) {
      setScanState("error");
      setScanError(e?.message || "Network error.");
    }
  };

  const handleCancelScan = async () => {
    if (!scanSessionId) {
      setScanState("idle");
      return;
    }
    try {
      // Best-effort cancel — even if Terminal is unreachable, the local
      // session will expire on its own.
      await fetch("/api/vendor/pos/charge", {
        method: "DELETE",
        headers,
        body: JSON.stringify({ session_id: scanSessionId }),
      }).catch(() => {});
    } finally {
      setScanState("cancelled");
    }
  };

  const handlePay = async () => {
    if (!canPay || processing) return;
    setProcessing(true);

    const salePayload = {
      subtotal,
      tax_amount: taxTotal,
      discount_amount: 0,
      total_amount: grandTotal,
      payment_method: "cash",
      payment_details: {
        received: parseFloat(amountReceived),
        change,
      },
      items: cart,
    };

    // If offline, queue the sale
    if (!isOnline) {
      try {
        addToQueue({ type: "sale", data: salePayload });
        setSuccessSale("Queued (Offline)");
        setCart([]);
        setAmountReceived("");
        setPayModalOpen(false);
      } catch {
        alert("Failed to save sale offline");
      } finally {
        setProcessing(false);
      }
      return;
    }

    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers,
        body: JSON.stringify(salePayload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sale failed");
      setSuccessSale(data.sale?.sale_number || "Complete");
      setCart([]);
      setAmountReceived("");
      setPayModalOpen(false);
      fetchData();
    } catch (err) {
      // Network error — queue offline
      if (!navigator.onLine) {
        addToQueue({ type: "sale", data: salePayload });
        setSuccessSale("Queued (Offline)");
        setCart([]);
        setAmountReceived("");
        setPayModalOpen(false);
      } else {
        alert(err instanceof Error ? err.message : "Failed to process sale");
      }
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="flex h-full">
      {/* Left: Products */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Search + online status */}
        <div className="p-4 bg-white border-b">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center gap-1.5">
              {isOnline ? (
                <Wifi className="w-4 h-4 text-green-500" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-500" />
              )}
              <span
                className={`text-xs font-medium ${
                  isOnline ? "text-green-600" : "text-red-600"
                }`}
              >
                {isOnline ? "Online" : "Offline"}
              </span>
            </div>
            {pendingCount > 0 && (
              <button
                onClick={() => syncNow()}
                disabled={isSyncing || !isOnline}
                className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium bg-amber-50 text-amber-700 rounded-full hover:bg-amber-100 disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-3 h-3 ${isSyncing ? "animate-spin" : ""}`}
                />
                {isSyncing
                  ? "Syncing..."
                  : `${pendingCount} pending`}
              </button>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search products or scan barcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        {/* Category pills */}
        <div className="px-4 py-3 bg-white border-b flex gap-2 overflow-x-auto">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              !selectedCategory
                ? "bg-green-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() =>
                setSelectedCategory(
                  selectedCategory === cat.id ? null : cat.id
                )
              }
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat.id
                  ? "bg-green-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <ShoppingCart className="w-12 h-12 mb-3" />
              <p className="text-lg font-medium">No products found</p>
              <p className="text-sm mt-1">
                {search
                  ? "Try a different search term"
                  : "Add products from the Products page"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredProducts.map((product) => {
                const inCart = cart.find(
                  (i) => i.product_id === product.id
                );
                const outOfStock =
                  product.track_inventory && product.stock_quantity <= 0;

                return (
                  <button
                    key={product.id}
                    onClick={() => !outOfStock && addToCart(product)}
                    disabled={outOfStock}
                    className={`relative bg-white rounded-xl border p-4 text-left transition-all hover:shadow-md ${
                      outOfStock
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:border-green-300 active:scale-[0.98]"
                    }`}
                  >
                    {inCart && (
                      <span className="absolute top-2 right-2 bg-green-600 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                        {inCart.quantity}
                      </span>
                    )}
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-24 object-cover rounded-lg mb-3"
                      />
                    ) : (
                      <div className="w-full h-24 bg-gray-100 rounded-lg mb-3 flex items-center justify-center">
                        <ShoppingCart className="w-8 h-8 text-gray-300" />
                      </div>
                    )}
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {product.name}
                    </p>
                    <p className="text-sm font-bold text-green-600 mt-1">
                      {formatCurrency(product.price)}
                    </p>
                    {product.track_inventory && (
                      <p
                        className={`text-xs mt-1 ${
                          product.stock_quantity <= 5
                            ? "text-red-500"
                            : "text-gray-400"
                        }`}
                      >
                        {outOfStock
                          ? "Out of stock"
                          : `${product.stock_quantity} in stock`}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right: Cart */}
      <div className="w-96 bg-white border-l flex flex-col shrink-0">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" />
            Cart ({cart.length} items)
          </h2>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {cart.length === 0 ? (
            <p className="text-center text-gray-400 text-sm mt-8">
              Tap a product to add it to the cart
            </p>
          ) : (
            <div className="space-y-3">
              {cart.map((item) => (
                <div
                  key={item.product_id}
                  className="flex items-start justify-between gap-2 p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {item.product_name}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatCurrency(item.unit_price)} x {item.quantity}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      className="p-1 hover:bg-gray-200 rounded"
                      onClick={() => updateQuantity(item.product_id, -1)}
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-sm font-medium w-7 text-center">
                      {item.quantity}
                    </span>
                    <button
                      className="p-1 hover:bg-gray-200 rounded"
                      onClick={() => updateQuantity(item.product_id, 1)}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      className="p-1 hover:bg-red-100 rounded text-red-500 ml-1"
                      onClick={() => removeFromCart(item.product_id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 w-20 text-right shrink-0">
                    {formatCurrency(item.total_price)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totals */}
        <div className="border-t p-4 space-y-2">
          <div className="flex justify-between text-sm text-gray-500">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          {taxTotal > 0 && (
            <div className="flex justify-between text-sm text-gray-500">
              <span>Tax</span>
              <span>{formatCurrency(taxTotal)}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold pt-2 border-t">
            <span>Total</span>
            <span className="text-green-600">
              {formatCurrency(grandTotal)}
            </span>
          </div>

          <button
            onClick={() => {
              setAmountReceived("");
              setPayModalOpen(true);
            }}
            disabled={cart.length === 0}
            className="w-full mt-3 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            <Banknote className="w-5 h-5" />
            Pay Now
          </button>

          {cart.length > 0 && (
            <button
              onClick={() => setCart([])}
              className="w-full py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              Clear Cart
            </button>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      <Modal
        open={payModalOpen}
        onClose={() => {
          if (scanState === "waiting" || scanState === "pushing") return;
          setPayModalOpen(false);
        }}
        title={
          paymentMethod === "scan_to_pay" ? "Scan to Pay" : "Cash Payment"
        }
        size="sm"
      >
        <div className="space-y-5">
          {/* Method toggle */}
          {posDevices.length > 0 && (
            <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
              <button
                onClick={() => setPaymentMethod("cash")}
                className={`flex-1 py-2 rounded-md text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                  paymentMethod === "cash"
                    ? "bg-white shadow-sm text-gray-900"
                    : "text-gray-500 hover:text-gray-700"
                }`}
                disabled={scanState === "waiting" || scanState === "pushing"}
              >
                <Banknote className="w-4 h-4" />
                Cash
              </button>
              <button
                onClick={() => setPaymentMethod("scan_to_pay")}
                className={`flex-1 py-2 rounded-md text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                  paymentMethod === "scan_to_pay"
                    ? "bg-white shadow-sm text-gray-900"
                    : "text-gray-500 hover:text-gray-700"
                }`}
                disabled={scanState === "waiting" || scanState === "pushing"}
              >
                <QrCode className="w-4 h-4" />
                Scan to Pay
              </button>
            </div>
          )}

          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-500">Amount Due</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">
              {formatCurrency(grandTotal)}
            </p>
          </div>

          {paymentMethod === "cash" ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount Received
                </label>
                <input
                  type="number"
                  value={amountReceived}
                  onChange={(e) => setAmountReceived(e.target.value)}
                  placeholder="0.00"
                  autoFocus
                  className="w-full px-4 py-3 border rounded-lg text-lg font-semibold text-center focus:outline-none focus:ring-2 focus:ring-green-500"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canPay) handlePay();
                  }}
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  Math.ceil(grandTotal),
                  Math.ceil(grandTotal / 10) * 10,
                  Math.ceil(grandTotal / 50) * 50,
                  Math.ceil(grandTotal / 100) * 100,
                  Math.ceil(grandTotal / 500) * 500,
                  Math.ceil(grandTotal / 1000) * 1000,
                ]
                  .filter((v, i, a) => v >= grandTotal && a.indexOf(v) === i)
                  .slice(0, 6)
                  .map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setAmountReceived(amount.toString())}
                      className="py-2 px-3 border rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                    >
                      {formatCurrency(amount)}
                    </button>
                  ))}
              </div>

              {parseFloat(amountReceived) > 0 && (
                <div
                  className={`rounded-lg p-4 text-center ${
                    canPay
                      ? "bg-green-50 border border-green-200"
                      : "bg-red-50 border border-red-200"
                  }`}
                >
                  <p
                    className={`text-sm ${
                      canPay ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {canPay ? "Change" : "Insufficient amount"}
                  </p>
                  {canPay && (
                    <p className="text-2xl font-bold text-green-700 mt-1">
                      {formatCurrency(change)}
                    </p>
                  )}
                </div>
              )}

              <button
                onClick={handlePay}
                disabled={!canPay || processing}
                className="w-full py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Complete Sale
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              {/* Device picker */}
              {scanState === "idle" || scanState === "error" || scanState === "expired" || scanState === "cancelled" ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Push to device
                    </label>
                    <select
                      value={selectedDeviceSn || ""}
                      onChange={(e) => setSelectedDeviceSn(e.target.value)}
                      className="w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">Select a device…</option>
                      {posDevices.map((d) => (
                        <option key={d.device_sn} value={d.device_sn}>
                          {d.terminal_label || d.device_sn}
                        </option>
                      ))}
                    </select>
                    {posDevices.length === 0 && (
                      <p className="text-xs text-gray-500 mt-2">
                        No devices paired. Add one in POS Devices first.
                      </p>
                    )}
                  </div>

                  {scanError && (
                    <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{scanError}</span>
                    </div>
                  )}
                  {scanState === "expired" && (
                    <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>Session expired before customer scanned. Try again.</span>
                    </div>
                  )}
                  {scanState === "cancelled" && (
                    <div className="text-sm text-gray-500 text-center">
                      Cancelled. You can push again.
                    </div>
                  )}

                  <button
                    onClick={handlePushToDevice}
                    disabled={
                      !selectedDeviceSn || grandTotal <= 0 || !isOnline
                    }
                    className="w-full py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    <Smartphone className="w-5 h-5" />
                    Push to Device
                  </button>
                </>
              ) : scanState === "pushing" ? (
                <div className="py-8 flex flex-col items-center gap-3">
                  <Loader2 className="w-10 h-10 animate-spin text-green-600" />
                  <p className="text-sm text-gray-600">Painting device…</p>
                </div>
              ) : scanState === "waiting" ? (
                <div className="py-6 flex flex-col items-center gap-4">
                  <div className="relative">
                    <Smartphone className="w-16 h-16 text-green-600" />
                    <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                      <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    </span>
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-gray-900">
                      Waiting for customer scan
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Customer scans the QR on the device with their Peeap app.
                    </p>
                  </div>
                  <button
                    onClick={handleCancelScan}
                    className="text-sm text-red-600 hover:text-red-700 font-medium"
                  >
                    Cancel
                  </button>
                </div>
              ) : scanState === "paid" ? (
                <div className="py-8 flex flex-col items-center gap-3">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-10 h-10 text-green-600" />
                  </div>
                  <p className="text-lg font-semibold text-gray-900">Paid!</p>
                  <p className="text-sm text-gray-500">
                    Funds in your wallet.
                  </p>
                </div>
              ) : null}
            </>
          )}
        </div>
      </Modal>

      {/* Success Toast */}
      {successSale && (
        <div className="fixed top-6 right-6 z-50 bg-green-600 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top">
          <CheckCircle className="w-6 h-6" />
          <div>
            <p className="font-semibold">Sale Complete!</p>
            <p className="text-sm text-green-100">
              Sale #{successSale} recorded
            </p>
          </div>
          <button
            onClick={() => setSuccessSale(null)}
            className="ml-4 p-1 hover:bg-green-500 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
