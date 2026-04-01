import { NextRequest, NextResponse } from "next/server";
import { corsHeaders, handleCORS } from "@/lib/cors";
import { supabase } from "@/lib/supabase";

const API_BASE_URL = process.env.API_BASE_URL || "https://api.peeap.com";
const SERVICE_SECRET = process.env.SERVICE_SECRET || "";

export async function OPTIONS(request: NextRequest) {
  return handleCORS(request) || NextResponse.json({});
}

/**
 * POST /api/pay/mobile-money
 * Initiate mobile money payment for an order.
 * Body: { orderId, userId, userEmail }
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);

  try {
    const { orderId, userId, userEmail } = await request.json();

    if (!orderId) {
      return NextResponse.json(
        { error: "orderId is required" },
        { status: 400, headers }
      );
    }

    // Get order's checkout session
    const { data: order } = await supabase
      .from("store_orders")
      .select("id, payment_reference, status")
      .eq("id", orderId)
      .single();

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404, headers });
    }

    if (order.status !== "pending") {
      return NextResponse.json(
        { error: "Order is already " + order.status },
        { status: 400, headers }
      );
    }

    const sessionId = order.payment_reference;
    if (!sessionId) {
      return NextResponse.json(
        { error: "No checkout session for this order" },
        { status: 400, headers }
      );
    }

    // Call Peeap API mobile-pay endpoint
    const res = await fetch(`${API_BASE_URL}/api/checkout/sessions/${sessionId}/mobile-pay`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Service-Secret": SERVICE_SECRET,
      },
      body: JSON.stringify({
        userId: userId || undefined,
        userEmail: userEmail || undefined,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: data.error || "Mobile money initiation failed" },
        { status: res.status, headers }
      );
    }

    return NextResponse.json(
      {
        success: true,
        paymentUrl: data.paymentUrl || data.checkout_url,
        paymentCode: data.paymentCode,
        reference: data.reference,
      },
      { headers }
    );
  } catch (err) {
    console.error("Mobile money error:", err);
    return NextResponse.json(
      { error: "Failed to initiate mobile money payment" },
      { status: 500, headers }
    );
  }
}
