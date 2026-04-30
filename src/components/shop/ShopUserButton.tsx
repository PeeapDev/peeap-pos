"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { LogIn, LogOut, ShoppingCart, ChevronDown } from "lucide-react";
import Link from "next/link";

interface ShopUserButtonProps {
  merchantSlug: string;
}

const STORE_URL = process.env.NEXT_PUBLIC_STORE_URL || "https://store.peeap.com";

export default function ShopUserButton({ merchantSlug }: ShopUserButtonProps) {
  const { user, loading, loginPopup, logout } = useAuth();
  const [loggingIn, setLoggingIn] = useState(false);
  const [open, setOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Track cart count
  useEffect(() => {
    const update = () => {
      try {
        const raw = localStorage.getItem(`cart_${merchantSlug}`);
        const items = raw ? JSON.parse(raw) : [];
        setCartCount(items.reduce((sum: number, i: { quantity: number }) => sum + i.quantity, 0));
      } catch { setCartCount(0); }
    };
    update();
    const onCart = () => update();
    window.addEventListener("cart-updated", onCart);
    window.addEventListener("storage", onCart);
    return () => {
      window.removeEventListener("cart-updated", onCart);
      window.removeEventListener("storage", onCart);
    };
  }, [merchantSlug]);

  if (loading) return null;

  if (user) {
    const initial = (user.name || user.email || "U").charAt(0).toUpperCase();
    return (
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl hover:bg-white/80 transition-colors"
        >
          <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center text-white text-sm font-semibold relative">
            {initial}
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {cartCount > 9 ? "9+" : cartCount}
              </span>
            )}
          </div>
          <span className="text-sm font-medium text-gray-700 hidden sm:inline truncate max-w-[100px]">
            {user.name || user.email || user.phone}
          </span>
          <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="px-4 py-2.5 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-900 truncate">{user.name || user.email}</p>
              {user.phone && <p className="text-xs text-gray-500">{user.phone}</p>}
            </div>

            <Link
              href={`/shop/${merchantSlug}/cart`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <ShoppingCart className="w-4 h-4 text-gray-500" />
              My Cart
              {cartCount > 0 && (
                <span className="ml-auto text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  {cartCount}
                </span>
              )}
            </Link>

            <a
              href="https://my.peeap.com/orders"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
              My Orders
            </a>

            <button
              onClick={() => {
                logout();
                setOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={async () => { setLoggingIn(true); await loginPopup(); setLoggingIn(false); }}
      disabled={loggingIn}
      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-60"
    >
      <LogIn className="w-4 h-4" />
      <span>{loggingIn ? 'Signing in...' : 'Login'}</span>
    </button>
  );
}
