"use client";

import { useEffect, useState } from "react";
import MarketplaceHeader from "@/components/marketplace/MarketplaceHeader";
import Link from "next/link";

interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  children?: Category[];
}

export default function MarketplaceShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    fetch("/api/marketplace/categories")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories || []))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <MarketplaceHeader categories={categories} />
      <main className="flex-1">{children}</main>
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
                <Link href="/account" className="block hover:text-green-600">
                  Profile
                </Link>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Sell</h4>
              <div className="space-y-2 text-gray-600">
                <Link href="/dashboard" className="block hover:text-green-600">
                  Merchant Dashboard
                </Link>
                <Link href="/dashboard/products" className="block hover:text-green-600">
                  List Products
                </Link>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Peeap</h4>
              <div className="space-y-2 text-gray-600">
                <a
                  href="https://my.peeap.com"
                  className="block hover:text-green-600"
                >
                  Peeap Pay
                </a>
                <a
                  href="https://docs.peeap.com"
                  className="block hover:text-green-600"
                >
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
