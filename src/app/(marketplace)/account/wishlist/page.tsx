"use client";

import { useEffect, useState } from "react";
import ProductCard from "@/components/marketplace/ProductCard";
import { Heart } from "lucide-react";

interface WishlistItem {
  id: string;
  product: {
    id: string;
    name: string;
    price: number;
    image_url?: string;
    slug?: string;
    average_rating?: number;
    is_active: boolean;
    is_published: boolean;
  };
  store: {
    id: string;
    name: string;
    slug: string;
    logo_url?: string;
  };
}

export default function WishlistPage() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchWishlist() {
      try {
        const token = document.cookie
          .split("; ")
          .find((row) => row.startsWith("auth_token="))
          ?.split("=")[1];

        if (!token) {
          setLoading(false);
          return;
        }

        const res = await fetch("/api/marketplace/wishlist", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setItems(data.wishlist || []);
        }
      } catch {
        // Not authenticated
      } finally {
        setLoading(false);
      }
    }
    fetchWishlist();
  }, []);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border animate-pulse">
              <div className="aspect-square bg-gray-200 rounded-t-xl" />
              <div className="p-3 space-y-2">
                <div className="h-3 bg-gray-200 rounded w-3/4" />
                <div className="h-4 bg-gray-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Wishlist</h1>

      {items.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {items.map((item) => (
            <ProductCard
              key={item.id}
              product={{
                ...item.product,
                store: item.store,
              }}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <Heart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-gray-900">
            Your wishlist is empty
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Save products you like by clicking the heart icon
          </p>
        </div>
      )}
    </div>
  );
}
