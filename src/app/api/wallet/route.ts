import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Query main Peeap Supabase directly for wallet data
const MAIN_SUPABASE_URL = process.env.MAIN_SUPABASE_URL || "https://akiecgwcxadcpqlvntmf.supabase.co";
const MAIN_SUPABASE_KEY = process.env.MAIN_SUPABASE_SERVICE_KEY || "";

function getMainDb() {
  return createClient(MAIN_SUPABASE_URL, MAIN_SUPABASE_KEY, {
    auth: { persistSession: false },
  });
}

/**
 * GET /api/wallet?user_id=xxx
 * Returns user's wallets from main Peeap Supabase.
 * Spending wallet shown first.
 */
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("user_id");
  if (!userId) {
    return NextResponse.json({ error: "user_id required" }, { status: 400 });
  }

  if (!MAIN_SUPABASE_KEY) {
    return NextResponse.json({ wallets: [], error: "Not configured" });
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
      return NextResponse.json({ wallets: [] });
    }

    return NextResponse.json({
      wallets: (wallets || []).map((w) => ({
        id: w.id,
        balance: Number(w.balance),
        currency_code: w.currency || "SLE",
        wallet_type: w.wallet_type || "primary",
        spending_enabled: w.spending_enabled,
        name: w.name,
      })),
    });
  } catch (err) {
    console.error("[Wallet] Exception:", err);
    return NextResponse.json({ wallets: [] });
  }
}
