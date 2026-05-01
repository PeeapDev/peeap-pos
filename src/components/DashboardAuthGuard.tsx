"use client";

import { useEffect, useState } from "react";

const PEEAP_URL = process.env.NEXT_PUBLIC_PEEAP_URL || "https://my.peeap.com";

/**
 * Client-side auth gate for /dashboard/*.
 *
 * Previously the dashboard pages just rendered empty state when the token
 * was missing or expired — looked like the merchant had no products,
 * orders, etc. Now we redirect to my.peeap.com/login so the merchant
 * actually gets prompted to re-authenticate.
 *
 * This is intentionally minimal: a real session validation needs a
 * server round-trip (the token might exist locally but already be
 * revoked on the main API). The /api/auth/check endpoint handles that
 * verification and clears stale tokens.
 */
export function DashboardAuthGuard({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<"checking" | "ok" | "redirecting">("checking");

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const token = typeof window !== "undefined" ? localStorage.getItem("pos_token") : null;

      if (!token) {
        const next = encodeURIComponent(window.location.href);
        if (!cancelled) {
          setAuthState("redirecting");
          window.location.href = `${PEEAP_URL}/login?next=${next}`;
        }
        return;
      }

      // Validate against the server. If the token has been revoked or the
      // sso_tokens row expired, clear local state and redirect.
      try {
        const res = await fetch("/api/auth/check", {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(8000),
        });

        if (res.status === 401 || res.status === 403) {
          if (cancelled) return;
          localStorage.removeItem("pos_token");
          localStorage.removeItem("pos_user");
          const next = encodeURIComponent(window.location.href);
          setAuthState("redirecting");
          window.location.href = `${PEEAP_URL}/login?next=${next}`;
          return;
        }

        // Treat any non-401/403 (including network errors caught below) as
        // "good enough" — we'd rather risk showing the dashboard than
        // bouncing the merchant on a transient network blip.
        if (!cancelled) setAuthState("ok");
      } catch {
        // Network error — let the merchant in. Individual page fetches
        // that hit 401 will still trigger redirects via window listeners.
        if (!cancelled) setAuthState("ok");
      }
    }

    check();

    // Listen for explicit auth failures from page-level fetches.
    function onAuthFailed() {
      localStorage.removeItem("pos_token");
      localStorage.removeItem("pos_user");
      const next = encodeURIComponent(window.location.href);
      setAuthState("redirecting");
      window.location.href = `${PEEAP_URL}/login?next=${next}`;
    }
    window.addEventListener("pos:auth-failed", onAuthFailed);

    return () => {
      cancelled = true;
      window.removeEventListener("pos:auth-failed", onAuthFailed);
    };
  }, []);

  if (authState === "checking" || authState === "redirecting") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 mx-auto mb-3 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-600">
            {authState === "redirecting" ? "Redirecting to sign in…" : "Checking your session…"}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
