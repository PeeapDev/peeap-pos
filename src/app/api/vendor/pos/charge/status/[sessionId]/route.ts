/**
 * GET /api/vendor/pos/charge/status/:sessionId
 *
 * Polled by the cashier UI to detect when the customer has paid.
 * Reads checkout_sessions from Card via the MAIN_SUPABASE client.
 *
 * Returns { status, paid_at, paid_by_user_id?, scan_url, amount }.
 *
 * Auth: vendor session. Locked to sessions whose metadata.store_id
 * matches the caller's store so a vendor can't peek at another's
 * charge state.
 */
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { corsHeaders, handleCORS } from "@/lib/cors";
import { supabase } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";

const MAIN_SUPABASE_URL =
  process.env.MAIN_SUPABASE_URL ||
  process.env.PEEAP_SUPABASE_URL ||
  "https://akiecgwcxadcpqlvntmf.supabase.co";
const MAIN_SUPABASE_KEY =
  process.env.MAIN_SUPABASE_SERVICE_KEY ||
  process.env.PEEAP_SUPABASE_SERVICE_KEY ||
  "";

let _cardDb: ReturnType<typeof createClient> | null = null;
function getCardDb() {
  if (!_cardDb && MAIN_SUPABASE_KEY) {
    _cardDb = createClient(MAIN_SUPABASE_URL, MAIN_SUPABASE_KEY, { auth: { persistSession: false } });
  }
  return _cardDb;
}

export async function OPTIONS(request: NextRequest) {
  return handleCORS(request) || NextResponse.json({});
}

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);
  const auth = await authenticateRequest(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });

  const card = getCardDb();
  if (!card) {
    return NextResponse.json({ error: "auth_db_unavailable" }, { status: 503, headers });
  }

  const { data: session } = await card
    .from("checkout_sessions" as any)
    .select("id, status, amount, currency, paid_at, paid_by_user_id, metadata, expires_at, created_at")
    .eq("id", params.sessionId)
    .maybeSingle() as {
    data: {
      id: string;
      status: string;
      amount: number;
      currency: string;
      paid_at: string | null;
      paid_by_user_id: string | null;
      metadata: any;
      expires_at: string;
      created_at: string;
    } | null;
  };

  if (!session) {
    return NextResponse.json({ error: "session_not_found" }, { status: 404, headers });
  }

  // Lock to the caller's store. Either the caller is store owner, or
  // they're approved staff of the store this session belongs to.
  const sessionStoreId = session.metadata?.store_id;
  if (!sessionStoreId) {
    return NextResponse.json({ error: "session_not_pos_plugin" }, { status: 403, headers });
  }

  const { data: ownerStore } = await supabase
    .from("stores")
    .select("id")
    .eq("merchant_id", auth.sub)
    .eq("id", sessionStoreId)
    .maybeSingle();

  if (!ownerStore) {
    const { data: staff } = await supabase
      .from("store_staff")
      .select("id")
      .eq("store_id", sessionStoreId)
      .eq("user_id", auth.sub)
      .eq("status", "approved")
      .is("removed_at", null)
      .maybeSingle();
    if (!staff) {
      return NextResponse.json({ error: "not_your_session" }, { status: 403, headers });
    }
  }

  return NextResponse.json(
    {
      session_id: session.id,
      status: session.status,
      amount: session.amount,
      currency: session.currency,
      paid_at: session.paid_at,
      paid_by_user_id: session.paid_by_user_id,
      expires_at: session.expires_at,
      created_at: session.created_at,
    },
    { headers }
  );
}
