import { NextRequest, NextResponse } from "next/server";
import { getWalletBalance } from "@/lib/api-client";

export const dynamic = "force-dynamic";

/**
 * GET /api/wallet/balance?user_id=xxx
 * Fetches wallet balance from api.peeap.com for the logged-in user.
 */
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("user_id");

  if (!userId) {
    return NextResponse.json({ error: "user_id required" }, { status: 400 });
  }

  const result = await getWalletBalance(userId);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({ balance: result.data?.balance ?? 0 });
}
