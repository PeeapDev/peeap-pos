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

    // Update order status to paid. Previously this UPDATE was unchecked —
    // if Supabase failed, the customer was already charged via scan-pay
    // but the order stayed pending and we returned success: true. The
    // merchant then saw the order as unpaid even though the money moved.
    // Now: log + flag the order for reconciliation if the update fails,
    // and return success with a warning so the client can show "payment
    // received, syncing".
    const paymentReference = data?.transaction_id || data?.transactionId;
    const { error: updateErr } = await supabase
      .from("store_orders")
      .update({
        status: "paid",
        payment_reference: paymentReference || sessionId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (updateErr) {
      console.error(`[pay/wallet] Order status update failed after successful payment for order ${orderId}:`, updateErr);
      // Flag for manual reconciliation. We do NOT roll back the payment —
      // the customer's wallet was already debited and the merchant
      // already credited via api.peeap.com scan-pay. Reverting now would
      // require a second API round-trip that itself could fail.
      try {
        const existing = await supabase
          .from("store_orders")
          .select("metadata")
          .eq("id", orderId)
          .single();
        await supabase
          .from("store_orders")
          .update({
            metadata: {
              ...((existing.data?.metadata as Record<string, unknown>) || {}),
              reconciliation_needed: true,
              reconciliation_reason: "payment_succeeded_status_update_failed",
              payment_reference: paymentReference || sessionId,
              failed_at: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", orderId);
      } catch {
        // Even the metadata write failed. Log + Slack via the api.peeap.com
        // alert webhook is the next layer of defence; for now ensure the
        // server log is loud enough to find later.
        console.error(`[pay/wallet] CRITICAL: order ${orderId} paid via ${paymentReference} but DB inaccessible — manual reconciliation required`);
      }

      return NextResponse.json(
        {
          success: true,
          message: "Payment successful, order syncing",
          reconciliation_pending: true,
        },
        { headers }
      );
    }

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
