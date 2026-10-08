"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, ShieldCheck, X } from "lucide-react";
import { resumePeeapSession, useAuth } from "@/hooks/useAuth";

const PEEAP_ORIGIN = "https://my.peeap.com";

/** Keep the customer on the store page while Peeap owns all credentials and registration. */
export default function StoreAuthModal() {
  const { setSession, exchangeToken } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const popupRef = useRef<Window | null>(null);
  const waiting = useRef<Array<(ok: boolean) => void>>([]);

  function close(ok: boolean) {
    setOpen(false);
    setBusy(false);
    setError("");
    if (!ok) popupRef.current?.close();
    popupRef.current = null;
    waiting.current.splice(0).forEach((resolve) => resolve(ok));
  }

  useEffect(() => {
    const onOpen = (event: Event) => {
      const resolve = (event as CustomEvent<{ resolve: (ok: boolean) => void }>).detail?.resolve;
      if (resolve) waiting.current.push(resolve);
      setError("");
      setOpen(true);
      setBusy(true);
      // This event is dispatched directly from the customer's click, so open
      // the central sign-in window while browser popup permission is active.
      openPeeapSignIn();
      resumePeeapSession()
        .then((session) => {
          if (session) {
            setSession(session.token, session.user);
            close(true);
          }
        })
        .catch(() => {})
        .finally(() => setBusy(false));
    };
    window.addEventListener("store-auth-open", onOpen);
    return () => {
      window.removeEventListener("store-auth-open", onOpen);
      waiting.current.splice(0).forEach((resolve) => resolve(false));
    };
  }, [setSession]);

  useEffect(() => {
    const onMessage = async (event: MessageEvent) => {
      if (event.origin !== PEEAP_ORIGIN || event.source !== popupRef.current) return;
      if (event.data?.type !== "PEEAP_AUTH_SUCCESS" || typeof event.data.ssoToken !== "string") return;
      setBusy(true);
      try {
        if (!await exchangeToken(event.data.ssoToken)) throw new Error("Peeap sign-in could not be completed. Please try again.");
        popupRef.current?.close();
        close(true);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Sign-in failed");
        setBusy(false);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [exchangeToken]);

  function openPeeapSignIn() {
    setError("");
    const url = new URL("/auth/signin", PEEAP_ORIGIN);
    url.searchParams.set("mode", "popup");
    url.searchParams.set("origin", window.location.origin);
    const popup = window.open(url.toString(), "peeap-store-signin", "popup,width=480,height=700");
    if (!popup) {
      setError("Allow the Peeap sign-in popup, then try again.");
      return;
    }
    popupRef.current = popup;
    setBusy(true);
    popup.focus();
  }

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/65 px-4 py-6" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) close(false); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="store-auth-title" className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
          <div>
            <h2 id="store-auth-title" className="text-xl font-bold text-gray-900">Continue with Peeap</h2>
            <p className="mt-1 text-sm text-gray-500">Sign in or register with Peeap, then continue shopping here.</p>
          </div>
          <button type="button" onClick={() => close(false)} className="rounded-lg p-1 text-gray-500 hover:bg-gray-100" aria-label="Close sign in"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4 px-6 py-6">
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button type="button" onClick={openPeeapSignIn} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Sign in or create a Peeap account
          </button>
          <p className="flex items-center justify-center gap-1 text-xs text-gray-500"><ShieldCheck className="h-3.5 w-3.5" /> Your password stays on my.peeap.com</p>
        </div>
      </div>
    </div>, document.body
  );
}
