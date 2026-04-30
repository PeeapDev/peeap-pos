import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { corsHeaders, handleCORS } from "@/lib/cors";
import { supabase } from "@/lib/supabase";
import { updateOrderStatusSchema } from "@/lib/validation";
import { notifyOrderStatusChanged } from "@/lib/notification-client";
import { sendOrderStatusUpdateToChat } from "@/lib/chat-client";
import { commitStock } from "@/lib/stock";

export async function OPTIONS(request: NextRequest) {
  return handleCORS(request) || NextResponse.json({});
}

// GET /api/orders — List orders for authenticated merchant
export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);

  const auth = await authenticateRequest(request);
  if (!auth) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
    const offset = parseInt(searchParams.get("offset") || "0");
    const status = searchParams.get("status");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const customerId = searchParams.get("customer_id");
    const orderType = searchParams.get("order_type");

    let query = supabase
      .from("store_orders")
      .select("*, items:store_order_items(*)", { count: "exact" })
      .eq("merchant_id", auth.sub)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && status !== "all") {
      query = query.eq("status", status);
    }
    if (customerId) {
      query = query.eq("customer_id", customerId);
    }
    if (orderType) {
      query = query.eq("order_type", orderType);
    }
    if (from) {
      query = query.gte("created_at", from);
    }
    if (to) {
      // Add end-of-day time to include the full "to" day
      query = query.lte("created_at", `${to}T23:59:59.999Z`);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    return NextResponse.json(
      { orders: data || [], total: count || 0 },
      { headers }
    );
  } catch (err) {
    console.error("Error fetching orders:", err);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500, headers }
    );
  }
}

// PUT /api/orders — Update order status
export async function PUT(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);

  const auth = await authenticateRequest(request);
  if (!auth) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers }
    );
  }

  try {
    const body = await request.json();
    const parsed = updateOrderStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400, headers }
      );
    }

    const { id, status, notes } = parsed.data;

    // Verify the order belongs to this merchant
    const { data: existing, error: fetchError } = await supabase
      .from("store_orders")
      .select("id, merchant_id, status, store_id, order_number, customer_id, customer_name, total_amount")
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404, headers }
      );
    }

    if (existing.merchant_id !== auth.sub) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403, headers }
      );
    }

    // Validate status transition
    const validTransitions: Record<string, string[]> = {
      pending: ["paid", "cancelled"],
      paid: ["processing", "cancelled"],
      processing: ["shipped", "delivered", "cancelled"],
      shipped: ["delivered", "cancelled"],
      delivered: [],
      cancelled: [],
    };

    const allowed = validTransitions[existing.status] || [];
    if (!allowed.includes(status)) {
      return NextResponse.json(
        {
          error: `Cannot transition from "${existing.status}" to "${status}"`,
        },
        { status: 400, headers }
      );
    }

    const updateData: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (notes !== undefined) {
      updateData.notes = notes;
    }

    const { data: updated, error: updateError } = await supabase
      .from("store_orders")
      .update(updateData)
      .eq("id", id)
      .select("*, items:store_order_items(*)")
      .single();

    if (updateError) throw updateError;

    // Commit stock when order moves to paid/confirmed (for non-wallet payments)
    if ((status === "paid" || status === "processing") && existing.status === "pending") {
      try {
        const { data: items } = await supabase
          .from("store_order_items")
          .select("product_id, quantity")
          .eq("order_id", id);
        if (items?.length) {
          await commitStock(items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })));
        }
      } catch (err) {
        console.error("[Orders] Stock commit failed (non-blocking):", err);
      }
    }

    // Send notification to customer on status change (non-blocking)
    if (updated.customer_id && ["shipped", "delivered", "cancelled"].includes(status)) {
      notifyOrderStatusChanged(
        updated.customer_id,
        updated.order_number,
        status,
        updated.store_name
      ).catch(() => {});
    }

    // Send chat message to buyer on status change (non-blocking)
    if (existing.customer_id && ["paid", "processing", "shipped", "delivered", "cancelled"].includes(status)) {
      // Look up store name for the chat message
      const { data: store } = await supabase
        .from("stores")
        .select("name")
        .eq("id", existing.store_id)
        .single();

      sendOrderStatusUpdateToChat({
        order_id: existing.id,
        order_number: existing.order_number,
        store_id: existing.store_id,
        store_name: store?.name || "Store",
        buyer_user_id: existing.customer_id,
        seller_user_id: existing.merchant_id,
        customer_name: existing.customer_name || "there",
        new_status: status,
        total_amount: existing.total_amount,
      }).catch(() => {});
    }

    // Cancel linked shipping job if order is cancelled
    if (status === "cancelled") {
      try {
        // Release stock
        const { data: orderItems } = await supabase
          .from("store_order_items")
          .select("product_id, quantity")
          .eq("order_id", id);
        if (orderItems?.length) {
          const { releaseStock: releaseStockFn } = await import("@/lib/stock");
          await releaseStockFn(orderItems.map((i) => ({ product_id: i.product_id, quantity: i.quantity })));
        }

        // Cancel shipping job via shipping API
        const orderMeta = (updated.metadata || {}) as Record<string, any>;
        const shippingJobNumber = orderMeta.shipping_job_number;
        if (shippingJobNumber) {
          const SHIPPING_API = process.env.SHIPPING_API_URL || "https://shipping.peeap.com";
          const SVC_SECRET = process.env.SERVICE_SECRET || "";
          // Look up the job ID by job number, then cancel it
          const lookupRes = await fetch(`${SHIPPING_API}/api/deliveries?job_number=${shippingJobNumber}`, {
            headers: { "X-Service-Secret": SVC_SECRET },
          });
          if (lookupRes.ok) {
            const lookupData = await lookupRes.json();
            const job = lookupData.deliveries?.[0];
            if (job && !["completed", "cancelled"].includes(job.status)) {
              fetch(`${SHIPPING_API}/api/deliveries/${job.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", "X-Service-Secret": SVC_SECRET },
                body: JSON.stringify({ status: "cancelled", cancel_reason: "Order cancelled by merchant" }),
              }).catch(() => {});
            }
          }
        }
      } catch (cancelErr) {
        console.error("[Orders] Shipping cancellation failed (non-blocking):", cancelErr);
      }
    }

    return NextResponse.json({ order: updated }, { headers });
  } catch (err) {
    console.error("Error updating order:", err);
    return NextResponse.json(
      { error: "Failed to update order" },
      { status: 500, headers }
    );
  }
}
