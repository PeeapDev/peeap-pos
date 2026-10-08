import { NextRequest, NextResponse } from "next/server";
import { corsHeaders, handleCORS } from "@/lib/cors";

export async function OPTIONS(request: NextRequest) {
  return handleCORS(request) || NextResponse.json({});
}

// Retired: this public route accepted caller-supplied userId and walletId,
// then forwarded them with a service credential to the payment API. Wallet
// purchases now run only through Peeap's authenticated /api/store/purchase.
export async function POST(request: NextRequest) {
  return NextResponse.json(
    { error: "Wallet payment is available through Peeap checkout only" },
    { status: 410, headers: corsHeaders(request.headers.get("origin")) }
  );
}
