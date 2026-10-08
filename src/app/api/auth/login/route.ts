import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const API_URL = process.env.PEEAP_API_URL || "https://api.peeap.com";

/** Passwords are forwarded directly to Peeap's rate-limited auth API. */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  const identifier = String(body.identifier || "").trim();
  const password = String(body.password || "");
  const mfaCode = typeof body.mfaCode === "string" ? body.mfaCode.trim() : undefined;
  if (!identifier || !password || identifier.length > 255 || password.length > 1024) {
    return NextResponse.json({ error: "Email or phone and password are required" }, { status: 400 });
  }
  try {
    const upstream = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": request.headers.get("x-forwarded-for") || "",
      },
      body: JSON.stringify({ identifier, password, ...(mfaCode ? { mfaCode } : {}) }),
      cache: "no-store",
    });
    const result = await upstream.json().catch(() => ({}));
    const response = NextResponse.json(result, { status: upstream.status });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return NextResponse.json({ error: "Sign-in service unavailable" }, { status: 503 });
  }
}
