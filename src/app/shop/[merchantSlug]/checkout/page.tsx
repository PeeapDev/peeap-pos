"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Loader2,
  ShoppingBag,
  AlertCircle,
  Lock,
  LogIn,
  User,
  MapPin,
  Shield,
  Wallet,
  Smartphone,
  QrCode,
  CheckCircle,
  X,
  ChevronRight,
  CreditCard,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

// ─── Types ───

interface CartItem {
  product_id: string;
  name: string;
  price: number;
  image_url?: string;
  quantity: number;
}

interface WalletInfo {
  id: string;
  balance: number;
  wallet_type: string;
  currency_code: string;
}

interface OrderData {
  id: string;
  order_number: string;
  total_amount: number;
  payment_reference: string;
}

// ─── Helpers ───

function getCart(merchantSlug: string): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`cart_${merchantSlug}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function clearCart(merchantSlug: string) {
  try {
    localStorage.removeItem(`cart_${merchantSlug}`);
    window.dispatchEvent(
      new CustomEvent("cart-updated", { detail: { merchantSlug } })
    );
  } catch {}
}

const CHECKOUT_DOMAIN = "https://checkout.peeap.com";

// ─── QR Code Component (pure SVG, no dependency) ───

function QRCode({ value, size = 200 }: { value: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    // Dynamic import to avoid SSR issues
    import("qrcode").then((QRC) => {
      QRC.toDataURL(value, {
        width: size,
        margin: 2,
        color: { dark: "#1a1a1a", light: "#ffffff" },
        errorCorrectionLevel: "M",
      }).then(setDataUrl);
    }).catch(() => {});
  }, [value, size]);

  if (!dataUrl) {
    return (
      <div
        className="bg-gray-100 rounded-xl flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <img
      src={dataUrl}
      alt="QR Code"
      width={size}
      height={size}
      className="rounded-xl"
    />
  );
}

// ─── PIN Overlay ───

function PinOverlay({
  onSubmit,
  onClose,
  loading,
  error,
}: {
  onSubmit: (pin: string) => void;
  onClose: () => void;
  loading: boolean;
  error: string | null;
}) {
  const [digits, setDigits] = useState(["", "", "", ""]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newDigits = [...digits];
    newDigits[index] = value.slice(-1);
    setDigits(newDigits);

    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 4 digits entered
    if (value && index === 3) {
      const pin = newDigits.join("");
      if (pin.length === 4) {
        onSubmit(pin);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 relative animate-in slide-in-from-bottom-4">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Lock className="w-7 h-7 text-emerald-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">Enter your PIN</h3>
          <p className="text-sm text-gray-500 mt-1">
            Enter your 4-digit transaction PIN to confirm payment
          </p>
        </div>

        <div className="flex justify-center gap-3 mb-6">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              disabled={loading}
              className="w-14 h-14 text-center text-2xl font-bold border-2 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all disabled:opacity-50"
            />
          ))}
        </div>

        {error && (
          <p className="text-sm text-red-500 text-center mb-4">{error}</p>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-2 text-emerald-600">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm font-medium">Processing payment...</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN CHECKOUT PAGE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const merchantSlug = params.merchantSlug as string;

  const {
    user,
    token,
    loading: authLoading,
    loginPopup,
  } = useAuth();

  // ─── State ───
  const [items, setItems] = useState<CartItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string>("");
  const [storeDeliveryFee, setStoreDeliveryFee] = useState(0);
  const [storeFreeDeliveryMin, setStoreFreeDeliveryMin] = useState(0);
  const [storeOffersDelivery, setStoreOffersDelivery] = useState(false);
  const [storeLoading, setStoreLoading] = useState(true);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  // Form state
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<Array<{ id: string; address_line: string; city: string; is_default: boolean }>>([]);
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [showNewAddress, setShowNewAddress] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressForm, setAddressForm] = useState({ full_name: "", phone: "", address_line: "", city: "" });
  const [notes, setNotes] = useState("");

  // Payment phase state
  const [phase, setPhase] = useState<"form" | "payment" | "success">("form");
  const [order, setOrder] = useState<OrderData | null>(null);
  const [wallets, setWallets] = useState<WalletInfo[]>([]);
  const [walletsLoading, setWalletsLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const purchaseKeyRef = useRef<string | null>(null);
  const [momoPaying, setMomoPaying] = useState(false);
  const [momoUrl, setMomoUrl] = useState<string | null>(null);
  const [cardPaying, setCardPaying] = useState(false);
  const [showCardInput, setShowCardInput] = useState(false);
  const [cardToken, setCardToken] = useState("");
  const [cardPin, setCardPin] = useState("");

  // ─── Effects ───

  // Load cart and store
  useEffect(() => {
    setMounted(true);
    setItems(getCart(merchantSlug));

    setStoreLoading(true);
    fetch(`/api/stores?slug=${merchantSlug}`)
      .then((res) => {
        if (!res.ok) throw new Error("Store not found");
        return res.json();
      })
      .then((data) => {
        if (data.store?.id) {
          setStoreId(data.store.id);
          setStoreName(data.store.name || "");
          setStoreDeliveryFee(data.store.delivery_fee || 0);
          setStoreFreeDeliveryMin(data.store.free_delivery_minimum || 0);
          setStoreOffersDelivery(!!data.store.offers_delivery);
        } else {
          setStoreError("Could not load store information.");
        }
      })
      .catch(() => {
        setStoreError("Failed to load store information.");
      })
      .finally(() => setStoreLoading(false));
  }, [merchantSlug]);

  // Fetch wallets + shipping addresses when user is logged in
  useEffect(() => {
    if (!user?.id || !token) return;
    setWalletsLoading(true);
    fetch(`/api/wallet?user_id=${encodeURIComponent(user.id)}`, {
      headers: { Authorization: `Session ${token}` },
    })
      .then((r) => { if (!r.ok) throw new Error("Wallet unavailable"); return r.json(); })
      .then((data) => setWallets(data.wallets || []))
      .catch(() => setError("Could not verify your Peeap wallet. Please sign in again or retry."))
      .finally(() => setWalletsLoading(false));

    // Load shipping addresses
    setLoadingAddress(true);
    fetch(`/api/address?user_id=${encodeURIComponent(user.id)}`, {
      headers: { Authorization: `Session ${token}` },
    })
      .then((r) => (r.ok ? r.json() : { addresses: [] }))
      .then((data) => {
        const addrs = (data.addresses || []).filter((address: { id: string }) => address.id !== "profile");
        setSavedAddresses(addrs);
        // Auto-fill with default address
        const preferredId = sessionStorage.getItem("store_delivery_address_id");
        const defaultAddr = addrs.find((a: any) => a.id === preferredId) || addrs.find((a: any) => a.is_default) || addrs[0];
        if (defaultAddr && !deliveryAddress) {
          setDeliveryAddress([defaultAddr.address_line, defaultAddr.city].filter(Boolean).join(', '));
          setSelectedAddressId(defaultAddr.id);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingAddress(false));
  }, [user?.id, token]);

  // Poll order status in payment phase
  useEffect(() => {
    if (phase !== "payment" || !order) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${order.id}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.order?.status === "paid" || data.order?.status === "confirmed") {
          setPhase("success");
          clearInterval(interval);
        }
      } catch {}
    }, 4000);
    return () => clearInterval(interval);
  }, [phase, order]);

  // ─── Computed ───

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const isDelivery = !!deliveryAddress.trim();
  const deliveryFee = isDelivery && storeOffersDelivery
    ? (storeFreeDeliveryMin > 0 && subtotal >= storeFreeDeliveryMin ? 0 : storeDeliveryFee)
    : 0;
  const orderTotal = subtotal + deliveryFee;
  const primaryWallet = wallets.find((w: any) => w.spending_enabled) || wallets.find((w) => w.wallet_type === "primary") || wallets.sort((a, b) => b.balance - a.balance)[0];
  const walletBalance = primaryWallet?.balance ?? 0;
  const hasEnoughBalance = walletBalance >= orderTotal;
  const qrUrl = order?.payment_reference
    ? `${CHECKOUT_DOMAIN}/checkout/pay/${order.payment_reference}`
    : null;

  // ─── Actions ───

  const handleLogin = async () => {
    setLoggingIn(true);
    const signedIn = await loginPopup();
    if (!signedIn) setError("Peeap sign-in did not complete. Please try again.");
    setLoggingIn(false);
  };

  const saveNewAddress = async () => {
    if (!token || savingAddress) return;
    setSavingAddress(true);
    setError(null);
    try {
      const response = await fetch("/api/address", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Session ${token}` },
        body: JSON.stringify(addressForm),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.address?.id) throw new Error(result.error || "Could not save delivery address");
      const address = result.address as { id: string; address_line: string; city: string; is_default: boolean };
      setSavedAddresses((current) => [...current, address]);
      setSelectedAddressId(address.id);
      setDeliveryAddress([address.address_line, address.city].filter(Boolean).join(", "));
      sessionStorage.setItem("store_delivery_address_id", address.id);
      setShowNewAddress(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save delivery address");
    } finally {
      setSavingAddress(false);
    }
  };

  const PEEAP_API = process.env.NEXT_PUBLIC_PEEAP_API_URL || "https://api.peeap.com";

  // ─── Direct wallet-to-wallet purchase (no checkout session needed) ───
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user || !token) {
      setError("You must be logged in.");
      return;
    }
    if (!storeId || items.length === 0) return;

    if (!selectedAddressId) {
      setError("Choose a saved shipping address in Peeap before buying physical goods.");
      return;
    }

    // Check balance upfront
    if (!hasEnoughBalance) {
      setError(`Insufficient balance. You need NLe ${orderTotal.toLocaleString()} but have NLe ${walletBalance.toLocaleString()}. Please deposit funds first.`);
      return;
    }

    setPinError(null);
    setShowPin(true);
  };

  const submitPurchase = async (pin: string) => {
    if (loading || !user || !token || !selectedAddressId) return;
    if (!purchaseKeyRef.current) purchaseKeyRef.current = crypto.randomUUID();
    setLoading(true);
    try {
      // Direct wallet-to-wallet via Peeap API — no checkout session needed
      const res = await fetch(`${PEEAP_API}/api/store/purchase`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Session ${token}`,
        },
        body: JSON.stringify({
          store_slug: merchantSlug,
          items: items.map((i) => ({
            product_id: i.product_id,
            quantity: i.quantity,
          })),
          address_id: selectedAddressId,
          idempotency_key: purchaseKeyRef.current,
          pin,
          customer_name: user?.name || user?.email || user?.phone || "Peeap User",
          customer_phone: user?.phone || "",
          notes: notes.trim() || undefined,
          delivery_address: deliveryAddress.trim() || undefined,
          delivery_city: deliveryAddress.trim() ? undefined : undefined,
          order_type: deliveryAddress.trim() ? "delivery" : "online",
        }),
      });

      const data = await res.json();
      if (!res.ok || data.success !== true) {
        if (data.error === "insufficient_balance") {
          setPinError(data.error_description || "Insufficient wallet balance.");
        } else if (data.error === "no_address") {
          setPinError("No shipping address found. Please add one in your Peeap profile.");
        } else if (data.error === "pin_not_set") {
          setPinError("Set a transaction PIN in Peeap Security settings before buying.");
        } else if (data.error === "invalid_pin" || data.error === "pin_locked") {
          setPinError(data.error_description || data.error.replaceAll("_", " "));
        } else {
          throw new Error(data.error === "purchase_pending_reconciliation"
            ? `Payment is being checked. Do not start another order. Reference: ${data.transaction_ref || "pending"}`
            : (data.error || data.details || "Failed to place order"));
        }
        return;
      }

      clearCart(merchantSlug);
      setShowPin(false);
      setOrder({
        id: data.order?.id || "",
        order_number: data.order?.order_number || "N/A",
        total_amount: data.order?.total || subtotal,
        payment_reference: data.transaction_ref || "",
      });
      setPhase("success");
    } catch (err) {
      setPinError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // Mobile money — only method that still needs a checkout session
  const handleMobileMoney = async () => {
    if (!user || !storeId) return;
    setMomoPaying(true);
    setError(null);

    try {
      // For mobile money, create a checkout session (external payment needs it)
      const orderRes = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Session ${token}`,
        },
        body: JSON.stringify({
          store_id: storeId,
          customer_name: user.name || user.email || user.phone || "Peeap User",
          customer_phone: user.phone || "",
          customer_email: user.email || undefined,
          customer_id: user.id,
          items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
          payment_method: "mobile_money",
          notes: notes.trim() || undefined,
          delivery_address: deliveryAddress.trim() || undefined,
          order_type: deliveryAddress.trim() ? "delivery" : "online",
        }),
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error || "Failed to create order");

      const createdOrder = orderData.order;
      setOrder({
        id: createdOrder.id,
        order_number: createdOrder.order_number,
        total_amount: createdOrder.total_amount,
        payment_reference: createdOrder.payment_reference || "",
      });

      // Now initiate mobile money payment
      const momoRes = await fetch("/api/pay/mobile-money", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: createdOrder.id,
          userId: user.id,
          userEmail: user.email,
        }),
      });

      const momoData = await momoRes.json();
      if (!momoRes.ok) throw new Error(momoData.error || "Failed");

      if (momoData.paymentUrl) {
        setMomoUrl(momoData.paymentUrl);
        setPhase("payment");
        clearCart(merchantSlug);
        window.open(momoData.paymentUrl, "_blank");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mobile money failed");
    } finally {
      setMomoPaying(false);
    }
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // RENDER: Loading
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  if (!mounted || storeLoading || authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-3" />
          <p className="text-gray-500">
            Loading checkout...
          </p>
        </div>
      </div>
    );
  }

  if (storeError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Something went wrong</h2>
          <p className="text-gray-500 mb-6">{storeError}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-emerald-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-emerald-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (items.length === 0 && mounted && phase === "form") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">No items to checkout</h2>
          <Link
            href={`/shop/${merchantSlug}`}
            className="inline-flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-emerald-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Browse Products
          </Link>
        </div>
      </div>
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // RENDER: Not logged in
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col lg:flex-row">
        <div className="hidden lg:flex lg:w-5/12 relative overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-20 -left-20 w-96 h-96 rounded-full bg-white/20 blur-3xl" />
            <div className="absolute bottom-20 right-10 w-72 h-72 rounded-full bg-white/15 blur-3xl" />
          </div>
          <div className="relative z-10 flex flex-col justify-between p-10 w-full">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                <span className="text-white font-bold text-xl">P</span>
              </div>
              <span className="text-xl font-bold text-white">Peeap Pay</span>
            </div>
            <div>
              <h2 className="text-3xl font-bold text-white mb-4">Secure Checkout</h2>
              <p className="text-emerald-100 text-lg mb-8">Sign in to complete your purchase.</p>
              <div className="space-y-3">
                {[
                  { icon: Wallet, text: "Pay from your Peeap wallet" },
                  { icon: QrCode, text: "Scan QR to pay instantly" },
                  { icon: Smartphone, text: "Orange Money supported" },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-3 text-emerald-100">
                    <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center">
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-sm">{text}</span>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-emerald-300 text-xs">&copy; {new Date().getFullYear()} Peeap Pay</p>
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          <div className="bg-white border-b lg:hidden">
            <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
              <Link href={`/shop/${merchantSlug}/cart`} className="text-gray-600 hover:text-gray-900">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">P</span>
                </div>
                <h1 className="text-lg font-bold text-gray-900">Checkout</h1>
              </div>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center px-4 py-12">
            <div className="max-w-sm w-full">
              <Link
                href={`/shop/${merchantSlug}/cart`}
                className="hidden lg:inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-8"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to cart
              </Link>

              <div className="text-center lg:text-left mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Sign in to checkout</h2>
                <p className="text-gray-500">You need a Peeap Pay account to place your order.</p>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-emerald-800">Order Summary</span>
                  <span className="text-xs text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                    {totalItems} {totalItems === 1 ? "item" : "items"}
                  </span>
                </div>
                <div className="space-y-2 mb-3">
                  {items.slice(0, 3).map((item) => (
                    <div key={item.product_id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 truncate mr-2">{item.name} x{item.quantity}</span>
                      <span className="text-gray-900 font-medium whitespace-nowrap">
                        NLe {(item.price * item.quantity).toLocaleString()}
                      </span>
                    </div>
                  ))}
                  {items.length > 3 && (
                    <p className="text-xs text-emerald-600">+{items.length - 3} more items</p>
                  )}
                </div>
                {isDelivery && deliveryFee > 0 && (
                  <div className="flex items-center justify-between text-emerald-800 text-sm">
                    <span>Delivery</span>
                    <span>NLe {deliveryFee.toLocaleString()}</span>
                  </div>
                )}
                <div className="border-t border-emerald-200 pt-3 flex items-center justify-between">
                  <span className="font-semibold text-emerald-900">Total</span>
                  <span className="text-xl font-bold text-emerald-900">NLe {orderTotal.toLocaleString()}</span>
                </div>
              </div>

              <button
                onClick={handleLogin}
                disabled={loggingIn}
                className="w-full bg-emerald-600 text-white py-3.5 rounded-xl font-semibold hover:bg-emerald-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 disabled:opacity-70"
              >
                {loggingIn ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Signing in...</>
                ) : (
                  <><LogIn className="w-5 h-5" /> Continue with Peeap Pay</>
                )}
              </button>
              <p className="mt-3 text-xs text-gray-400 text-center">
                Sign in or create an account — you won&apos;t leave this page
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // RENDER: Payment Success
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  if (phase === "success" && order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-sm w-full text-center">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h2>
          <p className="text-gray-500 mb-2">
            Your order <span className="font-semibold text-gray-900">{order.order_number}</span> has been placed.
          </p>
          <p className="text-2xl font-bold text-emerald-600 mb-8">
            NLe {order.total_amount.toLocaleString()}
          </p>

          <div className="space-y-3">
            <a
              href={`https://my.peeap.com/orders/${order.id}`}
              className="block w-full text-center bg-emerald-600 text-white py-3 rounded-xl font-semibold hover:bg-emerald-700 transition-colors"
            >
              View Order
            </a>
            <Link
              href={`/shop/${merchantSlug}`}
              className="block w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // RENDER: Payment Terminal (Phase 2)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  if (phase === "payment" && order) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b">
          <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
                <span className="text-white font-bold">P</span>
              </div>
              <span className="font-bold text-gray-900">Peeap Pay</span>
            </div>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
              {order.order_number}
            </span>
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
          {/* Amount */}
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-1">Amount to pay</p>
            <p className="text-4xl font-bold text-gray-900">
              NLe {order.total_amount.toLocaleString()}
            </p>
            <p className="text-sm text-gray-400 mt-1">{storeName}</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* QR Code */}
          {qrUrl && (
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <QrCode className="w-5 h-5 text-emerald-600" />
                <h3 className="font-semibold text-gray-900">Scan to Pay</h3>
              </div>
              <div className="flex justify-center mb-3">
                <QRCode value={qrUrl} size={180} />
              </div>
              <p className="text-xs text-gray-400 text-center">
                Scan with the Peeap mobile app to pay instantly
              </p>
            </div>
          )}

          {/* Wallet Pay */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <button
              disabled
              className="w-full p-5 flex items-center gap-4 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
            >
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                <Wallet className="w-6 h-6 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-gray-900">Peeap Wallet</p>
                  {walletsLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                  ) : (
                    <span
                      className={`text-sm font-bold ${
                        hasEnoughBalance ? "text-emerald-600" : "text-red-500"
                      }`}
                    >
                      NLe {walletBalance.toLocaleString()}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500">
                  {!primaryWallet
                    ? "No wallet found"
                    : !hasEnoughBalance
                    ? "Insufficient balance"
                    : "Unavailable after mobile-money payment starts"}
                </p>
              </div>
              {primaryWallet && hasEnoughBalance && (
                <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
              )}
            </button>
          </div>

          {/* Mobile Money */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <button
              disabled
              className="w-full p-5 flex items-center gap-4 hover:bg-gray-50 transition-colors disabled:opacity-50 text-left"
            >
              <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                <Smartphone className="w-6 h-6 text-orange-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900">Mobile Money</p>
                <p className="text-sm text-gray-500">
                  {momoPaying ? "Generating payment..." : momoUrl ? "Payment initiated — complete on your phone" : "Pay with Orange Money"}
                </p>
              </div>
              {momoPaying ? (
                <Loader2 className="w-5 h-5 animate-spin text-orange-500 shrink-0" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
              )}
            </button>
          </div>

          {/* Peeap Card Payment */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <button
              disabled
              className="w-full p-5 flex items-center gap-4 hover:bg-gray-50 transition-colors disabled:opacity-50 text-left"
            >
              <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                <CreditCard className="w-6 h-6 text-indigo-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900">Peeap Card</p>
                <p className="text-sm text-gray-500">
                  {cardPaying ? "Processing payment..." : "Pay with your Peeap card"}
                </p>
              </div>
              {cardPaying ? (
                <Loader2 className="w-5 h-5 animate-spin text-indigo-500 shrink-0" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
              )}
            </button>
            {showCardInput && (
              <div className="px-5 pb-5 space-y-3 border-t border-gray-100 pt-4">
                <input
                  type="text"
                  placeholder="Card token (from your Peeap card)"
                  value={cardToken}
                  onChange={(e) => setCardToken(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                />
                <input
                  type="password"
                  placeholder="4-digit PIN"
                  value={cardPin}
                  onChange={(e) => setCardPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  maxLength={4}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                />
                <button
                  onClick={async () => {
                    if (!cardToken || !order) return;
                    setCardPaying(true);
                    setError(null);
                    try {
                      const res = await fetch("/api/pay/card", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          orderId: order.id,
                          cardToken,
                          pin: cardPin || undefined,
                        }),
                      });
                      const data = await res.json();
                      if (!res.ok) {
                        setError(data.error || data.decline_reason || "Card payment failed");
                      }
                      // Polling will detect the paid status
                    } catch {
                      setError("Card payment failed. Please try again.");
                    } finally {
                      setCardPaying(false);
                    }
                  }}
                  disabled={!cardToken || cardPaying}
                  className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {cardPaying ? "Processing..." : `Pay NLe ${order?.total_amount?.toLocaleString() || ""}`}
                </button>
              </div>
            )}
          </div>

          {/* Polling indicator */}
          <div className="flex items-center justify-center gap-2 text-xs text-gray-400 pt-2">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Waiting for payment...</span>
          </div>

          <div className="flex items-center justify-center gap-3 text-xs text-gray-400 pt-2">
            <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> Encrypted</span>
            <span>|</span>
            <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Secure</span>
            <span>|</span>
            <span>Powered by Peeap</span>
          </div>
        </div>
      </div>
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // RENDER: Order Form (Phase 1)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  return (
    <div className="min-h-screen bg-gray-50">
      {showPin && (
        <PinOverlay
          onSubmit={submitPurchase}
          onClose={() => { if (!loading) { setShowPin(false); setPinError(null); } }}
          loading={loading}
          error={pinError}
        />
      )}
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/shop/${merchantSlug}/cart`} className="text-gray-600 hover:text-gray-900 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Lock className="w-5 h-5 text-emerald-600" />
              Checkout
            </h1>
          </div>
          <Link href={`/shop/${merchantSlug}/cart`} className="text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors">
            Edit Cart
          </Link>
        </div>
      </div>

      <form onSubmit={handlePlaceOrder} className="max-w-5xl mx-auto px-4 py-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        <div className="grid lg:grid-cols-5 gap-6">
          {/* Left column */}
          <div className="lg:col-span-3 space-y-6">
            {/* User Info */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-emerald-600" />
                Your Information
              </h2>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                    {(user.name || user.email || "U").charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{user.name || "Peeap User"}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-gray-600">
                      {user.email && <span>{user.email}</span>}
                      {user.phone && <span>{user.phone}</span>}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Shipping */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-emerald-600" />
                Shipping
              </h2>

              {/* Delivery promo banner */}
              {storeOffersDelivery && (
                <div className="bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-200 rounded-xl p-3.5 mb-4">
                  <div className="flex items-center gap-2 text-violet-800 font-semibold text-sm">
                    <span className="text-lg">🚀</span>
                    Get it delivered to your door
                  </div>
                  <p className="text-xs text-violet-600 mt-1">
                    {storeFreeDeliveryMin > 0
                      ? `Free delivery on orders over NLe ${storeFreeDeliveryMin.toLocaleString()}! Standard delivery: NLe ${storeDeliveryFee.toLocaleString()}.`
                      : storeDeliveryFee > 0
                        ? `Fast delivery for just NLe ${storeDeliveryFee.toLocaleString()}. Get your order delivered in minutes!`
                        : "Free delivery on all orders. Get your order delivered in minutes!"
                    }
                  </p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">Delivery Address</span>
                    {savedAddresses.length > 0 && (
                      <span className="text-xs text-emerald-600 font-medium">{savedAddresses.length} saved</span>
                    )}
                  </div>
                  {/* Saved addresses */}
                  {savedAddresses.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {savedAddresses.map((addr) => (
                        <button
                          key={addr.id}
                          type="button"
                          onClick={() => {
                            setDeliveryAddress([addr.address_line, addr.city].filter(Boolean).join(', '));
                            setSelectedAddressId(addr.id);
                            sessionStorage.setItem("store_delivery_address_id", addr.id);
                          }}
                          className={`w-full text-left p-3 rounded-lg border transition-all text-sm ${
                            deliveryAddress === [addr.address_line, addr.city].filter(Boolean).join(', ')
                              ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                            <span className="text-gray-900">{addr.address_line}{addr.city ? `, ${addr.city}` : ''}</span>
                            {addr.is_default && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full ml-auto">Default</span>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {loadingAddress && <p className="text-sm text-gray-500">Loading saved addresses…</p>}
                  {!selectedAddressId && !loadingAddress && <p className="text-xs text-amber-700 mt-1">Save or choose a delivery address before paying.</p>}
                  <button type="button" onClick={() => {
                    setAddressForm((current) => ({
                      ...current,
                      full_name: current.full_name || user?.name || "",
                      phone: current.phone || user?.phone || "",
                    }));
                    setShowNewAddress((current) => !current);
                  }} className="mt-3 text-sm font-semibold text-emerald-700 hover:underline">
                    {showNewAddress ? "Cancel new address" : "Add a delivery address"}
                  </button>
                  {showNewAddress && (
                    <div className="mt-3 space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
                      <input aria-label="Recipient full name" placeholder="Recipient full name" value={addressForm.full_name} onChange={(e) => setAddressForm({ ...addressForm, full_name: e.target.value })} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm" />
                      <input aria-label="Recipient phone" type="tel" placeholder="Recipient phone" value={addressForm.phone} onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm" />
                      <input aria-label="Street address" placeholder="Street address and landmark" value={addressForm.address_line} onChange={(e) => setAddressForm({ ...addressForm, address_line: e.target.value })} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm" />
                      <input aria-label="City" placeholder="City" value={addressForm.city} onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm" />
                      <button type="button" onClick={saveNewAddress} disabled={savingAddress} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{savingAddress ? "Saving…" : "Save delivery address"}</button>
                    </div>
                  )}
                </div>
                <div>
                  <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                    Order Notes <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Special instructions..."
                    rows={2}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Payment — Wallet balance */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-600" />
                Payment
              </h2>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-emerald-800">Peeap Wallet</span>
                  {walletsLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                  ) : (
                    <span className={`text-lg font-bold ${hasEnoughBalance ? "text-emerald-700" : "text-red-600"}`}>
                      NLe {walletBalance.toLocaleString()}
                    </span>
                  )}
                </div>
                <p className="text-xs text-emerald-600">
                  {hasEnoughBalance
                    ? "Payment will be deducted directly from your wallet."
                    : "Insufficient balance — deposit funds to continue."}
                </p>
              </div>
              {!hasEnoughBalance && !walletsLoading && (
                <button
                  type="button"
                  onClick={handleMobileMoney}
                  disabled={momoPaying}
                  className="mt-3 w-full flex items-center justify-center gap-2 py-3 border-2 border-orange-300 text-orange-700 rounded-xl font-semibold hover:bg-orange-50 transition-colors disabled:opacity-50"
                >
                  {momoPaying ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Initiating...</>
                  ) : (
                    <><Smartphone className="w-4 h-4" /> Deposit via Mobile Money</>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Right column — Order Summary */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl p-6 shadow-sm sticky top-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h2>

              <div className="space-y-3 max-h-64 overflow-y-auto">
                {items.map((item) => (
                  <div key={item.product_id} className="flex gap-3 items-start">
                    <div className="w-12 h-12 relative bg-gray-100 rounded-lg overflow-hidden shrink-0">
                      {item.image_url ? (
                        <Image src={item.image_url} alt={item.name} fill className="object-cover" sizes="48px" />
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-400 text-[10px]">No img</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                      <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                    </div>
                    <p className="text-sm font-medium text-gray-900 shrink-0">
                      NLe {(item.price * item.quantity).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>

              <div className="border-t mt-4 pt-4 space-y-2 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal ({totalItems} items)</span>
                  <span>NLe {subtotal.toLocaleString()}</span>
                </div>
                {isDelivery && (
                  <div className="flex justify-between text-gray-600">
                    <span>Delivery</span>
                    <span className={deliveryFee === 0 ? "text-green-600 font-medium" : ""}>
                      {deliveryFee === 0 ? "Free" : `NLe ${deliveryFee.toLocaleString()}`}
                    </span>
                  </div>
                )}
                {isDelivery && deliveryFee === 0 && storeFreeDeliveryMin > 0 && (
                  <p className="text-[10px] text-green-600">Free delivery on orders over NLe {storeFreeDeliveryMin.toLocaleString()}</p>
                )}
                <div className="flex justify-between font-semibold text-gray-900 text-base pt-2 border-t">
                  <span>Total</span>
                  <span>NLe {orderTotal.toLocaleString()}</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !storeId || (!hasEnoughBalance && !walletsLoading)}
                className={`w-full mt-6 py-3.5 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 ${
                  loading || !storeId || (!hasEnoughBalance && !walletsLoading)
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] shadow-lg shadow-emerald-600/25"
                }`}
              >
                {loading ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Paying...</>
                ) : !hasEnoughBalance && !walletsLoading ? (
                  <><AlertCircle className="w-4 h-4" /> Insufficient Balance</>
                ) : (
                  <><Wallet className="w-4 h-4" /> Pay NLe {orderTotal.toLocaleString()} with Wallet</>
                )}
              </button>

              <div className="mt-4 flex items-center justify-center gap-3 text-xs text-gray-400">
                <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> Encrypted</span>
                <span>|</span>
                <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Secure</span>
                <span>|</span>
                <span>Powered by Peeap</span>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
