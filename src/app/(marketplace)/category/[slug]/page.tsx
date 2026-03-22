"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import ProductCard from "@/components/marketplace/ProductCard";
import { Package } from "lucide-react";

interface Product {
  id: string;
  name: string;
  price: number;
  image_url?: string;
  slug?: string;
  average_rating?: number;
  total_ratings?: number;
  order_count?: number;
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
  description?: string;
  icon?: string;
  color?: string;
}

export default function CategoryPage() {
  return (
    <Suspense fallback={
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {[...Array(10)].map((_, i) => (
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
      <CategoryPageInner />
    </Suspense>
  );
}

function CategoryPageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const slug = params.slug as string;

  const sort = searchParams.get("sort") || "popular";
  const page = parseInt(searchParams.get("page") || "1");

  const [category, setCategory] = useState<Category | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchCategory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("sort", sort);
      params.set("page", String(page));
      params.set("per_page", "20");

      const res = await fetch(
        `/api/marketplace/categories/${slug}?${params}`
      );
      if (!res.ok) {
        setCategory(null);
        setProducts([]);
        setTotal(0);
        return;
      }
      const data = await res.json();
      setCategory(data.category);
      setProducts(data.products || []);
      setTotal(data.total || 0);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [slug, sort, page]);

  useEffect(() => {
    fetchCategory();
  }, [fetchCategory]);

  const totalPages = Math.ceil(total / 20);

  const sortOptions = [
    { value: "popular", label: "Most Popular" },
    { value: "newest", label: "Newest" },
    { value: "price_asc", label: "Price: Low to High" },
    { value: "price_desc", label: "Price: High to Low" },
    { value: "rating", label: "Top Rated" },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Category header */}
      {category && (
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            {category.icon && <span className="text-2xl">{category.icon}</span>}
            {category.name}
          </h1>
          {category.description && (
            <p className="text-sm text-gray-500 mt-1">{category.description}</p>
          )}
          <p className="text-sm text-gray-400 mt-1">
            {total} product{total !== 1 ? "s" : ""}
          </p>
        </div>
      )}

      {/* Sort bar */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
        {sortOptions.map((opt) => (
          <button
            key={opt.value}
            className={`px-3 py-1.5 text-sm rounded-full border whitespace-nowrap transition-colors ${
              sort === opt.value
                ? "bg-green-50 border-green-500 text-green-700 font-medium"
                : "text-gray-600 hover:bg-gray-50"
            }`}
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString());
              params.set("sort", opt.value);
              params.set("page", "1");
              router.push(`/category/${slug}?${params}`);
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Products */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border animate-pulse">
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              {page > 1 && (
                <button
                  className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
                  onClick={() => {
                    const p = new URLSearchParams(searchParams.toString());
                    p.set("page", String(page - 1));
                    router.push(`/category/${slug}?${p}`);
                  }}
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
                  onClick={() => {
                    const p = new URLSearchParams(searchParams.toString());
                    p.set("page", String(page + 1));
                    router.push(`/category/${slug}?${p}`);
                  }}
                >
                  Next
                </button>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-16">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-gray-900">
            No products in this category yet
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Check back soon for new listings
          </p>
        </div>
      )}
    </div>
  );
}
