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

// Login happens on my.peeap.com — the main Peeap platform
const PEEAP_URL = process.env.NEXT_PUBLIC_PEEAP_URL || "https://my.peeap.com";
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

  /**
   * Redirect to my.peeap.com/login for SSO authentication.
   * After login, my.peeap.com will generate an SSO token and redirect back
   * to the store with ?token=xxx in the URL.
   */
  const login = useCallback((redirectBack?: string) => {
    const storeRedirect = redirectBack || `${STORE_URL}/shop`;
    // my.peeap.com login accepts a redirect param — after login it will
    // redirect back to our store URL with an SSO token appended
    window.location.href = `${PEEAP_URL}/login?redirect=${encodeURIComponent(storeRedirect)}`;
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

  /**
   * Exchange an SSO token (from ?token= URL param) for a user session.
   * The SSO token is validated against the sso_tokens table via the store API.
   */
  const exchangeToken = useCallback(async (code: string): Promise<boolean> => {
    try {
      // Call our own API to validate the SSO token and get user data
      const res = await fetch(`/api/auth/sso?token=${encodeURIComponent(code)}`);
      if (!res.ok) return false;

      const data = await res.json();
      if (!data.user) return false;

      const u: User = {
        id: data.user.id,
        email: data.user.email,
        phone: data.user.phone,
        first_name: data.user.first_name,
        last_name: data.user.last_name,
        name: [data.user.first_name, data.user.last_name].filter(Boolean).join(" ") || data.user.email || data.user.phone,
        roles: data.user.roles,
      };

      const accessToken = data.token || code;
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
