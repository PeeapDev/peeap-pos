import { NextRequest, NextResponse } from "next/server";
import { corsHeaders, handleCORS } from "@/lib/cors";
import { supabase } from "@/lib/supabase";
import { checkoutSchema } from "@/lib/validation";
import { initiatePayment, debitWallet, creditWallet } from "@/lib/api-client";
import { getShippingQuote, createDeliveryJob } from "@/lib/shipping-client";
import { reserveStock, commitStock, releaseStock } from "@/lib/stock";
import { sendNotification, notifyOrderConfirmed, notifyNewOrder } from "@/lib/notification-client";

const STORE_URL =
  process.env.NEXT_PUBLIC_STORE_URL || "https://store.peeap.com";
const CHECKOUT_URL =
  process.env.NEXT_PUBLIC_CHECKOUT_URL || "https://checkout.peeap.com";
const API_BASE_URL =
  process.env.API_BASE_URL || "https://api.peeap.com";
const SERVICE_SECRET = process.env.SERVICE_SECRET || "";

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
      delivery_address,
      delivery_city,
      order_type,
      customer_id,
    } = parsed.data;

    // Verify the store exists and is published
    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id, merchant_id, slug, name, delivery_fee, free_delivery_minimum, offers_delivery, minimum_order, address, city")
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
        "id, name, price, tax_rate, track_inventory, stock_quantity, reserved_quantity, is_active, is_published, merchant_id, image_url"
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

      // Check stock (accounting for reserved quantity)
      if (product.track_inventory) {
        const available = product.stock_quantity - (product.reserved_quantity || 0);
        if (available < item.quantity) {
          return NextResponse.json(
            {
              error: `Insufficient stock for "${product.name}". Available: ${available}`,
            },
            { status: 400, headers }
          );
        }
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

    // Calculate delivery fee if applicable
    let deliveryFee = 0;
    const effectiveOrderType = order_type || "online";
    if (effectiveOrderType === "delivery" && delivery_address) {
      // Use store's delivery fee, unless order meets free delivery minimum
      const storeDeliveryFee = (store as Record<string, unknown>).delivery_fee as number || 0;
      const freeMin = (store as Record<string, unknown>).free_delivery_minimum as number;
      if (freeMin && subtotal >= freeMin) {
        deliveryFee = 0;
      } else {
        deliveryFee = storeDeliveryFee;
      }
    }

    const totalAmount = subtotal + totalTax + deliveryFee;
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
        delivery_fee: deliveryFee,
        delivery_address: delivery_address || null,
        delivery_city: delivery_city || null,
        order_type: effectiveOrderType,
        customer_id: customer_id || null,
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

    // Reserve stock (instead of immediate decrement — committed on payment success)
    const stockItems = items.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
    }));
    const reservation = await reserveStock(stockItems);
    if (!reservation.success) {
      // Rollback: delete the order and items
      await supabase.from("store_order_items").delete().eq("order_id", order.id);
      await supabase.from("store_orders").delete().eq("id", order.id);
      return NextResponse.json(
        { error: reservation.error || "Stock reservation failed" },
        { status: 400, headers }
      );
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
        await supabase
          .from("store_orders")
          .update({
            payment_reference: payResult.data.payment_id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", order.id);
      } else {
        console.error("Payment initiation failed:", payResult.error);
      }
    } else if (payment_method === "peeap_checkout") {
      // Create a Peeap hosted checkout session via api.peeap.com
      try {
        const checkoutRes = await fetch(`${API_BASE_URL}/api/checkout/create`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Service-Secret": SERVICE_SECRET,
          },
          body: JSON.stringify({
            merchantId: store.merchant_id,
            amount: totalAmount,
            currency: "SLE",
            description: `Order ${orderNumber} at ${store.name}`,
            reference: order.id,
            redirectUrl: `${STORE_URL}/shop/${store.slug}/order/${order.id}`,
            callbackUrl: `${STORE_URL}/api/orders/${order.id}/webhook`,
            customerEmail: customer_email || undefined,
            customerPhone: customer_phone || undefined,
            customerName: customer_name,
            metadata: {
              store_id,
              order_id: order.id,
              order_number: orderNumber,
              source: "peeap_store",
            },
          }),
        });

        if (checkoutRes.ok) {
          const checkoutData = await checkoutRes.json();
          if (checkoutData.paymentUrl) {
            checkout_url = checkoutData.paymentUrl;
            await supabase
              .from("store_orders")
              .update({
                payment_reference: checkoutData.sessionId || checkoutData.paymentId,
                updated_at: new Date().toISOString(),
              })
              .eq("id", order.id);
          }
        } else {
          console.error("Peeap checkout creation failed:", await checkoutRes.text());
        }
      } catch (err) {
        console.error("Peeap checkout error:", err);
      }
    } else if (payment_method === "wallet" && customer_id) {
      // Direct wallet debit
      const debitResult = await debitWallet(
        customer_id,
        totalAmount,
        `Order ${orderNumber} at ${store.name}`,
        order.id
      );

      if (debitResult.data?.transaction_id) {
        // Credit merchant
        await creditWallet(
          store.merchant_id,
          totalAmount,
          `Sale: Order ${orderNumber}`,
          order.id
        ).catch((err) => console.error("Merchant credit failed:", err));

        // Mark order as paid
        await supabase
          .from("store_orders")
          .update({
            status: "confirmed",
            payment_reference: debitResult.data.transaction_id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", order.id);

        // Commit stock reservation (payment succeeded)
        await commitStock(stockItems);
      } else {
        // Debit failed — release stock reservation
        await releaseStock(stockItems);
        console.error("Wallet debit failed:", debitResult.error);
        return NextResponse.json(
          { error: debitResult.error || "Wallet payment failed. Please try another method." },
          { status: 400, headers }
        );
      }
    } else if (payment_method === "card") {
      // Card payment is handled separately via /api/pay/card
      // Order stays as "pending" — stock is reserved until payment or timeout
    }

    // --- Post-order: Shipping job creation (non-blocking) ---
    if (effectiveOrderType === "delivery" && delivery_address) {
      try {
        // Try dynamic shipping quote first
        const storeCity = (store as Record<string, unknown>).city as string || "";
        if (delivery_city && storeCity) {
          const quote = await getShippingQuote({
            pickup_city: storeCity,
            delivery_city: delivery_city,
            package_size: "medium",
          });
          if (quote?.fee && quote.fee !== deliveryFee) {
            deliveryFee = quote.fee;
            const newTotal = subtotal + totalTax + deliveryFee;
            await supabase.from("store_orders").update({
              delivery_fee: deliveryFee,
              total_amount: newTotal,
            }).eq("id", order.id);
          }
        }

        // Create delivery job
        const shippingResult = await createDeliveryJob({
          store_order_id: order.id,
          merchant_id: store.merchant_id,
          merchant_name: store.name,
          customer_id: customer_id || "00000000-0000-0000-0000-000000000000",
          customer_name,
          customer_phone,
          pickup_address: (store as Record<string, unknown>).address as string || store.name,
          pickup_city: storeCity,
          delivery_address,
          delivery_city: delivery_city || "",
          shipping_fee: deliveryFee,
          package_description: `Order ${orderNumber} - ${items.length} item(s)`,
          package_size: "medium",
          items: orderItems,
        });
        if (shippingResult?.job_number) {
          await supabase.from("store_orders").update({
            metadata: { shipping_job_number: shippingResult.job_number },
          }).eq("id", order.id);
        }
      } catch (err) {
        console.error("[Checkout] Shipping job creation failed (non-blocking):", err);
      }
    }

    // --- Post-order: Send notifications (non-blocking) ---
    try {
      if (customer_id) {
        notifyOrderConfirmed(customer_id, orderNumber, store.name, totalAmount).catch(() => {});
      }
      notifyNewOrder(store.merchant_id, orderNumber, customer_name, totalAmount).catch(() => {});
    } catch {
      // Notifications are non-blocking
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
