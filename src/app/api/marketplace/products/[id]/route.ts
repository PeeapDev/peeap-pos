import { NextRequest, NextResponse } from "next/server";
import { corsHeaders, handleCORS } from "@/lib/cors";
import { supabase } from "@/lib/supabase";

export async function OPTIONS(request: NextRequest) {
  return handleCORS(request) || NextResponse.json({});
}

// GET /api/marketplace/products/[id] — Product detail with reviews and store info
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);

  try {
    // Fetch product with store info
    const { data: product, error: productError } = await supabase
      .from("pos_products")
      .select(
        "*, category:pos_categories(*), marketplace_category:marketplace_categories(*), store:stores!inner(id, name, slug, logo_url, banner_url, city, is_verified, average_rating, offers_delivery, delivery_fee, free_delivery_minimum, minimum_order)"
      )
      .eq("id", params.id)
      .eq("is_active", true)
      .eq("is_published", true)
      .eq("show_in_marketplace", true)
      .single();

    if (productError || !product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404, headers }
      );
    }

    // Fetch reviews
    const { data: reviews } = await supabase
      .from("product_reviews")
      .select("*")
      .eq("product_id", params.id)
      .eq("is_approved", true)
      .order("created_at", { ascending: false })
      .limit(20);

    // Fetch related products from same store
    const { data: relatedProducts } = await supabase
      .from("pos_products")
      .select("id, name, price, image_url, slug, average_rating, order_count")
      .eq("merchant_id", product.merchant_id)
      .eq("is_active", true)
      .eq("is_published", true)
      .eq("show_in_marketplace", true)
      .neq("id", params.id)
      .order("order_count", { ascending: false })
      .limit(6);

    // Increment view count (fire and forget)
    supabase
      .from("pos_products")
      .update({ view_count: (product.view_count || 0) + 1 })
      .eq("id", params.id)
      .then(() => {});

    return NextResponse.json(
      {
        product: { ...product, reviews: reviews || [] },
        related_products: relatedProducts || [],
      },
      { headers }
    );
  } catch (err) {
    console.error("Error fetching product:", err);
    return NextResponse.json(
      { error: "Failed to fetch product" },
      { status: 500, headers }
    );
  }
}
