"use client";

import { useState, useEffect, useCallback, useRef } from "react";

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

function buildUserFromData(data: any): User {
  return {
    id: data.id,
    email: data.email,
    phone: data.phone,
    first_name: data.first_name || data.firstName,
    last_name: data.last_name || data.lastName,
    name:
      [data.first_name || data.firstName, data.last_name || data.lastName]
        .filter(Boolean)
        .join(" ") ||
      data.name ||
      data.email ||
      data.phone,
    roles: data.roles,
  };
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);

  // Helper: persist session and notify all components
  const persistSession = useCallback((accessToken: string, u: User) => {
    localStorage.setItem("pos_token", accessToken);
    localStorage.setItem("pos_user", JSON.stringify(u));
    setToken(accessToken);
    setUser(u);
    // Broadcast to all useAuth instances on this page
    window.dispatchEvent(new CustomEvent("auth-changed", { detail: { token: accessToken, user: u } }));
  }, []);

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

    // Listen for auth changes from other useAuth instances
    const onAuthChanged = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.token) setToken(detail.token);
      if (detail?.user) setUser(detail.user);
    };
    window.addEventListener("auth-changed", onAuthChanged);

    // Also listen for storage changes (cross-tab)
    const onStorage = (e: StorageEvent) => {
      if (e.key === "pos_token") setToken(e.newValue);
      if (e.key === "pos_user" && e.newValue) {
        try { setUser(JSON.parse(e.newValue)); } catch {}
      }
      if (e.key === "pos_user" && !e.newValue) setUser(null);
    };
    window.addEventListener("storage", onStorage);

    // Auto-exchange SSO token from URL ?token= param (after login redirect)
    const params = new URLSearchParams(window.location.search);
    const ssoToken = params.get("token");
    if (ssoToken) {
      const url = new URL(window.location.href);
      url.searchParams.delete("token");
      window.history.replaceState({}, "", url.toString());

      fetch(`/api/auth/sso?token=${encodeURIComponent(ssoToken)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.user) {
            persistSession(data.token || ssoToken, buildUserFromData(data.user));
          }
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else {
      setLoading(false);
    }

    return () => {
      window.removeEventListener("auth-changed", onAuthChanged);
      window.removeEventListener("storage", onStorage);
    };
  }, [persistSession]);

  /**
   * Redirect to my.peeap.com/login for SSO authentication (full-page redirect).
   */
  const login = useCallback((redirectBack?: string) => {
    const storeRedirect = redirectBack || `${STORE_URL}/shop`;
    window.location.href = `${PEEAP_URL}/login?redirect=${encodeURIComponent(storeRedirect)}`;
  }, []);

  /**
   * Open a popup window for login. User stays on the current page.
   * Returns a promise that resolves to true on success.
   */
  const loginPopup = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      // Size and center the popup
      const w = 440;
      const h = 560;
      const left = window.screenX + (window.outerWidth - w) / 2;
      const top = window.screenY + (window.outerHeight - h) / 2;

      const popupUrl = `${PEEAP_URL}/auth/signin?mode=popup&origin=${encodeURIComponent(STORE_URL)}`;
      const popup = window.open(
        popupUrl,
        "peeap_login",
        `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`
      );

      popupRef.current = popup;

      if (!popup) {
        // Popup blocked — fallback to redirect
        login();
        resolve(false);
        return;
      }

      // Listen for postMessage from the popup
      const handler = async (event: MessageEvent) => {
        // Validate origin
        const peeapOrigin = new URL(PEEAP_URL).origin;
        if (event.origin !== peeapOrigin) return;
        if (event.data?.type !== "PEEAP_AUTH_SUCCESS") return;

        window.removeEventListener("message", handler);
        clearInterval(pollClosed);

        const { user: popupUser, ssoToken } = event.data;

        if (ssoToken) {
          // Exchange SSO token for a validated session via our API
          try {
            const res = await fetch(
              `/api/auth/sso?token=${encodeURIComponent(ssoToken)}`
            );
            if (res.ok) {
              const data = await res.json();
              if (data?.user) {
                persistSession(
                  data.token || ssoToken,
                  buildUserFromData(data.user)
                );
                resolve(true);
                return;
              }
            }
          } catch {
            // Fall through to use popup user data directly
          }
        }

        // Fallback: use user data from popup + create a local session token
        if (popupUser) {
          const u = buildUserFromData(popupUser);
          // Generate a unique session token - NOT the user ID
          const fallbackToken = ssoToken || `store_${Date.now()}_${Math.random().toString(36).substring(2)}`;
          persistSession(fallbackToken, u);
          resolve(true);
        } else {
          resolve(false);
        }
      };

      window.addEventListener("message", handler);

      // Poll to detect if popup was closed without completing login
      const pollClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(pollClosed);
          window.removeEventListener("message", handler);
          popupRef.current = null;
          resolve(false);
        }
      }, 500);
    });
  }, [login, persistSession]);

  const logout = useCallback(() => {
    localStorage.removeItem("pos_token");
    localStorage.removeItem("pos_user");
    setUser(null);
    setToken(null);
    window.dispatchEvent(new CustomEvent("auth-changed", { detail: { token: null, user: null } }));
  }, []);

  const setSession = useCallback(
    (t: string, u: User) => {
      persistSession(t, u);
    },
    [persistSession]
  );

  const exchangeToken = useCallback(
    async (code: string): Promise<boolean> => {
      try {
        const res = await fetch(
          `/api/auth/sso?token=${encodeURIComponent(code)}`
        );
        if (!res.ok) return false;

        const data = await res.json();
        if (!data.user) return false;

        persistSession(data.token || code, buildUserFromData(data.user));
        return true;
      } catch {
        return false;
      }
    },
    [persistSession]
  );

  return {
    user,
    token,
    loading,
    login,
    loginPopup,
    logout,
    setSession,
    exchangeToken,
  };
}
