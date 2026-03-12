"use client";

import { useState, useEffect, useCallback } from "react";
import { ShoppingCart } from "lucide-react";
import Link from "next/link";

interface CartIconProps {
  merchantSlug: string;
}

function getCartCount(merchantSlug: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(`cart_${merchantSlug}`);
    if (!raw) return 0;
    const items: Array<{ quantity: number }> = JSON.parse(raw);
    return items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  } catch {
    return 0;
  }
}

export default function CartIcon({ merchantSlug }: CartIconProps) {
  const [count, setCount] = useState(0);

  const refresh = useCallback(() => {
    setCount(getCartCount(merchantSlug));
  }, [merchantSlug]);

  useEffect(() => {
    refresh();

    // Listen for cart changes from AddToCartButton
    const handler = () => refresh();
    window.addEventListener("cart-updated", handler);
    // Also listen for storage events (cross-tab)
    window.addEventListener("storage", handler);

    return () => {
      window.removeEventListener("cart-updated", handler);
      window.removeEventListener("storage", handler);
    };
  }, [refresh]);

  return (
    <Link
      href={`/shop/${merchantSlug}/cart`}
      className="fixed bottom-6 right-6 z-50 bg-green-600 text-white p-4 rounded-full shadow-lg hover:bg-green-700 transition-all hover:scale-105 active:scale-95"
      aria-label={`Shopping cart with ${count} items`}
    >
      <ShoppingCart className="w-6 h-6" />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[22px] h-[22px] flex items-center justify-center px-1">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
