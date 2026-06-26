/**
 * GET /api/vendor/pos/charge/qr/status/:sessionId
 *
 * Cashier polls this while the customer scans + pays. We proxy the canonical
 * session state from api.peeap.com (status flips to COMPLETE synchronously
 * inside scan-pay), keeping SERVICE_SECRET server-side. The durable local
 * order + receipt are written asynchronously by the checkout-paid webhook;
 * this poll is the instant signal for the cashier screen.
 */
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { corsHeaders, handleCORS } from "@/lib/cors";

const API_BASE_URL = process.env.API_BASE_URL || "https://api.peeap.com";

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
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  }

  const sessionId = String(params.sessionId || "").trim();
  if (!sessionId) {
    return NextResponse.json({ error: "session_id_required" }, { status: 400, headers });
  }

  try {
    const r = await fetch(
      `${API_BASE_URL}/api/checkout/sessions/${encodeURIComponent(sessionId)}`,
      { headers: { "X-Service-Secret": process.env.SERVICE_SECRET || "" } }
    );
    if (!r.ok) {
      return NextResponse.json(
        { error: "status_lookup_failed", status: "UNKNOWN", paid: false },
        { status: 200, headers }
      );
    }
    const data = await r.json();
    const status = String(data.status || "UNKNOWN");
    const paid = status === "COMPLETE";
    return NextResponse.json(
      {
        status,
        paid,
        amount: data.amount,
        currency: data.currency_code || "SLE",
        expired: status === "EXPIRED",
        cancelled: status === "CANCELLED",
      },
      { headers }
    );
  } catch (err: any) {
    // Network blip — tell the client to keep polling rather than erroring out.
    return NextResponse.json(
      { error: "api_unreachable", status: "UNKNOWN", paid: false, detail: err?.message },
      { status: 200, headers }
    );
  }
}
