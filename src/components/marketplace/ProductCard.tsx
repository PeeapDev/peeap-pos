"use client";

import Link from "next/link";
import { Star, Heart, ShoppingCart } from "lucide-react";
import VerifiedBadge from "./VerifiedBadge";
import MoneyBackBadge from "./MoneyBackBadge";
import CldImage from "@/components/CldImage";

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    price: number;
    image_url?: string;
    images?: string[];
    slug?: string;
    average_rating?: number;
    total_ratings?: number;
    order_count?: number;
    brand?: string;
    store?: {
      id: string;
      name: string;
      slug: string;
      logo_url?: string;
      is_verified?: boolean;
    };
  };
  showStore?: boolean;
}

export default function ProductCard({
  product,
  showStore = true,
}: ProductCardProps) {
  const imageUrl = product.image_url || product.images?.[0];
  const storeSlug = product.store?.slug;
  const productLink = storeSlug
    ? `/shop/${storeSlug}/${product.slug || product.id}`
    : `/search?q=${encodeURIComponent(product.name)}`;

  return (
    <div className="bg-white rounded-xl border overflow-hidden group hover:shadow-md transition-shadow">
      {/* Image */}
      <Link href={productLink} className="block relative aspect-square overflow-hidden bg-gray-100">
        {imageUrl ? (
          <CldImage
            src={imageUrl}
            preset="card"
            alt={product.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <ShoppingCart className="w-12 h-12" />
          </div>
        )}

        {/* Wishlist button */}
        <button className="absolute top-2 right-2 p-1.5 bg-white/80 backdrop-blur-sm rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white">
          <Heart className="w-4 h-4 text-gray-600" />
        </button>
      </Link>

      {/* Info */}
      <div className="p-3">
        {/* Store name */}
        {showStore && product.store && (
          <Link
            href={`/shop/${product.store.slug}`}
            className="text-[11px] text-gray-500 hover:text-green-600 flex items-center gap-1 mb-1"
          >
            {product.store.name}
            {product.store.is_verified && <VerifiedBadge size="sm" />}
          </Link>
        )}

        {/* Product name */}
        <Link href={productLink}>
          <h3 className="text-sm font-medium text-gray-900 line-clamp-2 hover:text-green-600">
            {product.name}
          </h3>
        </Link>

        {/* Rating */}
        {(product.average_rating ?? 0) > 0 && (
          <div className="flex items-center gap-1 mt-1">
            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
            <span className="text-xs text-gray-600">
              {(product.average_rating ?? 0).toFixed(1)}
            </span>
            {(product.total_ratings ?? 0) > 0 && (
              <span className="text-xs text-gray-400">
                ({product.total_ratings})
              </span>
            )}
          </div>
        )}

        {/* Price */}
        <p className="mt-2 text-base font-bold text-gray-900">
          NLe {product.price.toLocaleString()}
        </p>

        {/* Orders count */}
        {(product.order_count ?? 0) > 0 && (
          <p className="text-[11px] text-gray-400 mt-0.5">
            {product.order_count} sold
          </p>
        )}

        {/* Money back guarantee */}
        <div className="mt-2">
          <MoneyBackBadge />
        </div>
      </div>
    </div>
  );
}
