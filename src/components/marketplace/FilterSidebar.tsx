"use client";

import { useState } from "react";
import { ChevronDown, X } from "lucide-react";

interface FilterSidebarProps {
  categories?: Array<{ id: string; name: string; slug: string }>;
  selectedCategory?: string;
  minPrice?: string;
  maxPrice?: string;
  sort?: string;
  onFilterChange: (filters: Record<string, string>) => void;
  onClose?: () => void;
}

export default function FilterSidebar({
  categories = [],
  selectedCategory,
  minPrice = "",
  maxPrice = "",
  sort = "relevance",
  onFilterChange,
  onClose,
}: FilterSidebarProps) {
  const [localMinPrice, setLocalMinPrice] = useState(minPrice);
  const [localMaxPrice, setLocalMaxPrice] = useState(maxPrice);

  const sortOptions = [
    { value: "relevance", label: "Most Relevant" },
    { value: "popular", label: "Most Popular" },
    { value: "newest", label: "Newest First" },
    { value: "price_asc", label: "Price: Low to High" },
    { value: "price_desc", label: "Price: High to Low" },
    { value: "rating", label: "Highest Rated" },
  ];

  const applyPriceFilter = () => {
    onFilterChange({
      min_price: localMinPrice,
      max_price: localMaxPrice,
    });
  };

  return (
    <div className="space-y-6">
      {/* Mobile close */}
      {onClose && (
        <div className="flex items-center justify-between lg:hidden">
          <h3 className="font-semibold text-gray-900">Filters</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Sort */}
      <div>
        <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-1">
          Sort By
          <ChevronDown className="w-3 h-3" />
        </h4>
        <div className="space-y-1">
          {sortOptions.map((opt) => (
            <button
              key={opt.value}
              className={`block w-full text-left px-3 py-1.5 text-sm rounded-lg transition-colors ${
                sort === opt.value
                  ? "bg-green-50 text-green-700 font-medium"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
              onClick={() => onFilterChange({ sort: opt.value })}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Categories */}
      {categories.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-2">Category</h4>
          <div className="space-y-1">
            <button
              className={`block w-full text-left px-3 py-1.5 text-sm rounded-lg transition-colors ${
                !selectedCategory
                  ? "bg-green-50 text-green-700 font-medium"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
              onClick={() => onFilterChange({ category: "" })}
            >
              All Categories
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                className={`block w-full text-left px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  selectedCategory === cat.slug
                    ? "bg-green-50 text-green-700 font-medium"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
                onClick={() => onFilterChange({ category: cat.slug })}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Price range */}
      <div>
        <h4 className="text-sm font-medium text-gray-900 mb-2">
          Price Range (NLe)
        </h4>
        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder="Min"
            value={localMinPrice}
            onChange={(e) => setLocalMinPrice(e.target.value)}
            className="w-full px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
          />
          <span className="text-gray-400">-</span>
          <input
            type="number"
            placeholder="Max"
            value={localMaxPrice}
            onChange={(e) => setLocalMaxPrice(e.target.value)}
            className="w-full px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
          />
        </div>
        <button
          onClick={applyPriceFilter}
          className="mt-2 w-full py-1.5 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100"
        >
          Apply
        </button>
      </div>
    </div>
  );
}
