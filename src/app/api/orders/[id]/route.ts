import { NextRequest, NextResponse } from "next/server";
import { corsHeaders, handleCORS } from "@/lib/cors";
import { supabase } from "@/lib/supabase";
import { creditWallet } from "@/lib/api-client";
import { commitStock } from "@/lib/stock";

const API_BASE_URL =
  process.env.API_BASE_URL || "https://api.peeap.com";
const SERVICE_SECRET = process.env.SERVICE_SECRET || "";

export async function OPTIONS(request: NextRequest) {
  return handleCORS(request) || NextResponse.json({});
}

/**
 * Check Peeap checkout session status and settle order if payment is complete.
 * Handles both peeap_checkout (cs_ prefix) and mobile_money payment refs.
 * Settlement = update status + credit merchant + commit stock.
 */
async function syncCheckoutStatus(order: Record<string, unknown>) {
  const paymentRef = order.payment_reference as string | undefined;
  if (!paymentRef) return null;

  try {
    // Try checkout session lookup (cs_ prefix) or payment code lookup
    let sessionStatus: string | null = null;

    if (paymentRef.startsWith("cs_")) {
      const res = await fetch(`${API_BASE_URL}/api/checkout/sessions/${paymentRef}`, {
        headers: { "X-Service-Secret": SERVICE_SECRET },
      });
      if (!res.ok) return null;
      const data = await res.json();
      sessionStatus = data.session?.status || data.status;
    } else {
      // Try payment code / generic payment status lookup
      const res = await fetch(`${API_BASE_URL}/api/payments/${paymentRef}/status`, {
        headers: { "X-Service-Secret": SERVICE_SECRET },
      });
      if (res.ok) {
        const data = await res.json();
        sessionStatus = data.status;
      }
    }

    if (!sessionStatus) return null;

    const isComplete = ["COMPLETE", "completed", "PAID", "paid", "succeeded"].includes(sessionStatus);
    const isCancelled = ["CANCELLED", "EXPIRED", "cancelled", "expired", "failed"].includes(sessionStatus);

    if (isComplete) {
      // Settle: update status + credit merchant + commit stock
      const { error: updateErr } = await supabase
        .from("store_orders")
        .update({
          status: "paid",
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id)
        .eq("status", "pending"); // Only update if still pending (idempotent)

      if (updateErr) return null; // Another process may have settled it

      // Credit merchant wallet
      const merchantId = order.merchant_id as string;
      const totalAmount = order.total_amount as number;
      const orderNumber = order.order_number as string;
      if (merchantId && totalAmount > 0) {
        const creditResult = await creditWallet(
          merchantId,
          totalAmount,
          `Sale: Order ${orderNumber}`,
          order.id as string
        );
        if (creditResult.error) {
          console.error(`[Settlement] Merchant credit failed for ${orderNumber}:`, creditResult.error);
          // Flag for reconciliation but don't roll back — payment is confirmed
          await supabase.from("store_orders").update({
            metadata: {
              ...(order.metadata as Record<string, unknown> || {}),
              reconciliation_needed: true,
              reconciliation_reason: "settlement_merchant_credit_failed",
            },
          }).eq("id", order.id);
        }
      }

      // Commit stock reservation
      const { data: orderItems } = await supabase
        .from("store_order_items")
        .select("product_id, quantity")
        .eq("order_id", order.id);

      if (orderItems && orderItems.length > 0) {
        await commitStock(orderItems.map((i) => ({
          product_id: i.product_id,
          quantity: i.quantity,
        }))).catch((err: unknown) =>
          console.error(`[Settlement] Stock commit failed for ${orderNumber}:`, err)
        );
      }

      return "paid";
    }

    if (isCancelled) {
      await supabase
        .from("store_orders")
        .update({
          status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id)
        .eq("status", "pending");

      return "cancelled";
    }
  } catch (err) {
    console.error("Failed to check checkout session:", err);
  }
  return null;
}

// GET /api/orders/[id] — Public order status check (no auth required)
// Used by order confirmation page to poll status
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);

  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: "Order ID is required" },
        { status: 400, headers }
      );
    }

    const { data: order, error } = await supabase
      .from("store_orders")
      .select("*, items:store_order_items(*)")
      .eq("id", id)
      .single();

    if (error || !order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404, headers }
      );
    }

    // If order is pending and has a checkout session, check if payment completed
    let effectiveStatus = order.status;
    if (order.status === "pending" && order.payment_reference) {
      const newStatus = await syncCheckoutStatus(order);
      if (newStatus) effectiveStatus = newStatus;
    }

    // Return a safe subset (no merchant-private fields)
    return NextResponse.json(
      {
        order: {
          id: order.id,
          order_number: order.order_number,
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
          customer_email: order.customer_email,
          subtotal: order.subtotal,
          tax_amount: order.tax_amount,
          discount_amount: order.discount_amount,
          delivery_fee: order.delivery_fee,
          total_amount: order.total_amount,
          payment_method: order.payment_method,
          status: effectiveStatus,
          notes: order.notes,
          items: order.items,
          created_at: order.created_at,
          updated_at: order.updated_at,
        },
      },
      { headers }
    );
  } catch (err) {
    console.error("Error fetching order:", err);
    return NextResponse.json(
      { error: "Failed to fetch order" },
      { status: 500, headers }
    );
  }
}
