"use client";

import Link from "next/link";
import MarketplaceHeader from "@/components/marketplace/MarketplaceHeader";
import HeroBanner from "@/components/marketplace/HeroBanner";
import CategoryNav from "@/components/marketplace/CategoryNav";
import ProductCard from "@/components/marketplace/ProductCard";
import StoreCard from "@/components/marketplace/StoreCard";
import { ArrowRight } from "lucide-react";

interface HomepageData {
  banners: Array<{
    id: string;
    title: string;
    subtitle: string | null;
    image_url: string;
    link_url: string | null;
    link_type: string;
    link_target: string | null;
  }>;
  categories: Array<{
    id: string;
    name: string;
    slug: string;
    icon: string | null;
    color: string;
    product_count: number;
  }>;
  trending_products: Array<Record<string, unknown>>;
  featured_stores: Array<Record<string, unknown>>;
  new_arrivals: Array<Record<string, unknown>>;
}

export default function MarketplaceHome({ data }: { data: HomepageData }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <MarketplaceHeader
        categories={data.categories.map((c) => ({
          ...c,
          icon: c.icon || undefined,
        }))}
      />

      {/* Hero Banners */}
      <HeroBanner
        banners={data.banners.map((b) => ({
          ...b,
          subtitle: b.subtitle || undefined,
          link_url: b.link_url || undefined,
          link_target: b.link_target || undefined,
        }))}
      />

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-10">
        {/* Categories */}
        {data.categories.length > 0 && (
          <section>
            <CategoryNav
              categories={data.categories.map((c) => ({
                ...c,
                icon: c.icon || undefined,
              }))}
            />
          </section>
        )}

        {/* Trending Products */}
        {data.trending_products.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Trending</h2>
              <Link
                href="/search?sort=popular"
                className="text-sm text-green-600 hover:text-green-700 font-medium flex items-center gap-1"
              >
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {data.trending_products.map((product) => (
                <ProductCard
                  key={product.id as string}
                  product={product as ProductCardProduct}
                />
              ))}
            </div>
          </section>
        )}

        {/* Featured Stores */}
        {data.featured_stores.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                Featured Stores
              </h2>
              <Link
                href="/search"
                className="text-sm text-green-600 hover:text-green-700 font-medium flex items-center gap-1"
              >
                All Stores <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {data.featured_stores.map((store) => (
                <StoreCard
                  key={store.id as string}
                  store={store as StoreCardStore}
                />
              ))}
            </div>
          </section>
        )}

        {/* New Arrivals */}
        {data.new_arrivals.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">New Arrivals</h2>
              <Link
                href="/search?sort=newest"
                className="text-sm text-green-600 hover:text-green-700 font-medium flex items-center gap-1"
              >
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {data.new_arrivals.map((product) => (
                <ProductCard
                  key={product.id as string}
                  product={product as ProductCardProduct}
                />
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {data.trending_products.length === 0 &&
          data.featured_stores.length === 0 &&
          data.new_arrivals.length === 0 && (
            <div className="text-center py-20">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Welcome to Peeap Store
              </h2>
              <p className="text-gray-500 max-w-md mx-auto mb-6">
                The marketplace is setting up. Be the first merchant to list
                your products and reach customers across Sierra Leone.
              </p>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
              >
                Start Selling
              </Link>
            </div>
          )}
      </div>

      {/* Footer */}
      <footer className="bg-white border-t py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Shop</h4>
              <div className="space-y-2 text-gray-600">
                <Link href="/search" className="block hover:text-green-600">
                  Browse Products
                </Link>
                <Link href="/search?sort=popular" className="block hover:text-green-600">
                  Trending
                </Link>
                <Link href="/search?sort=newest" className="block hover:text-green-600">
                  New Arrivals
                </Link>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Account</h4>
              <div className="space-y-2 text-gray-600">
                <Link href="/account/orders" className="block hover:text-green-600">
                  My Orders
                </Link>
                <Link href="/account/wishlist" className="block hover:text-green-600">
                  Wishlist
                </Link>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Sell</h4>
              <div className="space-y-2 text-gray-600">
                <Link href="/dashboard" className="block hover:text-green-600">
                  Merchant Dashboard
                </Link>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Peeap</h4>
              <div className="space-y-2 text-gray-600">
                <a href="https://my.peeap.com" className="block hover:text-green-600">
                  Peeap Pay
                </a>
                <a href="https://docs.peeap.com" className="block hover:text-green-600">
                  Developers
                </a>
              </div>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t text-center text-xs text-gray-400">
            Powered by Peeap &mdash; Payments for Sierra Leone
          </div>
        </div>
      </footer>
    </div>
  );
}

// Type aliases for the components
type ProductCardProduct = {
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

type StoreCardStore = {
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
