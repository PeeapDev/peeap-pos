"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  ArrowLeft,
  ArrowRight,
  ShoppingBag,
} from "lucide-react";

interface CartItem {
  product_id: string;
  name: string;
  price: number;
  image_url?: string;
  quantity: number;
}

function getCartKey(merchantSlug: string) {
  return `cart_${merchantSlug}`;
}

function getCart(merchantSlug: string): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getCartKey(merchantSlug));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCart(merchantSlug: string, cart: CartItem[]) {
  try {
    localStorage.setItem(getCartKey(merchantSlug), JSON.stringify(cart));
    window.dispatchEvent(
      new CustomEvent("cart-updated", { detail: { merchantSlug } })
    );
  } catch {
    // localStorage full or unavailable
  }
}

export default function CartPage() {
  const params = useParams();
  const router = useRouter();
  const merchantSlug = params.merchantSlug as string;

  const [items, setItems] = useState<CartItem[]>([]);
  const [mounted, setMounted] = useState(false);

  const refreshCart = useCallback(() => {
    setItems(getCart(merchantSlug));
  }, [merchantSlug]);

  useEffect(() => {
    setMounted(true);
    refreshCart();
  }, [refreshCart]);

  const updateQuantity = (productId: string, delta: number) => {
    const cart = getCart(merchantSlug);
    const idx = cart.findIndex((item) => item.product_id === productId);
    if (idx < 0) return;

    const newQty = cart[idx].quantity + delta;
    if (newQty <= 0) {
      cart.splice(idx, 1);
    } else {
      cart[idx].quantity = newQty;
    }

    saveCart(merchantSlug, cart);
    setItems([...cart]);
  };

  const removeItem = (productId: string) => {
    const cart = getCart(merchantSlug).filter(
      (item) => item.product_id !== productId
    );
    saveCart(merchantSlug, cart);
    setItems(cart);
  };

  const clearCart = () => {
    saveCart(merchantSlug, []);
    setItems([]);
  };

  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading cart...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/shop/${merchantSlug}`}
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Shopping Cart
            </h1>
          </div>
          {items.length > 0 && (
            <button
              onClick={clearCart}
              className="text-sm text-red-500 hover:text-red-700 transition-colors"
            >
              Clear Cart
            </button>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {items.length === 0 ? (
          /* Empty Cart */
          <div className="text-center py-20">
            <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 mb-2">
              Your cart is empty
            </h2>
            <p className="text-gray-500 mb-6">
              Browse products and add items to get started.
            </p>
            <Link
              href={`/shop/${merchantSlug}`}
              className="inline-flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Continue Shopping
            </Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              {items.map((item) => (
                <div
                  key={item.product_id}
                  className="bg-white rounded-lg p-4 flex gap-4 shadow-sm"
                >
                  {/* Product Image */}
                  <div className="w-20 h-20 relative bg-gray-100 rounded-lg overflow-hidden shrink-0">
                    {item.image_url ? (
                      <Image
                        src={item.image_url}
                        alt={item.name}
                        fill
                        className="object-cover"
                        sizes="80px"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-400 text-xs">
                        No img
                      </div>
                    )}
                  </div>

                  {/* Product Details */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">
                      {item.name}
                    </h3>
                    <p className="text-green-600 font-semibold mt-1">
                      NLe {item.price.toLocaleString()}
                    </p>

                    {/* Quantity Controls */}
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center border rounded-lg">
                        <button
                          onClick={() => updateQuantity(item.product_id, -1)}
                          className="p-1.5 hover:bg-gray-100 transition-colors rounded-l-lg"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="px-3 py-1 text-sm font-medium min-w-[2.5rem] text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.product_id, 1)}
                          className="p-1.5 hover:bg-gray-100 transition-colors rounded-r-lg"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-gray-900">
                          NLe{" "}
                          {(item.price * item.quantity).toLocaleString()}
                        </span>
                        <button
                          onClick={() => removeItem(item.product_id)}
                          className="text-red-400 hover:text-red-600 transition-colors p-1"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Cart Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg p-6 shadow-sm sticky top-20">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Order Summary
                </h2>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Items ({totalItems})</span>
                    <span>NLe {subtotal.toLocaleString()}</span>
                  </div>
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between font-semibold text-gray-900 text-base">
                      <span>Total</span>
                      <span>NLe {subtotal.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() =>
                    router.push(`/shop/${merchantSlug}/checkout`)
                  }
                  className="w-full mt-6 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                >
                  Proceed to Checkout
                  <ArrowRight className="w-4 h-4" />
                </button>

                <Link
                  href={`/shop/${merchantSlug}`}
                  className="block text-center text-sm text-green-600 hover:text-green-700 mt-3 transition-colors"
                >
                  Continue Shopping
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
