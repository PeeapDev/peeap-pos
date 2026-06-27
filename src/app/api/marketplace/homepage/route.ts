import { NextRequest, NextResponse } from "next/server";
import { corsHeaders, handleCORS } from "@/lib/cors";
import { supabase } from "@/lib/supabase";

export async function OPTIONS(request: NextRequest) {
  return handleCORS(request) || NextResponse.json({});
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function safeQuery(query: PromiseLike<{ data: any[] | null; error: any }>): Promise<any[]> {
  try {
    const { data, error } = await query;
    if (error) {
      console.error("Query error:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Query exception:", err);
    return [];
  }
}

// Attach store info to products by merchant_id
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function attachStores(products: any[]): Promise<any[]> {
  if (products.length === 0) return [];
  const merchantIds = [...new Set(products.map((p) => p.merchant_id))];
  const { data: stores } = await supabase
    .from("stores")
    .select("id, merchant_id, name, slug, logo_url, city, is_verified, average_rating")
    .in("merchant_id", merchantIds);
  const storeMap = new Map((stores || []).map((s) => [s.merchant_id, s]));
  return products.map((p) => ({ ...p, store: storeMap.get(p.merchant_id) || null }));
}

// GET /api/marketplace/homepage — Public marketplace homepage data
export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);

  try {
    const [banners, categories, rawTrending, featuredStores, rawArrivals] =
      await Promise.all([
        safeQuery(
          supabase
            .from("marketplace_banners")
            .select("*")
            .eq("is_active", true)
            .order("sort_order")
        ),
        safeQuery(
          supabase
            .from("marketplace_categories")
            .select("*")
            .eq("is_active", true)
            .is("parent_id", null)
            .order("sort_order")
            .limit(20)
        ),
        safeQuery(
          supabase
            .from("pos_products")
            .select("*")
            .eq("is_active", true)
            .eq("is_published", true)
            .eq("show_in_marketplace", true)
            .order("order_count", { ascending: false })
            .limit(12)
        ),
        safeQuery(
          supabase
            .from("stores")
            .select("*")
            .eq("is_published", true)
            .order("total_orders", { ascending: false })
            .limit(8)
        ),
        safeQuery(
          supabase
            .from("pos_products")
            .select("*")
            .eq("is_active", true)
            .eq("is_published", true)
            .eq("show_in_marketplace", true)
            .order("created_at", { ascending: false })
            .limit(12)
        ),
      ]);

    // Attach store info to products
    const [trendingProducts, newArrivals] = await Promise.all([
      attachStores(rawTrending),
      attachStores(rawArrivals),
    ]);

    return NextResponse.json(
      {
        banners,
        categories,
        trending_products: trendingProducts,
        featured_stores: featuredStores,
        new_arrivals: newArrivals,
      },
      {
        headers: {
          ...headers,
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      }
    );
  } catch (err) {
    console.error("Error fetching marketplace homepage:", err);
    return NextResponse.json(
      { error: "Failed to load marketplace" },
      { status: 500, headers }
    );
  }
}
