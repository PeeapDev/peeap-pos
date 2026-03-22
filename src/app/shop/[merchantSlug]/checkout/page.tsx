"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Loader2,
  ShoppingBag,
  Smartphone,
  Wallet,
  AlertCircle,
  Lock,
  LogIn,
  User,
  MapPin,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface CartItem {
  product_id: string;
  name: string;
  price: number;
  image_url?: string;
  quantity: number;
}

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
  } catch {
    // ignore
  }
}

const STORE_URL = process.env.NEXT_PUBLIC_STORE_URL || "https://store.peeap.com";

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const merchantSlug = params.merchantSlug as string;

  const { user, token, loading: authLoading, login, exchangeToken } = useAuth();

  const [items, setItems] = useState<CartItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeLoading, setStoreLoading] = useState(true);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [exchangingToken, setExchangingToken] = useState(false);

  // Form state — only shipping address and notes (user info comes from profile)
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<
    "mobile_money" | "wallet"
  >("mobile_money");

  // Handle auth callback — exchange ?token= code for session
  useEffect(() => {
    const code = searchParams.get("token");
    if (code && !user && !authLoading) {
      setExchangingToken(true);
      exchangeToken(code).then((success) => {
        setExchangingToken(false);
        if (success) {
          const url = new URL(window.location.href);
          url.searchParams.delete("token");
          window.history.replaceState({}, "", url.toString());
        }
      });
    }
  }, [searchParams, user, authLoading, exchangeToken]);

  useEffect(() => {
    setMounted(true);
    const cart = getCart(merchantSlug);
    setItems(cart);

    // If cart is empty, redirect to store
    if (cart.length === 0) {
      // We'll handle this in the render phase since router might not be ready
    }

    // Fetch store ID by slug
    setStoreLoading(true);
    fetch(`/api/stores?slug=${merchantSlug}`)
      .then((res) => {
        if (!res.ok) throw new Error("Store not found");
        return res.json();
      })
      .then((data) => {
        if (data.store?.id) {
          setStoreId(data.store.id);
        } else {
          setStoreError(
            "Could not load store information. Please try again later."
          );
        }
      })
      .catch((err) => {
        console.error("Failed to fetch store:", err);
        setStoreError(
          "Failed to load store information. Please check your connection and try again."
        );
      })
      .finally(() => {
        setStoreLoading(false);
      });
  }, [merchantSlug]);

  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  const handleLogin = () => {
    const checkoutUrl = `${STORE_URL}/shop/${merchantSlug}/checkout`;
    login(checkoutUrl);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user || !token) {
      setError("You must be logged in to place an order.");
      return;
    }

    if (!storeId) {
      setError("Store information not available. Please try again.");
      return;
    }

    if (items.length === 0) {
      setError("Your cart is empty.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          store_id: storeId,
          customer_name: user.name || user.email || user.phone || "Peeap User",
          customer_phone: user.phone || "",
          customer_email: user.email || undefined,
          customer_id: user.id,
          items: items.map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
          })),
          payment_method: paymentMethod,
          notes: notes.trim() || undefined,
          delivery_address: deliveryAddress.trim() || undefined,
          order_type: deliveryAddress.trim() ? "delivery" : "online",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to place order");
      }

      // Clear cart on success
      clearCart(merchantSlug);

      // Redirect based on payment method
      if (paymentMethod === "mobile_money" && data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        // Redirect to order confirmation page
        router.push(
          `/shop/${merchantSlug}/order/${data.order.id}`
        );
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong"
      );
      setLoading(false);
    }
  };

  if (!mounted || storeLoading || authLoading || exchangingToken) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-green-600 mx-auto mb-3" />
          <p className="text-gray-500">
            {exchangingToken ? "Signing you in..." : "Loading checkout..."}
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
          <h2 className="text-xl font-semibold text-gray-700 mb-2">
            Something went wrong
          </h2>
          <p className="text-gray-500 mb-6">{storeError}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors"
            >
              Try Again
            </button>
            <Link
              href={`/shop/${merchantSlug}`}
              className="inline-flex items-center gap-2 bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Store
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0 && mounted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">
            No items to checkout
          </h2>
          <p className="text-gray-500 mb-6">
            Add some products to your cart first.
          </p>
          <Link
            href={`/shop/${merchantSlug}`}
            className="inline-flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Browse Products
          </Link>
        </div>
      </div>
    );
  }

  // Not logged in — show login prompt
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b">
          <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
            <Link href={`/shop/${merchantSlug}/cart`} className="text-gray-600 hover:text-gray-900">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Lock className="w-5 h-5 text-green-600" />
              Checkout
            </h1>
          </div>
        </div>
        <div className="max-w-md mx-auto px-4 py-16 text-center">
          <div className="bg-white rounded-2xl p-8 shadow-sm">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <LogIn className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Sign in to continue</h2>
            <p className="text-gray-500 mb-6">
              You need a Peeap account to place an order. Sign in to auto-fill your details and track your orders.
            </p>
            <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
              <p className="text-sm font-medium text-gray-700 mb-1">Your cart ({totalItems} {totalItems === 1 ? "item" : "items"})</p>
              <p className="text-lg font-bold text-gray-900">NLe {subtotal.toLocaleString()}</p>
            </div>
            <button onClick={handleLogin} className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2">
              <LogIn className="w-5 h-5" />
              Login with Peeap
            </button>
            <p className="text-xs text-gray-400 mt-4">
              Don&apos;t have an account?{" "}
              <a href={`${process.env.NEXT_PUBLIC_AUTH_URL || "https://auth.peeap.com"}/register?client=store&redirect=${encodeURIComponent(`${STORE_URL}/shop/${merchantSlug}/checkout`)}`} className="text-green-600 hover:underline">
                Create one for free
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/shop/${merchantSlug}/cart`} className="text-gray-600 hover:text-gray-900 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Lock className="w-5 h-5 text-green-600" />
              Checkout
            </h1>
          </div>
          <Link href={`/shop/${merchantSlug}/cart`} className="text-sm font-medium text-green-600 hover:text-green-700 transition-colors">
            Back to Cart
          </Link>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-5xl mx-auto px-4 py-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        <div className="grid lg:grid-cols-5 gap-6">
          {/* Checkout Form */}
          <div className="lg:col-span-3 space-y-6">
            {/* User Info (read-only from Peeap profile) */}
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-green-600" />
                Your Information
              </h2>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
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

            {/* Shipping Address */}
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-green-600" />
                Shipping Address
              </h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                    Delivery Address <span className="text-gray-400 font-normal">(leave blank for pickup)</span>
                  </label>
                  <textarea
                    id="address"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Enter your full delivery address..."
                    rows={3}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-colors resize-none"
                  />
                </div>
                <div>
                  <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                    Order Notes <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Special instructions for your order..."
                    rows={2}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-colors resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Payment Method */}
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Payment Method
              </h2>

              <div className="space-y-3">
                <label
                  className={`flex items-center gap-4 p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    paymentMethod === "mobile_money"
                      ? "border-green-500 bg-green-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="payment_method"
                    value="mobile_money"
                    checked={paymentMethod === "mobile_money"}
                    onChange={() => setPaymentMethod("mobile_money")}
                    className="text-green-600 focus:ring-green-500"
                  />
                  <Smartphone className="w-5 h-5 text-orange-500" />
                  <div>
                    <p className="font-medium text-gray-900">Mobile Money</p>
                    <p className="text-sm text-gray-500">
                      Pay with Orange Money or other mobile wallets
                    </p>
                  </div>
                </label>

                <label
                  className={`flex items-center gap-4 p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    paymentMethod === "wallet"
                      ? "border-green-500 bg-green-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="payment_method"
                    value="wallet"
                    checked={paymentMethod === "wallet"}
                    onChange={() => setPaymentMethod("wallet")}
                    className="text-green-600 focus:ring-green-500"
                  />
                  <Wallet className="w-5 h-5 text-green-500" />
                  <div>
                    <p className="font-medium text-gray-900">
                      Peeap Wallet
                    </p>
                    <p className="text-sm text-gray-500">
                      Pay with your Peeap wallet balance
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg p-6 shadow-sm sticky top-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Order Summary
              </h2>

              <div className="space-y-3 max-h-64 overflow-y-auto">
                {items.map((item) => (
                  <div
                    key={item.product_id}
                    className="flex gap-3 items-start"
                  >
                    <div className="w-12 h-12 relative bg-gray-100 rounded overflow-hidden shrink-0">
                      {item.image_url ? (
                        <Image
                          src={item.image_url}
                          alt={item.name}
                          fill
                          className="object-cover"
                          sizes="48px"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-400 text-[10px]">
                          No img
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {item.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        Qty: {item.quantity}
                      </p>
                    </div>
                    <p className="text-sm font-medium text-gray-900 shrink-0">
                      NLe{" "}
                      {(item.price * item.quantity).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>

              <div className="border-t mt-4 pt-4 space-y-2 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal ({totalItems} items)</span>
                  <span>NLe {subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-semibold text-gray-900 text-base pt-2 border-t">
                  <span>Total</span>
                  <span>NLe {subtotal.toLocaleString()}</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !storeId}
                className={`w-full mt-6 py-3 rounded-lg font-semibold text-white transition-colors flex items-center justify-center gap-2 ${
                  loading || !storeId
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-green-600 hover:bg-green-700"
                }`}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    Place Order - NLe {subtotal.toLocaleString()}
                  </>
                )}
              </button>

              <p className="text-xs text-gray-400 text-center mt-3">
                Secure checkout powered by Peeap
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
