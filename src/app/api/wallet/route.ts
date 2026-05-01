import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authenticateRequest, authenticateServiceCall } from "@/lib/auth";
import { corsHeaders, handleCORS } from "@/lib/cors";

export const dynamic = "force-dynamic";

// Query main Peeap Supabase directly for wallet data
const MAIN_SUPABASE_URL = process.env.MAIN_SUPABASE_URL || "https://akiecgwcxadcpqlvntmf.supabase.co";
const MAIN_SUPABASE_KEY = process.env.MAIN_SUPABASE_SERVICE_KEY || "";

function getMainDb() {
  return createClient(MAIN_SUPABASE_URL, MAIN_SUPABASE_KEY, {
    auth: { persistSession: false },
  });
}

export async function OPTIONS(request: NextRequest) {
  return handleCORS(request) || NextResponse.json({});
}

/**
 * GET /api/wallet?user_id=xxx
 * Returns the caller's own wallets from main Peeap Supabase.
 *
 * Auth: requires either a valid session token (the user_id query MUST
 * match the authenticated subject) OR an internal service call with
 * X-Service-Secret. The previous version had NO auth — anyone who knew
 * a user's UUID could read their balance.
 *
 * Spending wallet shown first.
 */
export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);

  const userId = request.nextUrl.searchParams.get("user_id");
  if (!userId) {
    return NextResponse.json({ error: "user_id required" }, { status: 400, headers });
  }

  // Allow internal service calls (e.g. POS server-side rendering or other
  // Peeap services) without a user session.
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

  if (!MAIN_SUPABASE_KEY) {
    return NextResponse.json({ wallets: [], error: "Not configured" }, { headers });
  }

  try {
    const db = getMainDb();
    const { data: wallets, error } = await db
      .from("wallets")
      .select("id, balance, currency, wallet_type, spending_enabled, status, name")
      .eq("user_id", userId)
      .eq("status", "ACTIVE")
      .neq("status", "CLOSED")
      .order("spending_enabled", { ascending: false })
      .order("balance", { ascending: false });

    if (error) {
      console.error("[Wallet] Error:", error.message);
      return NextResponse.json({ wallets: [] }, { headers });
    }

    return NextResponse.json(
      {
        wallets: (wallets || []).map((w) => ({
          id: w.id,
          balance: Number(w.balance),
          currency_code: w.currency || "SLE",
          wallet_type: w.wallet_type || "primary",
          spending_enabled: w.spending_enabled,
          name: w.name,
        })),
      },
      { headers }
    );
  } catch (err) {
    console.error("[Wallet] Exception:", err);
    return NextResponse.json({ wallets: [] }, { headers });
  }
}
