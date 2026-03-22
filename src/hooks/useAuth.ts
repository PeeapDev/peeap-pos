"use client";

import { useState, useEffect, useCallback } from "react";

interface User {
  id: string;
  email?: string;
  phone?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  roles?: string[];
  merchant_id?: string;
}

const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_URL || "https://auth.peeap.com";
const STORE_URL = process.env.NEXT_PUBLIC_STORE_URL || "https://store.peeap.com";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("pos_token");
    const storedUser = localStorage.getItem("pos_user");
    if (stored && storedUser) {
      setToken(stored);
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem("pos_user");
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback((redirectBack?: string) => {
    const redirect = redirectBack || `${STORE_URL}/dashboard`;
    window.location.href = `${AUTH_URL}/login?client=store&redirect=${encodeURIComponent(redirect)}`;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("pos_token");
    localStorage.removeItem("pos_user");
    setUser(null);
    setToken(null);
  }, []);

  const setSession = useCallback((t: string, u: User) => {
    localStorage.setItem("pos_token", t);
    localStorage.setItem("pos_user", JSON.stringify(u));
    setToken(t);
    setUser(u);
  }, []);

  const exchangeToken = useCallback(async (code: string): Promise<boolean> => {
    try {
      const res = await fetch(`${AUTH_URL}/api/auth/exchange`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, client: "store" }),
      });
      if (!res.ok) return false;

      const data = await res.json();
      const u: User = {
        id: data.user.id,
        email: data.user.email,
        phone: data.user.phone,
        first_name: data.user.first_name,
        last_name: data.user.last_name,
        name: [data.user.first_name, data.user.last_name].filter(Boolean).join(" ") || data.user.email || data.user.phone,
        roles: data.user.roles,
      };

      const accessToken = data.access_token || data.session_token;
      localStorage.setItem("pos_token", accessToken);
      localStorage.setItem("pos_user", JSON.stringify(u));
      setToken(accessToken);
      setUser(u);
      return true;
    } catch {
      return false;
    }
  }, []);

  return { user, token, loading, login, logout, setSession, exchangeToken };
}
