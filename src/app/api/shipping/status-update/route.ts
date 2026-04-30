import { NextRequest, NextResponse } from "next/server";
import { authenticateServiceCall } from "@/lib/auth";
import { corsHeaders, handleCORS } from "@/lib/cors";
import { supabase } from "@/lib/supabase";

export async function OPTIONS(request: NextRequest) {
  return handleCORS(request) || NextResponse.json({});
}

/**
 * POST /api/shipping/status-update
 * Webhook called by shipping.peeap.com when a delivery status changes.
 * Updates the store_orders table to keep merchant dashboard in sync.
 *
 * Body: { job_number, store_order_id?, new_status, pickup_verified?, delivery_verified? }
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);

  if (!authenticateServiceCall(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  }

  try {
    const { job_number, store_order_id, new_status, pickup_verified, delivery_verified } = await request.json();

    if (!job_number || !new_status) {
      return NextResponse.json({ error: "job_number and new_status required" }, { status: 400, headers });
    }

    // Map shipping status → store order status
    const statusMap: Record<string, string> = {
      assigned: "processing",
      picked_up: "shipped",
      in_transit: "shipped",
      delivered: "delivered",
      completed: "delivered",
      cancelled: "cancelled",
      failed: "cancelled",
      returning: "shipped",
      returned: "cancelled",
    };

    const orderStatus = statusMap[new_status];
    if (!orderStatus) {
      return NextResponse.json({ message: "Status not mapped, skipped" }, { headers });
    }

    // Find the store order by store_order_id or by shipping job number in metadata
    let orderId = store_order_id;

    if (!orderId) {
      // Search by shipping job number in metadata
      const { data: orders } = await supabase
        .from("store_orders")
        .select("id, status")
        .contains("metadata", { shipping_job_number: job_number })
        .limit(1);

      if (orders && orders.length > 0) {
        orderId = orders[0].id;
      }
    }

    if (!orderId) {
      return NextResponse.json({ message: "Store order not found for this job" }, { headers });
    }

    // Update the store order status + shipping metadata
    const updateData: Record<string, unknown> = {
      status: orderStatus,
      updated_at: new Date().toISOString(),
    };

    // Merge shipping info into metadata
    const { data: existing } = await supabase
      .from("store_orders")
      .select("metadata")
      .eq("id", orderId)
      .single();

    const existingMeta = (existing?.metadata as Record<string, unknown>) || {};
    updateData.metadata = {
      ...existingMeta,
      shipping_job_number: job_number,
      shipping_status: new_status,
      ...(pickup_verified && { pickup_verified_at: new Date().toISOString() }),
      ...(delivery_verified && { delivery_verified_at: new Date().toISOString() }),
    };

    const { error: updateError } = await supabase
      .from("store_orders")
      .update(updateData)
      .eq("id", orderId);

    if (updateError) {
      console.error("[ShippingWebhook] Failed to update store order:", updateError);
      return NextResponse.json({ error: "Failed to update order" }, { status: 500, headers });
    }

    console.log(`[ShippingWebhook] Order ${orderId} updated to ${orderStatus} (shipping: ${new_status})`);

    return NextResponse.json({
      message: "Store order updated",
      order_id: orderId,
      new_status: orderStatus,
    }, { headers });
  } catch (err) {
    console.error("[ShippingWebhook] Error:", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500, headers });
  }
}
