"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, ShieldCheck, X } from "lucide-react";
import { resumePeeapSession, useAuth } from "@/hooks/useAuth";

type Mode = "login" | "register";

/** The same login sheet is available from product, cart and checkout pages. */
export default function StoreAuthModal() {
  const { setSession } = useAuth();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("login");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const waiting = useRef<Array<(ok: boolean) => void>>([]);

  function close(ok: boolean) {
    setOpen(false);
    setError("");
    setPassword("");
    setConfirmPassword("");
    setMfaCode("");
    setMfaRequired(false);
    waiting.current.splice(0).forEach((resolve) => resolve(ok));
  }

  useEffect(() => {
    const onOpen = (event: Event) => {
      const resolve = (event as CustomEvent<{ resolve: (ok: boolean) => void }>).detail?.resolve;
      if (resolve) waiting.current.push(resolve);
      setMode("login");
      setError("");
      setOpen(true);
      setChecking(true);
      resumePeeapSession()
        .then((session) => {
          if (session) {
            setSession(session.token, session.user);
            close(true);
          }
        })
        .catch(() => {})
        .finally(() => setChecking(false));
    };
    window.addEventListener("store-auth-open", onOpen);
    return () => {
      window.removeEventListener("store-auth-open", onOpen);
      waiting.current.splice(0).forEach((resolve) => resolve(false));
    };
  }, [setSession]);

  async function signIn(emailOrPhone: string, pass: string, code?: string) {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: emailOrPhone, password: pass, mfaCode: code }),
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    if (data.mfaRequired) { setMfaRequired(true); return; }
    if (!response.ok || !data.token || !data.user?.id) {
      throw new Error(data.error || data.message || "Sign in failed");
    }
    const u = data.user;
    sessionStorage.removeItem("store_signed_out");
    setSession(data.token, {
      id: u.id,
      email: u.email,
      phone: u.phone,
      first_name: u.first_name || u.firstName,
      last_name: u.last_name || u.lastName,
      name: [u.first_name || u.firstName, u.last_name || u.lastName].filter(Boolean).join(" ") || u.name || u.email,
      roles: u.roles,
    });
    close(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (mode === "register") {
        if (password !== confirmPassword) throw new Error("Passwords do not match");
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: identifier, password, firstName, lastName }),
          cache: "no-store",
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Registration failed");
      }
      await signIn(identifier, password, mfaCode || undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign in");
    } finally {
      setBusy(false);
    }
  }

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/65 px-4 py-6" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) close(false); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="store-auth-title" className="w-full max-w-md rounded-2xl bg-white shadow-2xl max-h-[calc(100dvh-3rem)] overflow-y-auto">
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
          <div>
            <h2 id="store-auth-title" className="text-xl font-bold text-gray-900">{mode === "login" ? "Sign in to Peeap" : "Create your Peeap account"}</h2>
            <p className="mt-1 text-sm text-gray-500">Stay here and continue shopping after sign-in.</p>
          </div>
          <button type="button" onClick={() => close(false)} className="rounded-lg p-1 text-gray-500 hover:bg-gray-100" aria-label="Close sign in"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={submit} className="space-y-4 px-6 py-6">
          {checking && <p className="flex items-center gap-2 text-sm text-emerald-700"><Loader2 className="h-4 w-4 animate-spin" /> Checking your Peeap session…</p>}
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {mode === "register" && <div className="grid grid-cols-2 gap-3">
            <label className="text-sm font-medium text-gray-700">First name<input required autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 p-3 text-gray-900" /></label>
            <label className="text-sm font-medium text-gray-700">Last name<input required autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 p-3 text-gray-900" /></label>
          </div>}
          <label className="block text-sm font-medium text-gray-700">{mode === "login" ? "Email or phone" : "Email"}<input required type={mode === "register" ? "email" : "text"} autoComplete={mode === "login" ? "username" : "email"} value={identifier} onChange={(e) => setIdentifier(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 p-3 text-gray-900" /></label>
          <label className="block text-sm font-medium text-gray-700">Password<input required type="password" minLength={mode === "register" ? 8 : undefined} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 p-3 text-gray-900" /></label>
          {mode === "register" && <label className="block text-sm font-medium text-gray-700">Confirm password<input required type="password" minLength={8} autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 p-3 text-gray-900" /></label>}
          {mfaRequired && <label className="block text-sm font-medium text-gray-700">Authenticator code<input required inputMode="numeric" autoComplete="one-time-code" value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 p-3 text-gray-900" /></label>}
          <button type="submit" disabled={busy || checking} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{mode === "login" ? "Sign in" : "Create account"}</button>
          <button type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); setMfaRequired(false); }} className="block w-full text-center text-sm font-medium text-emerald-700 hover:underline">{mode === "login" ? "New to Peeap? Create an account" : "Already have an account? Sign in"}</button>
          <p className="flex items-center justify-center gap-1 text-xs text-gray-500"><ShieldCheck className="h-3.5 w-3.5" /> Protected by Peeap Pay</p>
        </form>
      </div>
    </div>, document.body
  );
}
