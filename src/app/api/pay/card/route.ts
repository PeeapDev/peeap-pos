import { NextRequest, NextResponse } from "next/server";
import { corsHeaders, handleCORS } from "@/lib/cors";
import { supabase } from "@/lib/supabase";
import { authorizeCardPayment, DECLINE_CODE_MESSAGES } from "@/lib/cards-client";
import { commitStock } from "@/lib/stock";

export async function OPTIONS(request: NextRequest) {
  return handleCORS(request) || NextResponse.json({});
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);

  try {
    const body = await request.json();
    const { orderId, cardToken, pin } = body;

    if (!orderId || !cardToken) {
      return NextResponse.json(
        { error: "orderId and cardToken are required" },
        { status: 400, headers }
      );
    }

    // Fetch order
    const { data: order, error: orderError } = await supabase
      .from("store_orders")
      .select("id, status, total_amount, merchant_id, order_number")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404, headers }
      );
    }

    if (order.status !== "pending") {
      return NextResponse.json(
        { error: "Order is not pending payment" },
        { status: 400, headers }
      );
    }

    // Authorize card payment
    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    const result = await authorizeCardPayment(
      {
        card_token: cardToken,
        amount: Math.round(order.total_amount * 100), // Convert to cents
        currency: "SLE",
        merchant_id: order.merchant_id,
        entry_mode: "ONLINE",
        pin: pin || undefined,
        // Deterministic idempotency key — was previously `ord-${orderId}-${Date.now()}`
        // which gave a different key on every retry, defeating the purpose
        // of idempotency entirely (network retries would double-charge).
        // Keying on orderId alone makes a retry of the same order safe;
        // legitimate retries get the cached authorization decision.
        idempotency_key: `ord-${orderId}`,
        description: `Order ${order.order_number}`,
      },
      clientIp
    );

    if (!result.authorized) {
      return NextResponse.json(
        {
          error: result.decline_reason || "Card payment declined",
          decline_code: result.decline_code,
          decline_reason: result.decline_reason,
        },
        { status: 402, headers }
      );
    }

    // Payment authorized — update order. Previously this UPDATE was unchecked,
    // so a Supabase failure after a successful card auth would leave the
    // customer charged but the order pending forever. Flag for reconciliation
    // on failure rather than silently lying to the client.
    const { error: updateErr } = await supabase
      .from("store_orders")
      .update({
        status: "paid",
        payment_reference: result.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (updateErr) {
      console.error(`[pay/card] Order status update failed after successful card auth ${result.id} for order ${orderId}:`, updateErr);
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
              reconciliation_reason: "card_auth_succeeded_status_update_failed",
              authorization_id: result.id,
              auth_code: result.auth_code,
              failed_at: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", orderId);
      } catch {
        console.error(`[pay/card] CRITICAL: order ${orderId} authorized via ${result.id} but DB inaccessible — manual reconciliation required`);
      }
      return NextResponse.json(
        {
          success: true,
          authorization_id: result.id,
          auth_code: result.auth_code,
          reconciliation_pending: true,
        },
        { headers }
      );
    }

    // Commit reserved stock
    const { data: items } = await supabase
      .from("store_order_items")
      .select("product_id, quantity")
      .eq("order_id", orderId);

    if (items?.length) {
      await commitStock(
        items.map((i) => ({ product_id: i.product_id, quantity: i.quantity }))
      );
    }

    return NextResponse.json(
      {
        success: true,
        authorization_id: result.id,
        auth_code: result.auth_code,
      },
      { headers }
    );
  } catch (err) {
    console.error("[PayCard] Error:", err);
    return NextResponse.json(
      { error: "Card payment processing failed" },
      { status: 500, headers }
    );
  }
}
