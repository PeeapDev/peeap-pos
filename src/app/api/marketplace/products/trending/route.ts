import { NextRequest, NextResponse } from "next/server";
import { corsHeaders, handleCORS } from "@/lib/cors";
import { supabase } from "@/lib/supabase";

export async function OPTIONS(request: NextRequest) {
  return handleCORS(request) || NextResponse.json({});
}

// GET /api/marketplace/products/trending — Trending products by order_count
export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);
  const { searchParams } = new URL(request.url);

  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
  const category = searchParams.get("category");

  try {
    let query = supabase
      .from("pos_products")
      .select(
        "*, store:stores!inner(id, name, slug, logo_url, city, is_verified, average_rating)"
      )
      .eq("is_active", true)
      .eq("is_published", true)
      .eq("show_in_marketplace", true)
      .gt("order_count", 0)
      .order("order_count", { ascending: false })
      .limit(limit);

    if (category) {
      const { data: cat } = await supabase
        .from("marketplace_categories")
        .select("id")
        .eq("slug", category)
        .single();

      if (cat) {
        query = query.eq("marketplace_category_id", cat.id);
      }
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ products: data || [] }, { headers });
  } catch (err) {
    console.error("Error fetching trending products:", err);
    return NextResponse.json(
      { error: "Failed to fetch trending products" },
      { status: 500, headers }
    );
  }
}
