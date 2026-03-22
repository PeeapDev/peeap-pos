import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { corsHeaders, handleCORS } from "@/lib/cors";
import { supabase } from "@/lib/supabase";

export async function OPTIONS(request: NextRequest) {
  return handleCORS(request) || NextResponse.json({});
}

// GET /api/dashboard/overview — Merchant store overview stats
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

  const merchantId = auth.sub;
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const startOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7).toISOString();

  try {
    const [
      todayOrdersRes,
      todaySalesRes,
      pendingOrdersRes,
      lowStockRes,
      totalProductsRes,
      totalCustomersRes,
      weeklyOrdersRes,
      recentReviewsRes,
      storeRes,
    ] = await Promise.all([
      // Today's online orders
      supabase
        .from("store_orders")
        .select("total_amount", { count: "exact" })
        .eq("merchant_id", merchantId)
        .gte("created_at", startOfDay),

      // Today's POS sales
      supabase
        .from("pos_sales")
        .select("total_amount", { count: "exact" })
        .eq("merchant_id", merchantId)
        .eq("status", "completed")
        .gte("created_at", startOfDay),

      // Pending online orders needing action
      supabase
        .from("store_orders")
        .select("id, order_number, customer_name, total_amount, created_at")
        .eq("merchant_id", merchantId)
        .in("status", ["pending", "paid"])
        .order("created_at", { ascending: false })
        .limit(10),

      // Low stock products
      supabase
        .from("pos_products")
        .select("id, name, stock_quantity, low_stock_threshold")
        .eq("merchant_id", merchantId)
        .eq("is_active", true)
        .eq("track_inventory", true)
        .filter("stock_quantity", "lte", "low_stock_threshold")
        .order("stock_quantity")
        .limit(10),

      // Total active products
      supabase
        .from("pos_products")
        .select("id", { count: "exact", head: true })
        .eq("merchant_id", merchantId)
        .eq("is_active", true),

      // Total customers
      supabase
        .from("pos_customers")
        .select("id", { count: "exact", head: true })
        .eq("merchant_id", merchantId)
        .eq("is_active", true),

      // Weekly orders for chart
      supabase
        .from("store_orders")
        .select("total_amount, created_at")
        .eq("merchant_id", merchantId)
        .gte("created_at", startOfWeek)
        .order("created_at"),

      // Recent reviews
      supabase
        .from("product_reviews")
        .select("*, product:pos_products(name)")
        .eq("store_id", merchantId)
        .order("created_at", { ascending: false })
        .limit(5),

      // Store info
      supabase
        .from("stores")
        .select("name, slug, average_rating, total_ratings, total_orders, total_revenue, is_published")
        .eq("merchant_id", merchantId)
        .single(),
    ]);

    // Calculate today's revenue
    const todayOnlineRevenue = (todayOrdersRes.data || []).reduce(
      (sum, o) => sum + (o.total_amount || 0),
      0
    );
    const todayPOSRevenue = (todaySalesRes.data || []).reduce(
      (sum, s) => sum + (s.total_amount || 0),
      0
    );

    // Build 7-day revenue chart
    const dailyRevenue: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      dailyRevenue[d.toISOString().split("T")[0]] = 0;
    }
    for (const order of weeklyOrdersRes.data || []) {
      const date = order.created_at.split("T")[0];
      if (dailyRevenue[date] !== undefined) {
        dailyRevenue[date] += order.total_amount || 0;
      }
    }

    return NextResponse.json(
      {
        today: {
          revenue: todayOnlineRevenue + todayPOSRevenue,
          online_revenue: todayOnlineRevenue,
          pos_revenue: todayPOSRevenue,
          online_orders: todayOrdersRes.count || 0,
          pos_sales: todaySalesRes.count || 0,
        },
        pending_orders: pendingOrdersRes.data || [],
        low_stock: lowStockRes.data || [],
        totals: {
          products: totalProductsRes.count || 0,
          customers: totalCustomersRes.count || 0,
        },
        revenue_chart: Object.entries(dailyRevenue).map(([date, amount]) => ({
          date,
          amount,
        })),
        recent_reviews: recentReviewsRes.data || [],
        store: storeRes.data || null,
      },
      { headers }
    );
  } catch (err) {
    console.error("Error fetching dashboard overview:", err);
    return NextResponse.json(
      { error: "Failed to fetch overview" },
      { status: 500, headers }
    );
  }
}
