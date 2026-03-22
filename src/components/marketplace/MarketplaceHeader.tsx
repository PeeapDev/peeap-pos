"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  ShoppingBag,
  Heart,
  User,
  Menu,
  X,
  ChevronDown,
} from "lucide-react";

interface MarketplaceCategory {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  children?: MarketplaceCategory[];
}

export default function MarketplaceHeader({
  categories = [],
}: {
  categories?: MarketplaceCategory[];
}) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showCategories, setShowCategories] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="bg-white border-b sticky top-0 z-50">
      {/* Top bar */}
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center gap-4 h-16">
          {/* Mobile menu toggle */}
          <button
            className="lg:hidden p-2 -ml-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>

          {/* Logo */}
          <Link
            href="/"
            className="text-xl font-bold text-green-600 shrink-0"
          >
            Peeap Store
          </Link>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="flex-1 max-w-xl mx-4 hidden sm:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products, stores..."
                className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:bg-white"
              />
            </div>
          </form>

          {/* Right actions */}
          <div className="flex items-center gap-1 shrink-0">
            <Link
              href="/account/wishlist"
              className="p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100"
              title="Wishlist"
            >
              <Heart className="w-5 h-5" />
            </Link>
            <Link
              href="/account/orders"
              className="p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100"
              title="Orders"
            >
              <ShoppingBag className="w-5 h-5" />
            </Link>
            <Link
              href="/account"
              className="p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100"
              title="Account"
            >
              <User className="w-5 h-5" />
            </Link>
            <Link
              href="/dashboard"
              className="hidden lg:inline-flex items-center gap-1 ml-2 px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100"
            >
              Sell on Peeap
            </Link>
          </div>
        </div>

        {/* Mobile search */}
        <form onSubmit={handleSearch} className="sm:hidden pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products, stores..."
              className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:bg-white"
            />
          </div>
        </form>
      </div>

      {/* Category nav */}
      {categories.length > 0 && (
        <div className="border-t hidden lg:block">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center gap-1 overflow-x-auto py-2">
              <button
                className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 hover:text-green-600 rounded-lg hover:bg-gray-50 shrink-0"
                onClick={() => setShowCategories(!showCategories)}
              >
                <Menu className="w-4 h-4" />
                All Categories
                <ChevronDown className="w-3 h-3" />
              </button>
              {categories.slice(0, 8).map((cat) => (
                <Link
                  key={cat.id}
                  href={`/category/${cat.slug}`}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-green-600 rounded-lg hover:bg-gray-50 whitespace-nowrap shrink-0"
                >
                  {cat.icon && <span className="mr-1">{cat.icon}</span>}
                  {cat.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Category dropdown */}
      {showCategories && categories.length > 0 && (
        <div className="absolute left-0 right-0 bg-white border-t shadow-lg z-40">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/category/${cat.slug}`}
                  onClick={() => setShowCategories(false)}
                  className="flex items-center gap-2 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {cat.icon && (
                    <span className="text-lg">{cat.icon}</span>
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {cat.name}
                    </p>
                    {cat.children && cat.children.length > 0 && (
                      <p className="text-xs text-gray-500">
                        {cat.children.length} subcategories
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t bg-white">
          <div className="p-4 space-y-2">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/category/${cat.slug}`}
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
              >
                {cat.icon && <span className="mr-2">{cat.icon}</span>}
                {cat.name}
              </Link>
            ))}
            <div className="border-t pt-2 mt-2">
              <Link
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 text-sm font-medium text-green-600 hover:bg-green-50 rounded-lg"
              >
                Sell on Peeap
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
