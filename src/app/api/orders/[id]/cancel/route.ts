import { NextRequest, NextResponse } from "next/server";
import { corsHeaders, handleCORS } from "@/lib/cors";
import { supabase } from "@/lib/supabase";
import { authenticateRequest } from "@/lib/auth";
import { creditWallet } from "@/lib/api-client";
import { releaseStock } from "@/lib/stock";
import { notifyOrderStatusChanged } from "@/lib/notification-client";

export async function OPTIONS(request: NextRequest) {
  return handleCORS(request) || NextResponse.json({});
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);

  const auth = await authenticateRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  }

  try {
    const orderId = params.id;

    // Fetch order
    const { data: order, error: fetchError } = await supabase
      .from("store_orders")
      .select("*, items:store_order_items(product_id, quantity)")
      .eq("id", orderId)
      .single();

    if (fetchError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404, headers });
    }

    // Verify ownership (customer or merchant)
    if (order.merchant_id !== auth.sub && order.customer_id !== auth.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403, headers });
    }

    // Verify cancellable status
    const cancellable = ["pending", "paid", "processing"];
    if (!cancellable.includes(order.status)) {
      return NextResponse.json(
        { error: `Cannot cancel order with status "${order.status}"` },
        { status: 400, headers }
      );
    }

    // Refund if order was paid
    if (order.status !== "pending" && order.customer_id) {
      try {
        await creditWallet(
          order.customer_id,
          order.total_amount,
          `Refund: Order ${order.order_number} cancelled`,
          order.id
        );
      } catch (err) {
        console.error("[CancelOrder] Customer refund failed:", err);
      }
    }

    // Release stock (both reserved and already committed)
    if (order.items?.length) {
      const stockItems = order.items.map((i: { product_id: string; quantity: number }) => ({
        product_id: i.product_id,
        quantity: i.quantity,
      }));

      if (order.status === "pending") {
        // Stock was only reserved, release reservation
        await releaseStock(stockItems);
      } else {
        // Stock was committed — restore stock_quantity
        for (const item of stockItems) {
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
    }

    // Update order status
    await supabase
      .from("store_orders")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    // Notify customer (non-blocking)
    if (order.customer_id) {
      notifyOrderStatusChanged(order.customer_id, order.order_number, "cancelled").catch(() => {});
    }

    return NextResponse.json(
      { success: true, order_number: order.order_number },
      { headers }
    );
  } catch (err) {
    console.error("[CancelOrder] Error:", err);
    return NextResponse.json(
      { error: "Failed to cancel order" },
      { status: 500, headers }
    );
  }
}
