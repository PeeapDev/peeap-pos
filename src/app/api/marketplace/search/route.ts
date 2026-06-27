import { NextRequest, NextResponse } from "next/server";
import { corsHeaders, handleCORS } from "@/lib/cors";
import { supabase } from "@/lib/supabase";

export async function OPTIONS(request: NextRequest) {
  return handleCORS(request) || NextResponse.json({});
}

// GET /api/marketplace/search — Full-text product search
// ?q=query&category=slug&city=&min_price=&max_price=&sort=relevance|price_asc|price_desc|newest|popular&page=1&per_page=20
export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);
  const { searchParams } = new URL(request.url);

  const q = searchParams.get("q") || "";
  const category = searchParams.get("category");
  const city = searchParams.get("city");
  const minPrice = searchParams.get("min_price");
  const maxPrice = searchParams.get("max_price");
  const sort = searchParams.get("sort") || "relevance";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const perPage = Math.min(50, parseInt(searchParams.get("per_page") || "20"));
  const offset = (page - 1) * perPage;

  try {
    let query = supabase
      .from("pos_products")
      .select("*", { count: "exact" })
      .eq("is_active", true)
      .eq("is_published", true)
      .eq("show_in_marketplace", true);

    // Full-text search using tsvector
    if (q) {
      const tsQuery = q
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => `${word}:*`)
        .join(" & ");
      query = query.textSearch("search_vector", tsQuery);
    }

    // Filter by marketplace category
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

    // Filter by city — need to get merchant_ids from stores in that city
    if (city) {
      const { data: cityStores } = await supabase
        .from("stores")
        .select("merchant_id")
        .ilike("city", `%${city}%`);
      if (cityStores && cityStores.length > 0) {
        query = query.in("merchant_id", cityStores.map((s) => s.merchant_id));
      }
    }

    // Price filters
    if (minPrice) {
      query = query.gte("price", parseFloat(minPrice));
    }
    if (maxPrice) {
      query = query.lte("price", parseFloat(maxPrice));
    }

    // Sorting
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
      case "popular":
        query = query.order("order_count", { ascending: false });
        break;
      case "rating":
        query = query.order("average_rating", { ascending: false });
        break;
      default:
        if (!q) {
          query = query.order("order_count", { ascending: false });
        }
        break;
    }

    query = query.range(offset, offset + perPage - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    // Attach store info
    const products = data || [];
    const merchantIds = [...new Set(products.map((p: { merchant_id: string }) => p.merchant_id))];
    let storeMap = new Map();
    if (merchantIds.length > 0) {
      const { data: stores } = await supabase
        .from("stores")
        .select("id, merchant_id, name, slug, logo_url, city, is_verified, average_rating, offers_delivery")
        .in("merchant_id", merchantIds);
      storeMap = new Map((stores || []).map((s) => [s.merchant_id, s]));
    }

    const productsWithStores = products.map((p: { merchant_id: string }) => ({
      ...p,
      store: storeMap.get(p.merchant_id) || null,
    }));

    return NextResponse.json(
      {
        products: productsWithStores,
        total: count || 0,
        page,
        per_page: perPage,
      },
      { headers }
    );
  } catch (err) {
    console.error("Error searching marketplace:", err);
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500, headers }
    );
  }
}
