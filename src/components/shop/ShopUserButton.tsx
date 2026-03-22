"use client";

import { useAuth } from "@/hooks/useAuth";
import { LogIn, User } from "lucide-react";

interface ShopUserButtonProps {
  merchantSlug: string;
}

const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_URL || "https://auth.peeap.com";
const STORE_URL = process.env.NEXT_PUBLIC_STORE_URL || "https://store.peeap.com";

export default function ShopUserButton({ merchantSlug }: ShopUserButtonProps) {
  const { user, loading, login } = useAuth();

  if (loading) return null;

  const handleLogin = () => {
    const redirect = `${STORE_URL}/shop/${merchantSlug}`;
    login(redirect);
  };

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
          {(user.name || user.email || "U").charAt(0).toUpperCase()}
        </div>
        <span className="text-sm font-medium text-gray-700 hidden sm:inline truncate max-w-[120px]">
          {user.name || user.email || user.phone}
        </span>
      </div>
    );
  }

  return (
    <button
      onClick={handleLogin}
      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
    >
      <LogIn className="w-4 h-4" />
      <span>Login</span>
    </button>
  );
}
