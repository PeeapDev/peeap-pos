/**
 * POST /api/webhooks/checkout-paid
 *
 * Called by Card (api.peeap.com) when a checkout session for a POS
 * plugin charge flips to paid. We use this for two things:
 *
 *  1. Durably mark the local order as paid so the cashier UI doesn't
 *     have to be open for the receipt to land.
 *  2. Decrement inventory based on the line items captured at charge
 *     time.
 *
 * Auth: shared SERVICE_SECRET in `x-service-secret`. Same secret used
 * for marketplace ↔ Terminal cross-service calls.
 *
 * Idempotency: Card may retry on transient failures, so we look up by
 * session_id and skip if we've already recorded it. The orders.paid_at
 * column is the marker.
 */
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const provided = request.headers.get("x-service-secret") || "";
  const expected = process.env.SERVICE_SECRET || "";
  if (!expected || provided !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const sessionId = String((body as any).session_id || "").trim();
  const orderId = String((body as any).order_id || "").trim();
  const amount = Number((body as any).amount || 0);
  const storeId = String((body as any).store_id || "").trim();
  const paidByUserId = (body as any).paid_by_user_id || null;
  const paidAt = (body as any).paid_at || new Date().toISOString();
  const lineItems: Array<{ product_id?: string; qty?: number }> = Array.isArray(
    (body as any).line_items
  )
    ? (body as any).line_items
    : [];

  if (!sessionId || !storeId) {
    return NextResponse.json(
      { error: "session_id_and_store_id_required" },
      { status: 400 }
    );
  }

  // Idempotency: have we already processed this session?
  const { data: existing } = await supabase
    .from("orders")
    .select("id, paid_at")
    .eq("checkout_session_id", sessionId)
    .maybeSingle();

  if (existing?.paid_at) {
    return NextResponse.json({ ok: true, deduped: true, order_id: existing.id });
  }

  // If an order row already exists (created at charge time), update it.
  // Otherwise, create a minimal "paid receipt" row so the merchant has a
  // record. The cashier UI also writes to /api/sales for richer local
  // bookkeeping; this row is the durable cross-device fallback.
  let finalOrderId: string | null = null;
  if (existing) {
    const { error } = await supabase
      .from("orders")
      .update({
        paid_at: paidAt,
        paid_by_user_id: paidByUserId,
        status: "paid",
        payment_method: "peeap_wallet",
      })
      .eq("id", existing.id);
    if (!error) finalOrderId = existing.id;
  } else {
    const { data: created } = await supabase
      .from("orders")
      .insert({
        store_id: storeId,
        checkout_session_id: sessionId,
        external_order_id: orderId || null,
        total_amount: amount,
        status: "paid",
        paid_at: paidAt,
        paid_by_user_id: paidByUserId,
        payment_method: "peeap_wallet",
      })
      .select("id")
      .single();
    finalOrderId = (created as any)?.id || null;
  }

  // Decrement inventory for each line item that names a real product.
  // Skipped quietly for line items without a product_id — those are
  // ad-hoc keypad amounts, not catalog items.
  for (const item of lineItems) {
    if (!item.product_id || !item.qty || item.qty <= 0) continue;
    try {
      // Best-effort: read current stock then write the delta. A tiny
      // race window if a manual stock adjust runs at the same instant,
      // acceptable since payment volume is far higher than manual edits.
      const { data: prod } = await supabase
        .from("products")
        .select("stock_quantity, track_inventory")
        .eq("id", item.product_id)
        .eq("store_id", storeId)
        .maybeSingle();
      if (prod && (prod as any).track_inventory) {
        const newStock = Math.max(
          0,
          ((prod as any).stock_quantity || 0) - item.qty
        );
        await supabase
          .from("products")
          .update({ stock_quantity: newStock })
          .eq("id", item.product_id);
      }
    } catch {
      // swallow — inventory is best-effort; payment success isn't blocked
    }
  }

  return NextResponse.json({ ok: true, order_id: finalOrderId, deduped: false });
}
