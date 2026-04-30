import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { creditWallet } from "@/lib/api-client";
import { commitStock } from "@/lib/stock";

const API_BASE_URL =
  process.env.API_BASE_URL || "https://api.peeap.com";
const SERVICE_SECRET = process.env.SERVICE_SECRET || "";

/**
 * GET /api/cron/settle-payments
 *
 * Sweeps pending orders that have a `payment_reference` (mobile-money,
 * peeap_checkout, etc.), checks the payment provider for completion, and
 * settles them: status → paid, merchant wallet credited, stock committed.
 *
 * Should be called every 2–5 minutes via Vercel Cron. Idempotent.
 *
 * Orders older than 2 hours with unresolved payments are auto-cancelled
 * (the payment provider has expired the session by then).
 */
const SETTLEMENT_TIMEOUT_HOURS = 2;

export async function GET() {
  try {
    // Pending orders WITH a payment_reference = waiting for external payment
    const { data: pendingOrders } = await supabase
      .from("store_orders")
      .select(
        "id, order_number, merchant_id, total_amount, payment_reference, payment_method, metadata, created_at, items:store_order_items(product_id, quantity)"
      )
      .eq("status", "pending")
      .not("payment_reference", "is", null)
      .order("created_at", { ascending: true })
      .limit(30);

    if (!pendingOrders || pendingOrders.length === 0) {
      return NextResponse.json({ settled: 0, cancelled: 0, message: "No pending payments" });
    }

    let settled = 0;
    let cancelled = 0;
    const timeoutCutoff = Date.now() - SETTLEMENT_TIMEOUT_HOURS * 60 * 60 * 1000;

    for (const order of pendingOrders) {
      const paymentRef = order.payment_reference as string;
      let sessionStatus: string | null = null;

      // Check payment status with main API
      try {
        if (paymentRef.startsWith("cs_")) {
          // Peeap checkout session
          const res = await fetch(
            `${API_BASE_URL}/api/checkout/sessions/${paymentRef}`,
            { headers: { "X-Service-Secret": SERVICE_SECRET } }
          );
          if (res.ok) {
            const data = await res.json();
            sessionStatus = data.session?.status || data.status;
          }
        } else {
          // Generic payment status lookup (mobile money, etc.)
          const res = await fetch(
            `${API_BASE_URL}/api/payments/${paymentRef}/status`,
            { headers: { "X-Service-Secret": SERVICE_SECRET } }
          );
          if (res.ok) {
            const data = await res.json();
            sessionStatus = data.status;
          }
        }
      } catch {
        // API unreachable — skip this order, retry next sweep
        continue;
      }

      const isComplete = sessionStatus &&
        ["COMPLETE", "completed", "PAID", "paid", "succeeded"].includes(sessionStatus);
      const isCancelled = sessionStatus &&
        ["CANCELLED", "EXPIRED", "cancelled", "expired", "failed"].includes(sessionStatus);

      if (isComplete) {
        // Settle: mark paid + credit merchant + commit stock
        const { error: updateErr } = await supabase
          .from("store_orders")
          .update({ status: "paid", updated_at: new Date().toISOString() })
          .eq("id", order.id)
          .eq("status", "pending");

        if (updateErr) continue; // Another process settled it

        // Credit merchant
        if (order.merchant_id && order.total_amount > 0) {
          const creditResult = await creditWallet(
            order.merchant_id,
            Number(order.total_amount),
            `Sale: Order ${order.order_number}`,
            order.id
          );
          if (creditResult.error) {
            console.error(`[SettlePayments] Merchant credit failed for ${order.order_number}:`, creditResult.error);
            await supabase.from("store_orders").update({
              metadata: {
                ...(order.metadata as Record<string, unknown> || {}),
                reconciliation_needed: true,
                reconciliation_reason: "cron_settlement_merchant_credit_failed",
              },
            }).eq("id", order.id);
          }
        }

        // Commit stock
        const items = ((order.items || []) as Array<{ product_id: string; quantity: number }>).map(
          (i) => ({ product_id: i.product_id, quantity: i.quantity })
        );
        if (items.length > 0) {
          await commitStock(items).catch((err: unknown) =>
            console.error(`[SettlePayments] Stock commit failed for ${order.order_number}:`, err)
          );
        }

        settled++;
        console.log(`[SettlePayments] Settled order ${order.order_number}`);
      } else if (isCancelled) {
        // Payment was cancelled/expired by provider — cancel the order
        await supabase
          .from("store_orders")
          .update({
            status: "cancelled",
            notes: "Payment cancelled or expired by provider",
            updated_at: new Date().toISOString(),
          })
          .eq("id", order.id)
          .eq("status", "pending");

        cancelled++;
        console.log(`[SettlePayments] Cancelled order ${order.order_number} (payment ${sessionStatus})`);
      } else if (new Date(order.created_at as string).getTime() < timeoutCutoff) {
        // Order is older than timeout and payment still unresolved — cancel
        await supabase
          .from("store_orders")
          .update({
            status: "cancelled",
            notes: `Auto-cancelled: payment unresolved after ${SETTLEMENT_TIMEOUT_HOURS} hours`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", order.id)
          .eq("status", "pending");

        cancelled++;
        console.log(`[SettlePayments] Timeout-cancelled order ${order.order_number}`);
      }
      // else: still pending, provider hasn't resolved yet — skip, retry next sweep
    }

    return NextResponse.json({
      settled,
      cancelled,
      message: `Settled ${settled}, cancelled ${cancelled} order(s)`,
    });
  } catch (err) {
    console.error("[SettlePayments] Error:", err);
    return NextResponse.json({ error: "Settlement sweep failed" }, { status: 500 });
  }
}
