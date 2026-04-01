import { NextRequest, NextResponse } from "next/server";
import { corsHeaders, handleCORS } from "@/lib/cors";
import { supabase } from "@/lib/supabase";
import { authenticateRequest } from "@/lib/auth";
import { creditWallet } from "@/lib/api-client";
import { notifyReturnRequested, notifyReturnApproved } from "@/lib/notification-client";
import { z } from "zod";

export async function OPTIONS(request: NextRequest) {
  return handleCORS(request) || NextResponse.json({});
}

// GET /api/returns - Merchant: list return requests
export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);

  const auth = await authenticateRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  }

  const status = request.nextUrl.searchParams.get("status");
  const limit = Math.min(parseInt(request.nextUrl.searchParams.get("limit") || "50"), 200);
  const offset = parseInt(request.nextUrl.searchParams.get("offset") || "0");

  let query = supabase
    .from("return_requests")
    .select("*, order:store_orders(order_number, total_amount, customer_name)", { count: "exact" })
    .eq("merchant_id", auth.sub)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  return NextResponse.json({ returns: data || [], total: count || 0 }, { headers });
}

const createReturnSchema = z.object({
  order_id: z.string().uuid(),
  reason: z.string().min(1).max(2000),
});

// POST /api/returns - Customer: create return request
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);

  const auth = await authenticateRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  }

  try {
    const body = await request.json();
    const parsed = createReturnSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400, headers }
      );
    }

    const { order_id, reason } = parsed.data;

    // Verify order belongs to customer and is delivered
    const { data: order } = await supabase
      .from("store_orders")
      .select("id, merchant_id, customer_id, status, total_amount, order_number, customer_name")
      .eq("id", order_id)
      .single();

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404, headers });
    }
    if (order.customer_id !== auth.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403, headers });
    }
    if (order.status !== "delivered") {
      return NextResponse.json(
        { error: "Returns can only be requested for delivered orders" },
        { status: 400, headers }
      );
    }

    // Check no existing pending/approved return
    const { data: existing } = await supabase
      .from("return_requests")
      .select("id")
      .eq("order_id", order_id)
      .in("status", ["pending", "approved"])
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: "A return request already exists for this order" },
        { status: 400, headers }
      );
    }

    const { data: returnRequest, error } = await supabase
      .from("return_requests")
      .insert({
        order_id,
        merchant_id: order.merchant_id,
        customer_id: auth.sub,
        reason,
        status: "pending",
        refund_amount: order.total_amount,
      })
      .select()
      .single();

    if (error) throw error;

    // Notify merchant (non-blocking)
    notifyReturnRequested(order.merchant_id, order.order_number, order.customer_name).catch(() => {});

    return NextResponse.json({ return_request: returnRequest }, { status: 201, headers });
  } catch (err) {
    console.error("[Returns] POST error:", err);
    return NextResponse.json({ error: "Failed to create return request" }, { status: 500, headers });
  }
}

const updateReturnSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["approved", "rejected"]),
  merchant_notes: z.string().max(2000).optional(),
});

// PUT /api/returns - Merchant: approve/reject return
export async function PUT(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);

  const auth = await authenticateRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  }

  try {
    const body = await request.json();
    const parsed = updateReturnSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400, headers }
      );
    }

    const { id, status, merchant_notes } = parsed.data;

    // Verify return request
    const { data: ret } = await supabase
      .from("return_requests")
      .select("*, order:store_orders(order_number, total_amount)")
      .eq("id", id)
      .single();

    if (!ret) {
      return NextResponse.json({ error: "Return request not found" }, { status: 404, headers });
    }
    if (ret.merchant_id !== auth.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403, headers });
    }
    if (ret.status !== "pending") {
      return NextResponse.json({ error: "Return request already processed" }, { status: 400, headers });
    }

    // Update return request
    const { data: updated, error } = await supabase
      .from("return_requests")
      .update({
        status,
        merchant_notes: merchant_notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    // If approved: refund customer, restock items
    if (status === "approved") {
      // Refund wallet
      try {
        await creditWallet(
          ret.customer_id,
          ret.refund_amount,
          `Refund: Return approved for order ${ret.order?.order_number}`,
          ret.order_id
        );
      } catch (err) {
        console.error("[Returns] Refund failed:", err);
      }

      // Restock items
      const { data: items } = await supabase
        .from("store_order_items")
        .select("product_id, quantity")
        .eq("order_id", ret.order_id);

      if (items?.length) {
        for (const item of items) {
          const { data: product } = await supabase
            .from("pos_products")
            .select("stock_quantity")
            .eq("id", item.product_id)
            .single();
          if (product) {
            await supabase
              .from("pos_products")
              .update({
                stock_quantity: product.stock_quantity + item.quantity,
                updated_at: new Date().toISOString(),
              })
              .eq("id", item.product_id);
          }
        }
      }

      // Notify customer (non-blocking)
      notifyReturnApproved(ret.customer_id, ret.order?.order_number, ret.refund_amount).catch(() => {});
    }

    return NextResponse.json({ return_request: updated }, { headers });
  } catch (err) {
    console.error("[Returns] PUT error:", err);
    return NextResponse.json({ error: "Failed to update return request" }, { status: 500, headers });
  }
}
