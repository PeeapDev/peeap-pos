import { createClient } from "@supabase/supabase-js";
import MarketplaceHome from "./MarketplaceHome";
import { DEMO_MERCHANT_FILTER } from "@/lib/marketplace-demo";

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function safeQuery(
  queryFn: () => PromiseLike<{ data: any[] | null; error: any }>
): Promise<any[]> {
  try {
    const { data, error } = await queryFn();
    if (error) {
      console.error("Homepage query error:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Homepage query exception:", err);
    return [];
  }
}

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = getSupabase();

  const [banners, categories, rawTrending, featuredStores, rawArrivals] =
    await Promise.all([
      safeQuery(() =>
        supabase
          .from("marketplace_banners")
          .select("*")
          .eq("is_active", true)
          .order("sort_order")
          .limit(5)
      ),
      safeQuery(() =>
        supabase
          .from("marketplace_categories")
          .select("*")
          .eq("is_active", true)
          .is("parent_id", null)
          .order("sort_order")
          .limit(20)
      ),
      safeQuery(() =>
        supabase
          .from("pos_products")
          .select("*")
          .eq("is_active", true)
          .eq("is_published", true)
          .eq("show_in_marketplace", true)
          .not("merchant_id", "in", DEMO_MERCHANT_FILTER)
          .order("order_count", { ascending: false })
          .limit(12)
      ),
      safeQuery(() =>
        supabase
          .from("stores")
          .select("*")
          .eq("is_published", true)
          .not("merchant_id", "in", DEMO_MERCHANT_FILTER)
          .order("total_orders", { ascending: false })
          .limit(8)
      ),
      safeQuery(() =>
        supabase
          .from("pos_products")
          .select("*")
          .eq("is_active", true)
          .eq("is_published", true)
          .eq("show_in_marketplace", true)
          .not("merchant_id", "in", DEMO_MERCHANT_FILTER)
          .order("created_at", { ascending: false })
          .limit(12)
      ),
    ]);

  // Attach store info to products by merchant_id
  const merchantIds = [
    ...new Set([
      ...rawTrending.map((p) => p.merchant_id),
      ...rawArrivals.map((p) => p.merchant_id),
    ]),
  ];

  let storeMap = new Map();
  if (merchantIds.length > 0) {
    const { data: stores } = await supabase
      .from("stores")
      .select("id, merchant_id, name, slug, logo_url, city, is_verified, average_rating")
      .in("merchant_id", merchantIds)
      .eq("is_published", true)
      .not("merchant_id", "in", DEMO_MERCHANT_FILTER);
    storeMap = new Map((stores || []).map((s) => [s.merchant_id, s]));
  }

  const trendingProducts = rawTrending.filter((p) => storeMap.has(p.merchant_id)).map((p) => ({
    ...p,
    store: storeMap.get(p.merchant_id) || null,
  }));
  const newArrivals = rawArrivals.filter((p) => storeMap.has(p.merchant_id)).map((p) => ({
    ...p,
    store: storeMap.get(p.merchant_id) || null,
  }));

  return (
    <MarketplaceHome
      data={{
        banners,
        categories,
        trending_products: trendingProducts,
        featured_stores: featuredStores,
        new_arrivals: newArrivals,
      }}
    />
  );
}
