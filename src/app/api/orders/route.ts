import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { corsHeaders, handleCORS } from "@/lib/cors";
import { supabase } from "@/lib/supabase";
import { updateOrderStatusSchema } from "@/lib/validation";

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

    let query = supabase
      .from("store_orders")
      .select("*, items:store_order_items(*)", { count: "exact" })
      .eq("merchant_id", auth.sub)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && status !== "all") {
      query = query.eq("status", status);
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
      .select("id, merchant_id, status")
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

    return NextResponse.json({ order: updated }, { headers });
  } catch (err) {
    console.error("Error updating order:", err);
    return NextResponse.json(
      { error: "Failed to update order" },
      { status: 500, headers }
    );
  }
}
