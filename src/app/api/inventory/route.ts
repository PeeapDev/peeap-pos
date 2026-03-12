import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { corsHeaders, handleCORS } from "@/lib/cors";
import { supabase } from "@/lib/supabase";
import {
  inventoryAdjustmentSchema,
  inventoryThresholdSchema,
} from "@/lib/validation";

export async function OPTIONS(request: NextRequest) {
  return handleCORS(request) || NextResponse.json({});
}

// GET /api/inventory — Get stock levels, optionally filter low stock
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
    const lowStock = searchParams.get("low_stock") === "true";
    const productId = searchParams.get("product_id");
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "100"),
      500
    );
    const offset = parseInt(searchParams.get("offset") || "0");

    // If requesting log for a specific product
    if (productId && searchParams.get("log") === "true") {
      const logLimit = Math.min(
        parseInt(searchParams.get("limit") || "50"),
        200
      );

      const { data, error, count } = await supabase
        .from("pos_inventory_log")
        .select("*", { count: "exact" })
        .eq("merchant_id", auth.sub)
        .eq("product_id", productId)
        .order("created_at", { ascending: false })
        .range(0, logLimit - 1);

      if (error) throw error;

      return NextResponse.json(
        { log: data || [], total: count || 0 },
        { headers }
      );
    }

    // Get stock levels from products
    let query = supabase
      .from("pos_products")
      .select(
        "id, name, sku, barcode, stock_quantity, low_stock_threshold, track_inventory, is_active, category:pos_categories(id, name)",
        { count: "exact" }
      )
      .eq("merchant_id", auth.sub)
      .eq("is_active", true)
      .eq("track_inventory", true)
      .order("stock_quantity", { ascending: true })
      .range(offset, offset + limit - 1);

    if (lowStock) {
      // Filter where stock_quantity <= low_stock_threshold
      // Supabase doesn't support column-to-column comparisons in .filter(),
      // so we fetch all tracked products and filter in code
      query = query.limit(500);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    let products = data || [];

    if (lowStock) {
      products = products.filter(
        (p) => p.stock_quantity <= (p.low_stock_threshold || 0)
      );
    }

    return NextResponse.json(
      { products, total: lowStock ? products.length : count || 0 },
      { headers }
    );
  } catch (err) {
    console.error("Error fetching inventory:", err);
    return NextResponse.json(
      { error: "Failed to fetch inventory" },
      { status: 500, headers }
    );
  }
}

// POST /api/inventory — Adjust stock for a product
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
    const parsed = inventoryAdjustmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400, headers }
      );
    }

    const { product_id, type, quantity_change, reason } = parsed.data;

    // Fetch current product
    const { data: product, error: fetchError } = await supabase
      .from("pos_products")
      .select("id, stock_quantity, track_inventory, name")
      .eq("id", product_id)
      .eq("merchant_id", auth.sub)
      .single();

    if (fetchError || !product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404, headers }
      );
    }

    if (!product.track_inventory) {
      return NextResponse.json(
        { error: "Inventory tracking is not enabled for this product" },
        { status: 400, headers }
      );
    }

    const previousQuantity = product.stock_quantity || 0;
    const newQuantity = Math.max(0, previousQuantity + quantity_change);

    // Update product stock
    const { error: updateError } = await supabase
      .from("pos_products")
      .update({
        stock_quantity: newQuantity,
        updated_at: new Date().toISOString(),
      })
      .eq("id", product_id)
      .eq("merchant_id", auth.sub);

    if (updateError) throw updateError;

    // Log the adjustment
    const { data: logEntry, error: logError } = await supabase
      .from("pos_inventory_log")
      .insert({
        merchant_id: auth.sub,
        product_id,
        type,
        quantity_change,
        previous_quantity: previousQuantity,
        new_quantity: newQuantity,
        reason,
        created_by: auth.email || auth.sub,
      })
      .select()
      .single();

    if (logError) {
      console.error("Failed to create inventory log:", logError);
      // Don't fail the request — stock was already updated
    }

    return NextResponse.json(
      {
        product_id,
        previous_quantity: previousQuantity,
        new_quantity: newQuantity,
        adjustment: quantity_change,
        log: logEntry || null,
      },
      { status: 201, headers }
    );
  } catch (err) {
    console.error("Error adjusting inventory:", err);
    return NextResponse.json(
      { error: "Failed to adjust inventory" },
      { status: 500, headers }
    );
  }
}

// PUT /api/inventory?product_id=<uuid> — Update low stock threshold
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
    const parsed = inventoryThresholdSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400, headers }
      );
    }

    const { product_id, low_stock_threshold } = parsed.data;

    const { data, error } = await supabase
      .from("pos_products")
      .update({
        low_stock_threshold,
        updated_at: new Date().toISOString(),
      })
      .eq("id", product_id)
      .eq("merchant_id", auth.sub)
      .select("id, name, sku, stock_quantity, low_stock_threshold")
      .single();

    if (error) throw error;

    return NextResponse.json({ product: data }, { headers });
  } catch (err) {
    console.error("Error updating inventory threshold:", err);
    return NextResponse.json(
      { error: "Failed to update threshold" },
      { status: 500, headers }
    );
  }
}
