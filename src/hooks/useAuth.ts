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

const PEEAP_URL = process.env.NEXT_PUBLIC_PEEAP_URL || "https://my.peeap.com";
const STORE_URL = process.env.NEXT_PUBLIC_STORE_URL || "https://store.peeap.com";

type StoreSession = { token: string; user: User };
let bootstrapPromise: Promise<StoreSession | null> | null = null;
let lastFocusCheckAt = 0;

async function exchangeSsoToken(ssoToken: string): Promise<StoreSession | null> {
  const res = await fetch("/api/auth/sso", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: ssoToken }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.user && data?.token
    ? { token: data.token, user: buildUserFromData(data.user) }
    : null;
}

async function bootstrapSession(): Promise<StoreSession | null> {
  const savedToken = localStorage.getItem("pos_token");
  const savedUser = localStorage.getItem("pos_user");
  if (savedToken && savedUser) {
    try {
      const check = await fetch("/api/auth/check", {
        headers: { Authorization: `Session ${savedToken}` }, cache: "no-store",
      });
      const result = check.ok ? await check.json() : null;
      const profile = JSON.parse(savedUser) as User;
      if (result?.user?.id === profile.id) return { token: savedToken, user: profile };
    } catch { /* Invalid stored session: try the main Peeap session below. */ }
    localStorage.removeItem("pos_token");
    localStorage.removeItem("pos_user");
  }

  // Same-site credentials are sent only to my.peeap.com; the store receives a
  // one-minute, one-use handoff, never the main Peeap session cookie.
  if (sessionStorage.getItem("store_signed_out")) return null;
  try {
    const bridge = await fetch(`${PEEAP_URL}/store-session`, {
      method: "POST", credentials: "include", cache: "no-store",
    });
    if (!bridge.ok) return null;
    const data = await bridge.json();
    if (typeof data.token !== "string") return null;
    return await exchangeSsoToken(data.token);
  } catch { return null; }
}

function sharedBootstrap(): Promise<StoreSession | null> {
  if (!bootstrapPromise) {
    bootstrapPromise = bootstrapSession().finally(() => { bootstrapPromise = null; });
  }
  return bootstrapPromise;
}

export async function resumePeeapSession(): Promise<StoreSession | null> {
  sessionStorage.removeItem("store_signed_out");
  return sharedBootstrap();
}

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
    // Listen for auth changes from other useAuth instances
    const onAuthChanged = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setToken(detail?.token || null);
      setUser(detail?.user || null);
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

    // A customer may sign in on my.peeap.com after opening the store. When
    // this tab regains focus, quietly retry the same-site handoff; never
    // override an explicit store logout or an established store account.
    const onFocus = () => {
      if (sessionStorage.getItem("store_signed_out") || localStorage.getItem("pos_token")) return;
      if (Date.now() - lastFocusCheckAt < 2_000) return;
      lastFocusCheckAt = Date.now();
      sharedBootstrap().then((session) => {
        if (!cancelled && session) persistSession(session.token, session.user);
      }).catch(() => {});
    };
    const onVisibility = () => { if (document.visibilityState === "visible") onFocus(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    // Legacy redirect callbacks are supported, but new handoffs use POST and
    // never put tokens in the browser URL.
    const params = new URLSearchParams(window.location.search);
    const ssoToken = params.get("token");
    let cancelled = false;
    if (ssoToken) {
      const url = new URL(window.location.href);
      url.searchParams.delete("token");
      window.history.replaceState({}, "", url.toString());

      exchangeSsoToken(ssoToken)
        .then((session) => { if (!cancelled && session) persistSession(session.token, session.user); })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoading(false); });
    } else {
      sharedBootstrap()
        .then((session) => { if (!cancelled && session) persistSession(session.token, session.user); })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoading(false); });
    }

    return () => {
      cancelled = true;
      window.removeEventListener("auth-changed", onAuthChanged);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [persistSession]);

  /**
   * Redirect to my.peeap.com/login for SSO authentication (full-page redirect).
   */
  const login = useCallback((redirectBack?: string) => {
    const storeRedirect = redirectBack || `${STORE_URL}/shop`;
    window.location.href = `${PEEAP_URL}/login?redirect=${encodeURIComponent(storeRedirect)}`;
  }, []);

  /** Opens the store's in-page login/register sheet without navigation. */
  const loginPopup = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      window.dispatchEvent(new CustomEvent("store-auth-open", { detail: { resolve } }));
    });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("pos_token");
    localStorage.removeItem("pos_user");
    sessionStorage.setItem("store_signed_out", "1");
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
        const session = await exchangeSsoToken(code);
        if (!session) return false;
        persistSession(session.token, session.user);
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
