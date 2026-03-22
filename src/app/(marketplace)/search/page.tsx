"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import ProductCard from "@/components/marketplace/ProductCard";
import FilterSidebar from "@/components/marketplace/FilterSidebar";
import { Search, SlidersHorizontal, X } from "lucide-react";

interface SearchProduct {
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
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border">
                <div className="aspect-square bg-gray-200 rounded-t-xl" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-gray-200 rounded w-3/4" />
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    }>
      <SearchPageInner />
    </Suspense>
  );
}

function SearchPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const q = searchParams.get("q") || "";
  const category = searchParams.get("category") || "";
  const sort = searchParams.get("sort") || "relevance";
  const minPrice = searchParams.get("min_price") || "";
  const maxPrice = searchParams.get("max_price") || "";
  const page = parseInt(searchParams.get("page") || "1");

  const [products, setProducts] = useState<SearchProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Fetch categories
  useEffect(() => {
    fetch("/api/marketplace/categories")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories || []))
      .catch(() => {});
  }, []);

  // Search products
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (category) params.set("category", category);
      if (sort) params.set("sort", sort);
      if (minPrice) params.set("min_price", minPrice);
      if (maxPrice) params.set("max_price", maxPrice);
      params.set("page", String(page));
      params.set("per_page", "20");

      const res = await fetch(`/api/marketplace/search?${params}`);
      const data = await res.json();
      setProducts(data.products || []);
      setTotal(data.total || 0);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [q, category, sort, minPrice, maxPrice, page]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const updateFilters = (filters: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(filters)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }
    params.set("page", "1");
    router.push(`/search?${params.toString()}`);
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          {q ? (
            <h1 className="text-xl font-bold text-gray-900">
              Results for &ldquo;{q}&rdquo;
            </h1>
          ) : (
            <h1 className="text-xl font-bold text-gray-900">
              {category ? `Category: ${category}` : "Browse Products"}
            </h1>
          )}
          <p className="text-sm text-gray-500 mt-1">
            {total} product{total !== 1 ? "s" : ""} found
          </p>
        </div>
        <button
          className="lg:hidden flex items-center gap-2 px-3 py-2 border rounded-lg text-sm"
          onClick={() => setShowFilters(!showFilters)}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filters
        </button>
      </div>

      <div className="flex gap-6">
        {/* Sidebar - Desktop */}
        <aside className="hidden lg:block w-56 shrink-0">
          <FilterSidebar
            categories={categories}
            selectedCategory={category}
            minPrice={minPrice}
            maxPrice={maxPrice}
            sort={sort}
            onFilterChange={updateFilters}
          />
        </aside>

        {/* Mobile filter drawer */}
        {showFilters && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setShowFilters(false)}
            />
            <div className="absolute right-0 top-0 bottom-0 w-72 bg-white p-4 overflow-y-auto">
              <FilterSidebar
                categories={categories}
                selectedCategory={category}
                minPrice={minPrice}
                maxPrice={maxPrice}
                sort={sort}
                onFilterChange={(f) => {
                  updateFilters(f);
                  setShowFilters(false);
                }}
                onClose={() => setShowFilters(false)}
              />
            </div>
          </div>
        )}

        {/* Products grid */}
        <div className="flex-1">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl border animate-pulse"
                >
                  <div className="aspect-square bg-gray-200 rounded-t-xl" />
                  <div className="p-3 space-y-2">
                    <div className="h-3 bg-gray-200 rounded w-3/4" />
                    <div className="h-4 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : products.length > 0 ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-8">
                  {page > 1 && (
                    <button
                      className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
                      onClick={() => updateFilters({ page: String(page - 1) })}
                    >
                      Previous
                    </button>
                  )}
                  <span className="px-4 py-2 text-sm text-gray-500">
                    Page {page} of {totalPages}
                  </span>
                  {page < totalPages && (
                    <button
                      className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
                      onClick={() => updateFilters({ page: String(page + 1) })}
                    >
                      Next
                    </button>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-16">
              <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h2 className="text-lg font-medium text-gray-900">
                No products found
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Try adjusting your search or filters
              </p>
              {(q || category || minPrice || maxPrice) && (
                <button
                  onClick={() => router.push("/search")}
                  className="mt-4 inline-flex items-center gap-1 text-sm text-green-600 hover:text-green-700"
                >
                  <X className="w-3 h-3" />
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
