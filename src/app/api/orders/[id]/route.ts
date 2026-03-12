import { NextRequest, NextResponse } from "next/server";
import { corsHeaders, handleCORS } from "@/lib/cors";
import { supabase } from "@/lib/supabase";

export async function OPTIONS(request: NextRequest) {
  return handleCORS(request) || NextResponse.json({});
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
          total_amount: order.total_amount,
          payment_method: order.payment_method,
          status: order.status,
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
