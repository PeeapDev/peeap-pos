import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { corsHeaders, handleCORS } from "@/lib/cors";
import { supabase } from "@/lib/supabase";
import { createSaleSchema } from "@/lib/validation";
import { creditWallet } from "@/lib/api-client";

export async function OPTIONS(request: NextRequest) {
  return handleCORS(request) || NextResponse.json({});
}

// GET /api/sales — List sales for authenticated merchant
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
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");
    const paymentMethod = searchParams.get("payment_method");

    let query = supabase
      .from("pos_sales")
      .select("*, items:pos_sale_items(*)", { count: "exact" })
      .eq("merchant_id", auth.sub)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq("status", status);
    }
    if (startDate) {
      query = query.gte("created_at", startDate);
    }
    if (endDate) {
      query = query.lte("created_at", endDate);
    }
    if (paymentMethod) {
      query = query.eq("payment_method", paymentMethod);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    return NextResponse.json(
      { sales: data || [], total: count || 0 },
      { headers }
    );
  } catch (err) {
    console.error("Error fetching sales:", err);
    return NextResponse.json(
      { error: "Failed to fetch sales" },
      { status: 500, headers }
    );
  }
}

// POST /api/sales — Create a sale
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
    const parsed = createSaleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400, headers }
      );
    }

    const { items, ...saleData } = parsed.data;

    // Generate sale number
    const { count } = await supabase
      .from("pos_sales")
      .select("id", { count: "exact", head: true })
      .eq("merchant_id", auth.sub);

    const saleNumber = `S${String((count || 0) + 1).padStart(6, "0")}`;

    // Insert sale
    const { data: sale, error: saleError } = await supabase
      .from("pos_sales")
      .insert({
        ...saleData,
        merchant_id: auth.sub,
        sale_number: saleNumber,
        status: "completed",
      })
      .select()
      .single();

    if (saleError) throw saleError;

    // Insert sale items
    const saleItems = items.map((item) => ({
      ...item,
      sale_id: sale.id,
    }));

    const { error: itemsError } = await supabase
      .from("pos_sale_items")
      .insert(saleItems);

    if (itemsError) {
      // Rollback: delete the sale
      await supabase.from("pos_sales").delete().eq("id", sale.id);
      throw itemsError;
    }

    // Update inventory for tracked products
    for (const item of items) {
      if (item.product_id) {
        const { data: product } = await supabase
          .from("pos_products")
          .select("track_inventory, stock_quantity")
          .eq("id", item.product_id)
          .single();

        if (product?.track_inventory) {
          const newQty = (product.stock_quantity || 0) - item.quantity;
          await supabase
            .from("pos_products")
            .update({
              stock_quantity: Math.max(0, newQty),
              updated_at: new Date().toISOString(),
            })
            .eq("id", item.product_id);

          // Log inventory change
          await supabase.from("pos_inventory_log").insert({
            merchant_id: auth.sub,
            product_id: item.product_id,
            type: "sale",
            quantity_change: -item.quantity,
            previous_quantity: product.stock_quantity,
            new_quantity: Math.max(0, newQty),
            reference_id: sale.id,
          });
        }
      }
    }

    // Credit merchant wallet via api.peeap.com
    if (saleData.total_amount > 0) {
      const walletResult = await creditWallet(
        auth.sub,
        saleData.total_amount,
        `POS Sale ${saleNumber}`,
        sale.id
      );
      if (walletResult.error) {
        console.error("Wallet credit failed:", walletResult.error);
        // Sale still recorded; wallet credit can be retried
      }
    }

    // Return sale with items
    const { data: completeSale } = await supabase
      .from("pos_sales")
      .select("*, items:pos_sale_items(*)")
      .eq("id", sale.id)
      .single();

    return NextResponse.json(
      { sale: completeSale },
      { status: 201, headers }
    );
  } catch (err) {
    console.error("Error creating sale:", err);
    return NextResponse.json(
      { error: "Failed to create sale" },
      { status: 500, headers }
    );
  }
}
