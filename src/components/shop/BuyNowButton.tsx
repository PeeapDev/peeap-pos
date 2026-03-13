"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Zap, Loader2 } from "lucide-react";

interface BuyNowProduct {
  id: string;
  name: string;
  price: number;
  image_url?: string;
}

interface BuyNowButtonProps {
  product: BuyNowProduct;
  merchantSlug: string;
  disabled?: boolean;
}

function getCartKey(merchantSlug: string) {
  return `cart_${merchantSlug}`;
}

export default function BuyNowButton({
  product,
  merchantSlug,
  disabled = false,
}: BuyNowButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleBuyNow = () => {
    if (disabled || loading) return;

    setLoading(true);

    try {
      // Replace the entire cart with just this single item
      const cart = [
        {
          product_id: product.id,
          name: product.name,
          price: product.price,
          image_url: product.image_url,
          quantity: 1,
        },
      ];

      localStorage.setItem(getCartKey(merchantSlug), JSON.stringify(cart));

      // Notify other components (CartIcon) about the cart change
      window.dispatchEvent(
        new CustomEvent("cart-updated", { detail: { merchantSlug } })
      );

      // Navigate to checkout immediately
      router.push(`/shop/${merchantSlug}/checkout`);
    } catch {
      // If localStorage fails, still try to navigate
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleBuyNow}
      disabled={disabled || loading}
      className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold text-white transition-all ${
        disabled
          ? "bg-gray-300 cursor-not-allowed"
          : loading
          ? "bg-blue-400 cursor-wait"
          : "bg-blue-600 hover:bg-blue-700 active:scale-[0.98]"
      }`}
    >
      {loading ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin" />
          Redirecting...
        </>
      ) : (
        <>
          <Zap className="w-5 h-5" />
          Buy Now
        </>
      )}
    </button>
  );
}
