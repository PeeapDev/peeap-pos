"use client";

import { useState } from "react";
import { ShoppingCart, Check, LogIn, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface QuickAddToCartButtonProps {
  product: {
    id: string;
    name: string;
    price: number;
    image_url?: string | null;
  };
  merchantSlug: string;
}

function getCartKey(merchantSlug: string) {
  return `cart_${merchantSlug}`;
}

function getCart(merchantSlug: string) {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getCartKey(merchantSlug));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export default function QuickAddToCartButton({
  product,
  merchantSlug,
}: QuickAddToCartButtonProps) {
  const { user, loading: authLoading, loginPopup } = useAuth();
  const [added, setAdded] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);

  const handleAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Require login via popup
    if (!user && !authLoading) {
      setLoggingIn(true);
      await loginPopup();
      setLoggingIn(false);
      return;
    }

    if (added) return;

    try {
      const cart = getCart(merchantSlug);
      const idx = cart.findIndex(
        (item: { product_id: string }) => item.product_id === product.id
      );

      if (idx >= 0) {
        cart[idx].quantity += 1;
      } else {
        cart.push({
          product_id: product.id,
          name: product.name,
          price: product.price,
          image_url: product.image_url,
          quantity: 1,
        });
      }

      localStorage.setItem(getCartKey(merchantSlug), JSON.stringify(cart));
      window.dispatchEvent(
        new CustomEvent("cart-updated", { detail: { merchantSlug } })
      );

      setAdded(true);
      setTimeout(() => setAdded(false), 1500);
    } catch {
      // localStorage might be full or unavailable
    }
  };

  return (
    <button
      type="button"
      onClick={handleAdd}
      disabled={loggingIn}
      className={`absolute bottom-2 right-2 p-2 rounded-full shadow-md transition-all z-10 ${
        loggingIn
          ? "bg-emerald-100 text-emerald-600 scale-110"
          : added
          ? "bg-emerald-500 text-white scale-110"
          : "bg-white text-gray-700 hover:bg-emerald-600 hover:text-white hover:scale-110 opacity-0 group-hover:opacity-100"
      }`}
      title={loggingIn ? "Signing in..." : added ? "Added!" : user ? "Add to Cart" : "Sign in to add"}
    >
      {loggingIn ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : added ? (
        <Check className="w-4 h-4" />
      ) : !user && !authLoading ? (
        <LogIn className="w-4 h-4" />
      ) : (
        <ShoppingCart className="w-4 h-4" />
      )}
    </button>
  );
}
