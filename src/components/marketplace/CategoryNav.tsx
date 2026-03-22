"use client";

import Link from "next/link";

interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  color?: string;
  product_count?: number;
}

export default function CategoryNav({
  categories,
}: {
  categories: Category[];
}) {
  if (categories.length === 0) return null;

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {categories.map((cat) => (
        <Link
          key={cat.id}
          href={`/category/${cat.slug}`}
          className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border text-sm font-medium text-gray-700 hover:border-green-500 hover:text-green-600 transition-colors whitespace-nowrap shrink-0"
        >
          {cat.icon && <span>{cat.icon}</span>}
          {cat.name}
          {(cat.product_count ?? 0) > 0 && (
            <span className="text-xs text-gray-400">
              {cat.product_count}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}
