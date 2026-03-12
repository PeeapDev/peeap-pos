"use client";

import { useState, useEffect, useCallback } from "react";

interface User {
  id: string;
  email?: string;
  name?: string;
  role?: string;
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

  const login = useCallback(() => {
    window.location.href = `${AUTH_URL}/login?redirect=${encodeURIComponent(STORE_URL + "/dashboard")}`;
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

  return { user, token, loading, login, logout, setSession };
}
