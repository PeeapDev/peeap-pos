import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { corsHeaders, handleCORS } from "@/lib/cors";
import { supabase } from "@/lib/supabase";

export async function OPTIONS(request: NextRequest) {
  return handleCORS(request) || NextResponse.json({});
}

// GET /api/marketplace/products/[id]/reviews — Product reviews (public)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);
  const { searchParams } = new URL(request.url);

  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const perPage = Math.min(50, parseInt(searchParams.get("per_page") || "20"));
  const offset = (page - 1) * perPage;

  try {
    const { data, error, count } = await supabase
      .from("product_reviews")
      .select("*", { count: "exact" })
      .eq("product_id", params.id)
      .eq("is_approved", true)
      .order("created_at", { ascending: false })
      .range(offset, offset + perPage - 1);

    if (error) throw error;

    // Get rating distribution
    const { data: allReviews } = await supabase
      .from("product_reviews")
      .select("rating")
      .eq("product_id", params.id)
      .eq("is_approved", true);

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of allReviews || []) {
      distribution[r.rating as keyof typeof distribution]++;
    }

    return NextResponse.json(
      {
        reviews: data || [],
        total: count || 0,
        page,
        per_page: perPage,
        distribution,
      },
      { headers }
    );
  } catch (err) {
    console.error("Error fetching reviews:", err);
    return NextResponse.json(
      { error: "Failed to fetch reviews" },
      { status: 500, headers }
    );
  }
}

// POST /api/marketplace/products/[id]/reviews — Submit a review (authenticated)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const { rating, review_text, customer_name } = body;

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "Rating must be between 1 and 5" },
        { status: 400, headers }
      );
    }

    // Check the product exists
    const { data: product } = await supabase
      .from("pos_products")
      .select("id, merchant_id")
      .eq("id", params.id)
      .eq("is_active", true)
      .single();

    if (!product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404, headers }
      );
    }

    // Get the store
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

    // Check if user already reviewed this product
    const { data: existing } = await supabase
      .from("product_reviews")
      .select("id")
      .eq("product_id", params.id)
      .eq("customer_id", auth.sub)
      .single();

    if (existing) {
      // Update existing review
      const { data, error } = await supabase
        .from("product_reviews")
        .update({
          rating,
          review_text: review_text || null,
          customer_name: customer_name || auth.email || "Customer",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ review: data }, { headers });
    }

    // Check if verified purchase
    const { data: orders } = await supabase
      .from("store_orders")
      .select("id")
      .eq("customer_id", auth.sub)
      .eq("store_id", store.id)
      .in("status", ["delivered", "completed"])
      .limit(1);

    const isVerifiedPurchase = (orders && orders.length > 0) || false;

    const { data, error } = await supabase
      .from("product_reviews")
      .insert({
        product_id: params.id,
        store_id: store.id,
        customer_id: auth.sub,
        customer_name: customer_name || auth.email || "Customer",
        rating,
        review_text: review_text || null,
        is_verified_purchase: isVerifiedPurchase,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ review: data }, { status: 201, headers });
  } catch (err) {
    console.error("Error submitting review:", err);
    return NextResponse.json(
      { error: "Failed to submit review" },
      { status: 500, headers }
    );
  }
}
