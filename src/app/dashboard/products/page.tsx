"use client";

import { useEffect } from "react";
import { Package, ExternalLink } from "lucide-react";

/**
 * Product management has moved.
 *
 * Products are now managed in ONE place — my.peeap.com (the merchant app) —
 * which writes to this same store database via the /api/products endpoints.
 * This page used to be a duplicate editor; it now just points there.
 */
const TARGET = "https://my.peeap.com/merchant/pos/products";

export default function ProductsMovedPage() {
  useEffect(() => {
    const t = setTimeout(() => {
      window.location.href = TARGET;
    }, 1500);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
      <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mb-4">
        <Package className="w-7 h-7 text-green-600" />
      </div>
      <h1 className="text-xl font-bold text-gray-900">Manage products in the Peeap app</h1>
      <p className="text-sm text-gray-500 mt-2 max-w-sm">
        Product management has moved to your Peeap merchant dashboard. Taking you
        there now…
      </p>
      <a
        href={TARGET}
        className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
      >
        Open product manager <ExternalLink className="w-4 h-4" />
      </a>
    </div>
  );
}
