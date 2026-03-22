"use client";

import Image from "next/image";
import Link from "next/link";
import { Star, MapPin, Truck } from "lucide-react";
import VerifiedBadge from "./VerifiedBadge";

interface StoreCardProps {
  store: {
    id: string;
    name: string;
    slug: string;
    description?: string;
    logo_url?: string;
    city?: string;
    is_verified?: boolean;
    average_rating?: number;
    total_ratings?: number;
    total_orders?: number;
    offers_delivery?: boolean;
  };
}

export default function StoreCard({ store }: StoreCardProps) {
  return (
    <Link
      href={`/shop/${store.slug}`}
      className="bg-white rounded-xl border p-4 hover:shadow-md transition-shadow flex items-start gap-4"
    >
      {/* Logo */}
      {store.logo_url ? (
        <Image
          src={store.logo_url}
          alt={store.name}
          width={56}
          height={56}
          className="rounded-full shrink-0 object-cover"
        />
      ) : (
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold text-xl shrink-0">
          {store.name.charAt(0)}
        </div>
      )}

      {/* Info */}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <h3 className="font-medium text-gray-900 truncate">{store.name}</h3>
          {store.is_verified && <VerifiedBadge size="sm" />}
        </div>

        {store.description && (
          <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">
            {store.description}
          </p>
        )}

        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
          {(store.average_rating ?? 0) > 0 && (
            <span className="flex items-center gap-0.5">
              <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
              {(store.average_rating ?? 0).toFixed(1)}
              {(store.total_ratings ?? 0) > 0 && (
                <span className="text-gray-400">({store.total_ratings})</span>
              )}
            </span>
          )}
          {store.city && (
            <span className="flex items-center gap-0.5">
              <MapPin className="w-3 h-3" />
              {store.city}
            </span>
          )}
          {store.offers_delivery && (
            <span className="flex items-center gap-0.5 text-green-600">
              <Truck className="w-3 h-3" />
              Delivery
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
