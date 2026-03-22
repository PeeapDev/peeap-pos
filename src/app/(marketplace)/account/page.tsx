"use client";

import Link from "next/link";
import {
  ShoppingBag,
  Heart,
  User,
  LogIn,
} from "lucide-react";

export default function AccountPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Account</h1>

      <div className="space-y-3">
        <Link
          href="/account/orders"
          className="flex items-center gap-4 p-4 bg-white border rounded-xl hover:shadow-sm transition-shadow"
        >
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <ShoppingBag className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="font-medium text-gray-900">My Orders</p>
            <p className="text-sm text-gray-500">Track and manage your orders</p>
          </div>
        </Link>

        <Link
          href="/account/wishlist"
          className="flex items-center gap-4 p-4 bg-white border rounded-xl hover:shadow-sm transition-shadow"
        >
          <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
            <Heart className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <p className="font-medium text-gray-900">Wishlist</p>
            <p className="text-sm text-gray-500">Products you saved for later</p>
          </div>
        </Link>

        <div className="pt-4 border-t mt-6">
          <p className="text-sm text-gray-500 mb-3">
            Sign in with your Peeap account to access your orders and wishlist.
          </p>
          <a
            href="https://auth.peeap.com/login?redirect=https://store.peeap.com/account"
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
          >
            <LogIn className="w-4 h-4" />
            Sign In with Peeap
          </a>
        </div>
      </div>
    </div>
  );
}
