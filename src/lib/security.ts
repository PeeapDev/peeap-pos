/**
 * Cross-service auth helpers.
 *
 * Two layers, both used by the webhook + any future service-to-service
 * endpoints:
 *
 *  1. timingSafeEqual — constant-time comparison of the shared
 *     SERVICE_SECRET, so an attacker can't recover it byte-by-byte from
 *     response-time differences.
 *  2. verifyHmac — optional HMAC-SHA256 over the raw request body, keyed
 *     by SERVICE_SECRET. The caller (api.peeap.com / Terminal) sends the
 *     hex digest in `x-signature`. This is verified ONLY when present, so
 *     it can be rolled out caller-side without a flag-day; once the caller
 *     always signs, flip REQUIRE_WEBHOOK_SIGNATURE to make it mandatory.
 *
 * Uses Web Crypto (crypto.subtle) so it runs on the same runtime as the
 * rest of the app — no node:crypto import needed.
 */

/** Constant-time string compare. Returns false on any length mismatch. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  // Length is not secret here (both are fixed-format secrets), but we still
  // avoid an early return that leaks the matching-prefix length.
  const len = Math.max(a.length, b.length);
  let mismatch = a.length === b.length ? 0 : 1;
  for (let i = 0; i < len; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** HMAC-SHA256(rawBody) keyed by `secret`, hex-encoded. */
export async function hmacSha256Hex(rawBody: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
  return toHex(sig);
}

/**
 * Verify a webhook HMAC signature. Accepts a bare hex digest or a
 * `sha256=<hex>` prefixed form. Constant-time comparison.
 */
export async function verifyHmac(
  rawBody: string,
  signatureHeader: string,
  secret: string
): Promise<boolean> {
  if (!signatureHeader || !secret) return false;
  const provided = signatureHeader.replace(/^sha256=/i, "").trim().toLowerCase();
  const expected = await hmacSha256Hex(rawBody, secret);
  return timingSafeEqual(provided, expected);
}
