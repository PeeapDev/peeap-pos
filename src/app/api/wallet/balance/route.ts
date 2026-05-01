import { NextRequest, NextResponse } from "next/server";
import { getWalletBalance } from "@/lib/api-client";
import { authenticateRequest, authenticateServiceCall } from "@/lib/auth";
import { corsHeaders, handleCORS } from "@/lib/cors";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: NextRequest) {
  return handleCORS(request) || NextResponse.json({});
}

/**
 * GET /api/wallet/balance?user_id=xxx
 * Fetches wallet balance from api.peeap.com for the AUTHENTICATED user.
 *
 * Auth: requires either a valid session token (the user_id query MUST
 * match the authenticated subject) OR an internal X-Service-Secret call.
 * The previous version had no auth and would return any user's balance.
 */
export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);

  const userId = request.nextUrl.searchParams.get("user_id");
  if (!userId) {
    return NextResponse.json({ error: "user_id required" }, { status: 400, headers });
  }

  const isService = authenticateServiceCall(request);
  if (!isService) {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
    }
    if (auth.sub !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403, headers });
    }
  }

  const result = await getWalletBalance(userId);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 502, headers });
  }

  return NextResponse.json({ balance: result.data?.balance ?? 0 }, { headers });
}
