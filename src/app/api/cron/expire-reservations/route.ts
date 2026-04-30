import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { releaseStock } from "@/lib/stock";

const RESERVATION_TTL_MINUTES = 15;

/**
 * GET /api/cron/expire-reservations
 * Releases stock reservations for orders that have been pending for too long.
 * Should be called periodically (e.g. every 5 minutes via Vercel Cron or polling).
 *
 * Orders stuck in "pending" for >15 minutes without payment get cancelled
 * and their reserved stock is released.
 */
export async function GET(request: NextRequest) {
  try {
    const cutoff = new Date(Date.now() - RESERVATION_TTL_MINUTES * 60 * 1000).toISOString();

    // Find stale pending orders that have NO payment_reference (truly abandoned).
    // Orders with a payment_reference are waiting for external settlement
    // (mobile-money, Peeap checkout) and handled by /api/cron/settle-payments.
    const { data: staleOrders } = await supabase
      .from("store_orders")
      .select("id, order_number, items:store_order_items(product_id, quantity)")
      .eq("status", "pending")
      .is("payment_reference", null)
      .lt("created_at", cutoff)
      .limit(50);

    if (!staleOrders || staleOrders.length === 0) {
      return NextResponse.json({ expired: 0, message: "No stale reservations" });
    }

    let expired = 0;
    for (const order of staleOrders) {
      // Release stock for each item
      const items = (order.items || []).map((i: any) => ({
        product_id: i.product_id,
        quantity: i.quantity,
      }));

      if (items.length > 0) {
        await releaseStock(items);
      }

      // Cancel the order
      await supabase
        .from("store_orders")
        .update({
          status: "cancelled",
          notes: `Auto-cancelled: payment not received within ${RESERVATION_TTL_MINUTES} minutes`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id)
        .eq("status", "pending"); // Only if still pending

      expired++;
      console.log(`[ExpireReservations] Cancelled stale order ${order.order_number}`);
    }

    return NextResponse.json({
      expired,
      message: `Released ${expired} stale reservation(s)`,
    });
  } catch (err) {
    console.error("[ExpireReservations] Error:", err);
    return NextResponse.json({ error: "Failed to expire reservations" }, { status: 500 });
  }
}
