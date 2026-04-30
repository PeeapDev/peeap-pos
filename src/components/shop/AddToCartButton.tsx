"use client";

import { useState, useEffect, useRef } from "react";
import { ShoppingCart, Plus, Minus, Check, Eye, CreditCard, LogIn, Loader2 } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

interface CartProduct {
  id: string;
  name: string;
  price: number;
  image_url?: string;
}

interface CartItem {
  product_id: string;
  name: string;
  price: number;
  image_url?: string;
  quantity: number;
}

interface AddToCartButtonProps {
  product: CartProduct;
  merchantSlug: string;
  disabled?: boolean;
  stockQuantity?: number;
  trackInventory?: boolean;
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
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getCartKey(merchantSlug), JSON.stringify(cart));
    window.dispatchEvent(new CustomEvent("cart-updated", { detail: { merchantSlug } }));
  } catch {
    // localStorage might be full or unavailable
  }
}

export default function AddToCartButton({
  product,
  merchantSlug,
  disabled = false,
  stockQuantity,
  trackInventory = false,
}: AddToCartButtonProps) {
  const { user, loading: authLoading, loginPopup } = useAuth();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [existingQty, setExistingQty] = useState(0);
  const [stockError, setStockError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const cart = getCart(merchantSlug);
    const existing = cart.find((item) => item.product_id === product.id);
    if (existing) {
      setExistingQty(existing.quantity);
    }
  }, [merchantSlug, product.id]);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  const handleAdd = () => {
    setStockError(null);

    if (trackInventory && stockQuantity !== undefined) {
      const totalRequested = existingQty + quantity;
      if (totalRequested > stockQuantity) {
        setStockError(
          stockQuantity <= 0
            ? "This product is out of stock."
            : `Only ${stockQuantity} available. You already have ${existingQty} in your cart.`
        );
        return;
      }
    }

    const cart = getCart(merchantSlug);
    const idx = cart.findIndex((item) => item.product_id === product.id);

    if (idx >= 0) {
      cart[idx].quantity += quantity;
    } else {
      cart.push({
        product_id: product.id,
        name: product.name,
        price: product.price,
        image_url: product.image_url,
        quantity,
      });
    }

    saveCart(merchantSlug, cart);
    setExistingQty((prev) => prev + quantity);
    setAdded(true);
    setQuantity(1);

    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setAdded(false), 3000);
  };

  const handleLoginAndAdd = async () => {
    setLoggingIn(true);
    await loginPopup();
    setLoggingIn(false);
  };

  // Not logged in — show Add to Cart but trigger login popup first
  if (!authLoading && !user) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={handleLoginAndAdd}
          disabled={loggingIn || disabled}
          className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-all active:scale-[0.98] ${disabled ? 'bg-gray-300 cursor-not-allowed' : loggingIn ? 'bg-emerald-400' : 'bg-emerald-600 hover:bg-emerald-700'}`}
        >
          {loggingIn ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Signing in...</>
          ) : (
            <><ShoppingCart className="w-5 h-5" /> Add to Cart</>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Quantity selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-700">Quantity:</span>
        <div className="flex items-center border rounded-lg">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="p-2 hover:bg-gray-100 transition-colors rounded-l-lg"
            disabled={disabled}
          >
            <Minus className="w-4 h-4" />
          </button>
          <span className="px-4 py-2 text-center min-w-[3rem] font-medium">
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => setQuantity((q) => q + 1)}
            className="p-2 hover:bg-gray-100 transition-colors rounded-r-lg"
            disabled={disabled}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stock error */}
      {stockError && (
        <p className="text-sm text-red-600 font-medium">{stockError}</p>
      )}

      {/* Add to Cart button */}
      <button
        type="button"
        onClick={handleAdd}
        disabled={disabled || added || authLoading}
        className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-all ${
          added
            ? "bg-emerald-500"
            : disabled
            ? "bg-gray-300 cursor-not-allowed"
            : "bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98]"
        }`}
      >
        {added ? (
          <>
            <Check className="w-5 h-5" />
            Added to Cart!
          </>
        ) : (
          <>
            <ShoppingCart className="w-5 h-5" />
            Add to Cart
          </>
        )}
      </button>

      {/* Post-add actions */}
      {added && (
        <div className="flex gap-3 animate-in fade-in duration-200">
          <Link
            href={`/shop/${merchantSlug}/cart`}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors text-sm"
          >
            <Eye className="w-4 h-4" />
            View Cart
          </Link>
          <Link
            href={`/shop/${merchantSlug}/checkout`}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition-colors text-sm"
          >
            <CreditCard className="w-4 h-4" />
            Checkout
          </Link>
        </div>
      )}

      {existingQty > 0 && !added && (
        <p className="text-sm text-gray-500 text-center">
          {existingQty} already in cart
        </p>
      )}
    </div>
  );
}
