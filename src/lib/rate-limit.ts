/**
 * DB-backed fixed-window rate limiter.
 *
 * Serverless functions don't share memory between instances, so an
 * in-process counter only sees a fraction of the traffic. This uses the
 * `rate_limit_hit` Postgres RPC (migration 009) as the shared counter:
 * one atomic INSERT ... ON CONFLICT DO UPDATE per request, returning the
 * running count for the current window.
 *
 * Fail-OPEN: if the DB call errors we allow the request rather than take
 * down checkout because the limiter is unavailable. The limiter is a
 * defence-in-depth control, not the primary auth.
 */
import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

export interface RateLimitResult {
  allowed: boolean;
  count: number;
}

/** Best-effort client IP from the usual proxy headers. */
export function clientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Record a hit and report whether it's within the limit.
 *
 * @param key     logical bucket, e.g. `checkout:<ip>` or `pay:<ip>`
 * @param max     max requests allowed per window
 * @param windowSeconds  window length in seconds
 */
export async function rateLimit(
  key: string,
  max: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  try {
    const { data, error } = await supabase.rpc("rate_limit_hit", {
      p_bucket: key,
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.error("[rateLimit] RPC error (failing open):", error.message);
      return { allowed: true, count: 0 };
    }
    const row = Array.isArray(data) ? data[0] : data;
    return {
      allowed: row?.allowed !== false,
      count: row?.current_count ?? 0,
    };
  } catch (err) {
    console.error("[rateLimit] exception (failing open):", err);
    return { allowed: true, count: 0 };
  }
}

/**
 * Convenience wrapper that keys by client IP and a route name.
 * Returns null when allowed, or a RateLimitResult when blocked so the
 * caller can return 429.
 */
export async function enforceIpRateLimit(
  request: NextRequest,
  route: string,
  max: number,
  windowSeconds: number
): Promise<RateLimitResult | null> {
  const result = await rateLimit(`${route}:${clientIp(request)}`, max, windowSeconds);
  return result.allowed ? null : result;
}
