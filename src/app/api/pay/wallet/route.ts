import { NextRequest, NextResponse } from "next/server";
import { corsHeaders, handleCORS } from "@/lib/cors";
import { supabase } from "@/lib/supabase";

const API_BASE_URL = process.env.API_BASE_URL || "https://api.peeap.com";
const SERVICE_SECRET = process.env.SERVICE_SECRET || "";

export async function OPTIONS(request: NextRequest) {
  return handleCORS(request) || NextResponse.json({});
}

/**
 * POST /api/pay/wallet
 * Pay for an order using Peeap wallet (calls scan-pay API).
 * Body: { orderId, userId, walletId, pin }
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);

  try {
    const { orderId, userId, walletId, pin, userName } = await request.json();

    if (!orderId || !userId || !walletId || !pin) {
      return NextResponse.json(
        { error: "orderId, userId, walletId, and pin are required" },
        { status: 400, headers }
      );
    }

    // Get order and its payment reference (checkout session ID)
    const { data: order } = await supabase
      .from("store_orders")
      .select("id, payment_reference, status, total_amount, order_number")
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

    // Call Peeap API scan-pay endpoint
    const res = await fetch(`${API_BASE_URL}/api/checkout/sessions/${sessionId}/scan-pay`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Service-Secret": SERVICE_SECRET,
      },
      body: JSON.stringify({
        payerUserId: userId,
        payerWalletId: walletId,
        payerName: userName || "Peeap User",
        pin,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: data.error || "Payment failed" },
        { status: res.status, headers }
      );
    }

    // Update order status to paid
    await supabase
      .from("store_orders")
      .update({ status: "paid", updated_at: new Date().toISOString() })
      .eq("id", orderId);

    return NextResponse.json(
      { success: true, message: "Payment successful" },
      { headers }
    );
  } catch (err) {
    console.error("Wallet payment error:", err);
    return NextResponse.json(
      { error: "Payment processing failed" },
      { status: 500, headers }
    );
  }
}
