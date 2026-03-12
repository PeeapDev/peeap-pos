import { NextRequest, NextResponse } from "next/server";
import { corsHeaders, handleCORS } from "@/lib/cors";
import { supabase } from "@/lib/supabase";
import { checkoutSchema } from "@/lib/validation";
import { initiatePayment } from "@/lib/api-client";

const STORE_URL =
  process.env.NEXT_PUBLIC_STORE_URL || "https://store.peeap.com";

export async function OPTIONS(request: NextRequest) {
  return handleCORS(request) || NextResponse.json({});
}

function generateOrderNumber(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `ORD-${code}`;
}

// POST /api/checkout — Create order from guest checkout (public, no auth)
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);

  try {
    const body = await request.json();
    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400, headers }
      );
    }

    const {
      store_id,
      customer_name,
      customer_phone,
      customer_email,
      items,
      payment_method,
      notes,
    } = parsed.data;

    // Verify the store exists and is published
    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id, merchant_id, slug, name")
      .eq("id", store_id)
      .eq("is_published", true)
      .single();

    if (storeError || !store) {
      return NextResponse.json(
        { error: "Store not found" },
        { status: 404, headers }
      );
    }

    // Fetch all requested products and validate them
    const productIds = items.map((item) => item.product_id);
    const { data: products, error: productsError } = await supabase
      .from("pos_products")
      .select(
        "id, name, price, tax_rate, track_inventory, stock_quantity, is_active, is_published, merchant_id, image_url"
      )
      .in("id", productIds)
      .eq("merchant_id", store.merchant_id)
      .eq("is_active", true)
      .eq("is_published", true);

    if (productsError) throw productsError;

    if (!products || products.length !== items.length) {
      const foundIds = new Set(products?.map((p) => p.id) || []);
      const missing = items
        .filter((item) => !foundIds.has(item.product_id))
        .map((item) => item.product_id);
      return NextResponse.json(
        {
          error: "Some products are unavailable",
          missing_products: missing,
        },
        { status: 400, headers }
      );
    }

    // Build a lookup map
    const productMap = new Map(products.map((p) => [p.id, p]));

    // Check stock availability and calculate totals from real prices
    let subtotal = 0;
    let totalTax = 0;
    const orderItems: Array<{
      product_id: string;
      product_name: string;
      quantity: number;
      unit_price: number;
      total_price: number;
    }> = [];

    for (const item of items) {
      const product = productMap.get(item.product_id)!;

      // Check stock
      if (
        product.track_inventory &&
        product.stock_quantity < item.quantity
      ) {
        return NextResponse.json(
          {
            error: `Insufficient stock for "${product.name}". Available: ${product.stock_quantity}`,
          },
          { status: 400, headers }
        );
      }

      const itemTotal = product.price * item.quantity;
      const itemTax = itemTotal * (product.tax_rate / 100);
      subtotal += itemTotal;
      totalTax += itemTax;

      orderItems.push({
        product_id: product.id,
        product_name: product.name,
        quantity: item.quantity,
        unit_price: product.price,
        total_price: itemTotal,
      });
    }

    const totalAmount = subtotal + totalTax;
    const orderNumber = generateOrderNumber();

    // Create the order
    const { data: order, error: orderError } = await supabase
      .from("store_orders")
      .insert({
        store_id,
        merchant_id: store.merchant_id,
        order_number: orderNumber,
        customer_name,
        customer_phone,
        customer_email: customer_email || null,
        subtotal,
        tax_amount: totalTax,
        discount_amount: 0,
        total_amount: totalAmount,
        payment_method,
        status: "pending",
        notes: notes || null,
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // Insert order items
    const itemsToInsert = orderItems.map((item) => ({
      ...item,
      order_id: order.id,
    }));

    const { error: itemsError } = await supabase
      .from("store_order_items")
      .insert(itemsToInsert);

    if (itemsError) {
      // Rollback: delete the order
      await supabase.from("store_orders").delete().eq("id", order.id);
      throw itemsError;
    }

    // Decrement stock for products that track inventory
    for (const item of items) {
      const product = productMap.get(item.product_id)!;
      if (product.track_inventory) {
        const newQty = product.stock_quantity - item.quantity;
        await supabase
          .from("pos_products")
          .update({
            stock_quantity: Math.max(0, newQty),
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.product_id);
      }
    }

    // Handle payment
    let checkout_url: string | undefined;

    if (payment_method === "mobile_money") {
      const payResult = await initiatePayment({
        amount: totalAmount,
        description: `Order ${orderNumber} at ${store.name}`,
        reference: order.id,
        customer_phone,
        payment_method: "mobile_money",
        return_url: `${STORE_URL}/shop/${store.slug}/order/${order.id}`,
        callback_url: `${STORE_URL}/api/orders/${order.id}/webhook`,
      });

      if (payResult.data?.checkout_url) {
        checkout_url = payResult.data.checkout_url;

        // Store payment reference
        await supabase
          .from("store_orders")
          .update({
            payment_reference: payResult.data.payment_id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", order.id);
      } else {
        console.error("Payment initiation failed:", payResult.error);
        // Order is still created with pending status - customer can retry
      }
    }

    // Return the order with items
    const { data: completeOrder } = await supabase
      .from("store_orders")
      .select("*, items:store_order_items(*)")
      .eq("id", order.id)
      .single();

    return NextResponse.json(
      {
        order: completeOrder,
        checkout_url,
      },
      { status: 201, headers }
    );
  } catch (err) {
    console.error("Error creating checkout order:", err);
    return NextResponse.json(
      { error: "Failed to process checkout" },
      { status: 500, headers }
    );
  }
}
