import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const API_URL = process.env.PEEAP_API_URL || "https://api.peeap.com";

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  const email = String(body.email || "").trim();
  const password = String(body.password || "");
  const firstName = String(body.firstName || "").trim();
  const lastName = String(body.lastName || "").trim();
  if (!email || !email.includes("@") || !password || password.length < 8 || !firstName || !lastName ||
      email.length > 255 || password.length > 1024 || firstName.length > 100 || lastName.length > 100) {
    return NextResponse.json({ error: "Enter your name, email and a password of at least 8 characters" }, { status: 400 });
  }
  try {
    const upstream = await fetch(`${API_URL}/mobile-auth`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": request.headers.get("x-forwarded-for") || "",
      },
      body: JSON.stringify({ action: "register", email, password, firstName, lastName }),
      cache: "no-store",
    });
    const result = await upstream.json().catch(() => ({}));
    // Registration's legacy JWT is not a POS session. The client signs in via
    // /api/auth/login after registration to obtain a real Peeap session.
    if (upstream.ok) return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ error: result.error || "Registration failed" }, { status: upstream.status, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Registration service unavailable" }, { status: 503 });
  }
}
