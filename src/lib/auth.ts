import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ============================================================
// Auth — Internal SSO via main Supabase sso_tokens table.
//
// The previous implementation validated JWTs against a JWKS endpoint at
// auth.peeap.com — but that auth service was scoped and never built, so
// every authenticated POS dashboard request had been returning 401 in
// production. JWT signing currently lives inside api.peeap.com; user
// session tokens live in the main Supabase `sso_tokens` table (minted by
// my.peeap.com on login and exchanged via /api/auth/sso here).
// ============================================================

const MAIN_SUPABASE_URL =
  process.env.MAIN_SUPABASE_URL ||
  process.env.PEEAP_SUPABASE_URL ||
  "https://akiecgwcxadcpqlvntmf.supabase.co";
const MAIN_SUPABASE_KEY =
  process.env.MAIN_SUPABASE_SERVICE_KEY ||
  process.env.PEEAP_SUPABASE_SERVICE_KEY ||
  "";

let _mainDb: ReturnType<typeof createClient> | null = null;
function getMainDb() {
  if (!_mainDb && MAIN_SUPABASE_KEY) {
    _mainDb = createClient(MAIN_SUPABASE_URL, MAIN_SUPABASE_KEY, {
      auth: { persistSession: false },
    });
  }
  return _mainDb;
}

export interface AuthPayload {
  sub: string;
  email?: string;
  phone?: string;
  roles: string[];
  client?: string;
}

/**
 * Validate a session token against the main platform's sso_tokens table.
 * Tokens are minted by my.peeap.com on login and by /api/auth/sso when
 * exchanging an SSO handoff for a persistent dashboard session.
 */
async function validateSessionToken(token: string): Promise<AuthPayload | null> {
  const mainDb = getMainDb();
  if (!mainDb) return null;

  try {
    const { data: session } = await mainDb
      .from("sso_tokens" as any)
      .select("user_id, expires_at")
      .eq("token", token)
      .maybeSingle() as {
      data: { user_id: string; expires_at: string } | null;
    };
    if (!session) return null;
    if (new Date(session.expires_at) < new Date()) return null;

    const { data: user } = await mainDb
      .from("users" as any)
      .select("id, email, phone, roles")
      .eq("id", session.user_id)
      .single() as {
      data: { id: string; email: string; phone: string; roles: any } | null;
    };
    if (!user) return null;

    let roles: string[] = [];
    if (Array.isArray(user.roles)) {
      roles = user.roles;
    } else if (typeof user.roles === "string") {
      const raw = (user.roles as string).replace(/[{}[\]"]/g, "").trim();
      roles = raw ? raw.split(",").map((r) => r.trim()) : [];
    }

    return {
      sub: user.id,
      email: user.email || undefined,
      phone: user.phone || undefined,
      roles,
    };
  } catch {
    return null;
  }
}

/**
 * Authenticate a request using session token (web) or legacy mobile base64
 * payload. SERVICE_SECRET is handled separately by `authenticateServiceCall`.
 */
export async function authenticateRequest(
  request: NextRequest
): Promise<AuthPayload | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;

  const token = authHeader.replace(/^(Bearer|Session)\s+/i, "").trim();
  if (!token) return null;

  // 1. Session token (web: my.peeap.com SSO, dashboard persistent token)
  const sessionPayload = await validateSessionToken(token);
  if (sessionPayload) return sessionPayload;

  // 2. Legacy base64 payload (older mobile clients)
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const parsed = JSON.parse(decoded);
    if (parsed.userId && parsed.exp && parsed.exp > Date.now()) {
      const mainDb = getMainDb();
      if (!mainDb) return null;
      const { data: user } = await mainDb
        .from("users" as any)
        .select("id, email, phone, roles")
        .eq("id", parsed.userId)
        .single() as {
        data: { id: string; email: string; phone: string; roles: any } | null;
      };
      if (!user) return null;

      let roles: string[] = [];
      if (Array.isArray(user.roles)) {
        roles = user.roles;
      } else if (typeof user.roles === "string") {
        const raw = (user.roles as string).replace(/[{}[\]"]/g, "").trim();
        roles = raw ? raw.split(",").map((r) => r.trim()) : [];
      }

      return {
        sub: user.id,
        email: user.email || undefined,
        phone: user.phone || undefined,
        roles,
      };
    }
  } catch {
    // Not a base64 payload — fall through
  }

  return null;
}

/**
 * Kept for callsites that import the old name. Prefer `authenticateRequest`.
 * @deprecated Use authenticateRequest instead.
 */
export const validateToken = validateSessionToken;

export function authenticateServiceCall(request: NextRequest): boolean {
  const secret = request.headers.get("x-service-secret");
  return !!secret && secret === process.env.SERVICE_SECRET;
}
