import { NextRequest, NextResponse } from "next/server";
import { corsHeaders, handleCORS } from "@/lib/cors";
import { supabase } from "@/lib/supabase";

export async function OPTIONS(request: NextRequest) {
  return handleCORS(request) || NextResponse.json({});
}

// GET /api/marketplace/categories/[slug] — Products in a category
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);
  const { searchParams } = new URL(request.url);

  const sort = searchParams.get("sort") || "popular";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const perPage = Math.min(50, parseInt(searchParams.get("per_page") || "20"));
  const offset = (page - 1) * perPage;

  try {
    // Get the category
    const { data: category, error: catError } = await supabase
      .from("marketplace_categories")
      .select("*")
      .eq("slug", params.slug)
      .eq("is_active", true)
      .single();

    if (catError || !category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404, headers }
      );
    }

    // Also get child category IDs for subcategory inclusion
    const { data: childCats } = await supabase
      .from("marketplace_categories")
      .select("id")
      .eq("parent_id", category.id)
      .eq("is_active", true);

    const categoryIds = [
      category.id,
      ...(childCats || []).map((c) => c.id),
    ];

    let query = supabase
      .from("pos_products")
      .select(
        "*, store:stores!inner(id, name, slug, logo_url, city, is_verified)",
        { count: "exact" }
      )
      .eq("is_active", true)
      .eq("is_published", true)
      .in("marketplace_category_id", categoryIds);

    switch (sort) {
      case "price_asc":
        query = query.order("price", { ascending: true });
        break;
      case "price_desc":
        query = query.order("price", { ascending: false });
        break;
      case "newest":
        query = query.order("created_at", { ascending: false });
        break;
      case "rating":
        query = query.order("average_rating", { ascending: false });
        break;
      default:
        query = query.order("order_count", { ascending: false });
    }

    query = query.range(offset, offset + perPage - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    return NextResponse.json(
      {
        category,
        products: data || [],
        total: count || 0,
        page,
        per_page: perPage,
      },
      { headers }
    );
  } catch (err) {
    console.error("Error fetching category products:", err);
    return NextResponse.json(
      { error: "Failed to fetch category products" },
      { status: 500, headers }
    );
  }
}
