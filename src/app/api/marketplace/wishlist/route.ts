import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { corsHeaders, handleCORS } from "@/lib/cors";
import { supabase } from "@/lib/supabase";

export async function OPTIONS(request: NextRequest) {
  return handleCORS(request) || NextResponse.json({});
}

// GET /api/marketplace/wishlist — Get user's wishlist (authenticated)
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
    const { data, error } = await supabase
      .from("wishlists")
      .select(
        "*, product:pos_products(id, name, price, image_url, slug, average_rating, is_active, is_published), store:stores(id, name, slug, logo_url)"
      )
      .eq("user_id", auth.sub)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Filter out products that are no longer active/published
    const activeItems = (data || []).filter(
      (item) => item.product?.is_active && item.product?.is_published
    );

    return NextResponse.json({ wishlist: activeItems }, { headers });
  } catch (err) {
    console.error("Error fetching wishlist:", err);
    return NextResponse.json(
      { error: "Failed to fetch wishlist" },
      { status: 500, headers }
    );
  }
}

// POST /api/marketplace/wishlist — Add/remove from wishlist (toggle)
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
    const { product_id } = await request.json();

    if (!product_id) {
      return NextResponse.json(
        { error: "product_id is required" },
        { status: 400, headers }
      );
    }

    // Check if already in wishlist
    const { data: existing } = await supabase
      .from("wishlists")
      .select("id")
      .eq("user_id", auth.sub)
      .eq("product_id", product_id)
      .single();

    if (existing) {
      // Remove from wishlist
      await supabase.from("wishlists").delete().eq("id", existing.id);
      return NextResponse.json(
        { action: "removed", wishlisted: false },
        { headers }
      );
    }

    // Get product's store
    const { data: product } = await supabase
      .from("pos_products")
      .select("merchant_id")
      .eq("id", product_id)
      .single();

    if (!product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404, headers }
      );
    }

    const { data: store } = await supabase
      .from("stores")
      .select("id")
      .eq("merchant_id", product.merchant_id)
      .single();

    if (!store) {
      return NextResponse.json(
        { error: "Store not found" },
        { status: 404, headers }
      );
    }

    // Add to wishlist
    const { error } = await supabase.from("wishlists").insert({
      user_id: auth.sub,
      product_id,
      store_id: store.id,
    });

    if (error) throw error;

    return NextResponse.json(
      { action: "added", wishlisted: true },
      { status: 201, headers }
    );
  } catch (err) {
    console.error("Error updating wishlist:", err);
    return NextResponse.json(
      { error: "Failed to update wishlist" },
      { status: 500, headers }
    );
  }
}
