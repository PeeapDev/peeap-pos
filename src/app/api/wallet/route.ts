import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = process.env.API_BASE_URL || "https://api.peeap.com";
const SERVICE_SECRET = process.env.SERVICE_SECRET || "";

export const dynamic = "force-dynamic";

/**
 * GET /api/wallet?user_id=xxx
 * Returns user's wallets (id, balance, type) from the Peeap API.
 */
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("user_id");
  if (!userId) {
    return NextResponse.json({ error: "user_id required" }, { status: 400 });
  }

  try {
    // Use the mobile API to get wallets
    const res = await fetch(`${API_BASE_URL}/api/mobile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Service-Secret": SERVICE_SECRET,
      },
      body: JSON.stringify({ action: "wallets", userId }),
    });

    if (!res.ok) {
      // Fallback: try the service wallet balance endpoint
      const balRes = await fetch(`${API_BASE_URL}/api/wallets/${userId}/balance`, {
        headers: { "X-Service-Secret": SERVICE_SECRET },
      });
      if (balRes.ok) {
        const data = await balRes.json();
        return NextResponse.json({
          wallets: [{
            id: data.wallet_id || "primary",
            balance: data.balance || 0,
            currency_code: data.currency || "SLE",
            wallet_type: "primary",
          }],
        });
      }
      return NextResponse.json({ wallets: [] });
    }

    const data = await res.json();
    return NextResponse.json({ wallets: data.wallets || [] });
  } catch {
    return NextResponse.json({ wallets: [] });
  }
}
