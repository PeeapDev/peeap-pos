"use client";

import { useState } from "react";
import { ShoppingCart, Check, LogIn } from "lucide-react";
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

const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_URL || "https://auth.peeap.com";
const STORE_URL = process.env.NEXT_PUBLIC_STORE_URL || "https://store.peeap.com";

export default function QuickAddToCartButton({
  product,
  merchantSlug,
}: QuickAddToCartButtonProps) {
  const { user, loading: authLoading, login } = useAuth();
  const [added, setAdded] = useState(false);

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Require login
    if (!user && !authLoading) {
      login(`${STORE_URL}/shop/${merchantSlug}`);
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
      className={`absolute bottom-2 right-2 p-2 rounded-full shadow-md transition-all z-10 ${
        added
          ? "bg-green-500 text-white scale-110"
          : "bg-white text-gray-700 hover:bg-green-600 hover:text-white hover:scale-110 opacity-0 group-hover:opacity-100"
      }`}
      title={added ? "Added!" : "Add to Cart"}
    >
      {added ? (
        <Check className="w-4 h-4" />
      ) : (
        <ShoppingCart className="w-4 h-4" />
      )}
    </button>
  );
}
