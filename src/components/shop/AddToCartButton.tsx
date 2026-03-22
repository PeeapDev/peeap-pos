"use client";

import { useState, useEffect, useRef } from "react";
import { ShoppingCart, Plus, Minus, Check, Eye, CreditCard, LogIn } from "lucide-react";
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
    // Dispatch a custom event so other components (CartIcon) can react
    window.dispatchEvent(new CustomEvent("cart-updated", { detail: { merchantSlug } }));
  } catch {
    // localStorage might be full or unavailable
  }
}

const PEEAP_URL = process.env.NEXT_PUBLIC_PEEAP_URL || "https://my.peeap.com";
const STORE_URL = process.env.NEXT_PUBLIC_STORE_URL || "https://store.peeap.com";

export default function AddToCartButton({
  product,
  merchantSlug,
  disabled = false,
  stockQuantity,
  trackInventory = false,
}: AddToCartButtonProps) {
  const { user, loading: authLoading, login } = useAuth();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [existingQty, setExistingQty] = useState(0);
  const [stockError, setStockError] = useState<string | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const cart = getCart(merchantSlug);
    const existing = cart.find((item) => item.product_id === product.id);
    if (existing) {
      setExistingQty(existing.quantity);
    }
  }, [merchantSlug, product.id]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  const handleAdd = () => {
    setStockError(null);

    // Client-side stock validation
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

    // Clear any previous timer
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }

    // Auto-hide after 3 seconds
    hideTimerRef.current = setTimeout(() => setAdded(false), 3000);
  };

  // Not logged in — show login button instead of add to cart
  if (!authLoading && !user) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => {
            const redirect = `${STORE_URL}/shop/${merchantSlug}`;
            login(redirect);
          }}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold text-white bg-green-600 hover:bg-green-700 active:scale-[0.98] transition-all"
        >
          <LogIn className="w-5 h-5" />
          Login to Add to Cart
        </button>
        <p className="text-xs text-gray-400 text-center">
          Sign in with your Peeap account to shop
        </p>
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
        className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold text-white transition-all ${
          added
            ? "bg-green-500"
            : disabled
            ? "bg-gray-300 cursor-not-allowed"
            : "bg-green-600 hover:bg-green-700 active:scale-[0.98]"
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

      {/* Post-add actions: View Cart and Checkout links */}
      {added && (
        <div className="flex gap-3 animate-in fade-in duration-200">
          <Link
            href={`/shop/${merchantSlug}/cart`}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-green-700 bg-green-50 border border-green-200 hover:bg-green-100 transition-colors text-sm"
          >
            <Eye className="w-4 h-4" />
            View Cart
          </Link>
          <Link
            href={`/shop/${merchantSlug}/checkout`}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-white bg-green-600 hover:bg-green-700 transition-colors text-sm"
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
