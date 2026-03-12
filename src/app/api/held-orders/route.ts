import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { corsHeaders, handleCORS } from "@/lib/cors";
import { supabase } from "@/lib/supabase";
import { createHeldOrderSchema } from "@/lib/validation";

export async function OPTIONS(request: NextRequest) {
  return handleCORS(request) || NextResponse.json({});
}

// GET /api/held-orders — List held orders for authenticated merchant
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
    const status = searchParams.get("status") || "held";

    let query = supabase
      .from("pos_held_orders")
      .select("*")
      .eq("merchant_id", auth.sub)
      .order("created_at", { ascending: false });

    if (status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ orders: data || [] }, { headers });
  } catch (err) {
    console.error("Error fetching held orders:", err);
    return NextResponse.json(
      { error: "Failed to fetch held orders" },
      { status: 500, headers }
    );
  }
}

// POST /api/held-orders — Hold (save) an order
export async function POST(request: NextRequest) {
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
    const parsed = createHeldOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400, headers }
      );
    }

    const { data, error } = await supabase
      .from("pos_held_orders")
      .insert({
        merchant_id: auth.sub,
        name: parsed.data.name,
        items: parsed.data.items,
        subtotal: parsed.data.subtotal,
        tax_amount: parsed.data.tax_amount,
        discount_amount: parsed.data.discount_amount,
        total_amount: parsed.data.total_amount,
        customer_name: parsed.data.customer_name,
        customer_phone: parsed.data.customer_phone,
        notes: parsed.data.notes,
        status: "held",
        held_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ order: data }, { status: 201, headers });
  } catch (err) {
    console.error("Error holding order:", err);
    return NextResponse.json(
      { error: "Failed to hold order" },
      { status: 500, headers }
    );
  }
}

// PUT /api/held-orders?id=<uuid> — Resume a held order
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

  const orderId = new URL(request.url).searchParams.get("id");
  if (!orderId) {
    return NextResponse.json(
      { error: "Missing order id" },
      { status: 400, headers }
    );
  }

  try {
    // Fetch the held order to return its items
    const { data: order, error: fetchError } = await supabase
      .from("pos_held_orders")
      .select("*")
      .eq("id", orderId)
      .eq("merchant_id", auth.sub)
      .single();

    if (fetchError || !order) {
      return NextResponse.json(
        { error: "Held order not found" },
        { status: 404, headers }
      );
    }

    if (order.status !== "held") {
      return NextResponse.json(
        { error: "Order has already been resumed or completed" },
        { status: 400, headers }
      );
    }

    // Mark as resumed
    const { data, error } = await supabase
      .from("pos_held_orders")
      .update({
        status: "resumed",
        resumed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .eq("merchant_id", auth.sub)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ order: data }, { headers });
  } catch (err) {
    console.error("Error resuming held order:", err);
    return NextResponse.json(
      { error: "Failed to resume held order" },
      { status: 500, headers }
    );
  }
}

// DELETE /api/held-orders?id=<uuid> — Delete a held order
export async function DELETE(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);

  const auth = await authenticateRequest(request);
  if (!auth) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers }
    );
  }

  const orderId = new URL(request.url).searchParams.get("id");
  if (!orderId) {
    return NextResponse.json(
      { error: "Missing order id" },
      { status: 400, headers }
    );
  }

  try {
    const { error } = await supabase
      .from("pos_held_orders")
      .delete()
      .eq("id", orderId)
      .eq("merchant_id", auth.sub);

    if (error) throw error;

    return NextResponse.json({ success: true }, { headers });
  } catch (err) {
    console.error("Error deleting held order:", err);
    return NextResponse.json(
      { error: "Failed to delete held order" },
      { status: 500, headers }
    );
  }
}
