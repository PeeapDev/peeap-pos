import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { corsHeaders, handleCORS } from "@/lib/cors";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: NextRequest) {
  return handleCORS(request) || NextResponse.json({});
}

// GET /api/auth/check
// Lightweight session validation used by the dashboard auth guard.
// Returns 200 with the auth payload if the token is valid, 401 otherwise.
export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);

  const auth = await authenticateRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  }
  return NextResponse.json(
    { ok: true, user: { id: auth.sub, email: auth.email, phone: auth.phone, roles: auth.roles } },
    { headers }
  );
}
