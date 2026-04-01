import { NextRequest, NextResponse } from "next/server";
import { corsHeaders, handleCORS } from "@/lib/cors";
import { supabase } from "@/lib/supabase";
import { authenticateRequest } from "@/lib/auth";
import { z } from "zod";

export async function OPTIONS(request: NextRequest) {
  return handleCORS(request) || NextResponse.json({});
}

// GET /api/reviews/moderate - Merchant: list reviews for moderation
export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);

  const auth = await authenticateRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  }

  const status = request.nextUrl.searchParams.get("status") || "pending";
  const limit = Math.min(parseInt(request.nextUrl.searchParams.get("limit") || "50"), 200);
  const offset = parseInt(request.nextUrl.searchParams.get("offset") || "0");

  try {
    // Get merchant's product IDs first
    const { data: products } = await supabase
      .from("pos_products")
      .select("id")
      .eq("merchant_id", auth.sub);

    if (!products?.length) {
      return NextResponse.json({ reviews: [], total: 0 }, { headers });
    }

    const productIds = products.map((p) => p.id);

    let query = supabase
      .from("product_reviews")
      .select("*", { count: "exact" })
      .in("product_id", productIds)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status === "pending") {
      query = query.eq("is_approved", false);
    } else if (status === "approved") {
      query = query.eq("is_approved", true);
    }

    const { data: reviews, error, count } = await query;
    if (error) throw error;

    // Enrich with product info
    const enriched = await Promise.all(
      (reviews || []).map(async (review) => {
        const { data: product } = await supabase
          .from("pos_products")
          .select("name, image_url")
          .eq("id", review.product_id)
          .single();
        return {
          ...review,
          product_name: product?.name || "Unknown Product",
          product_image: product?.image_url || null,
        };
      })
    );

    return NextResponse.json({ reviews: enriched, total: count || 0 }, { headers });
  } catch (err) {
    console.error("[ReviewModerate] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch reviews" }, { status: 500, headers });
  }
}

const moderateSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
});

// PUT /api/reviews/moderate - Merchant: approve/reject review
export async function PUT(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);

  const auth = await authenticateRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  }

  try {
    const body = await request.json();
    const parsed = moderateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400, headers }
      );
    }

    const { id, action } = parsed.data;

    // Verify review's product belongs to merchant
    const { data: review } = await supabase
      .from("product_reviews")
      .select("id, product_id")
      .eq("id", id)
      .single();

    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404, headers });
    }

    const { data: product } = await supabase
      .from("pos_products")
      .select("merchant_id")
      .eq("id", review.product_id)
      .single();

    if (!product || product.merchant_id !== auth.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403, headers });
    }

    if (action === "approve") {
      await supabase
        .from("product_reviews")
        .update({ is_approved: true })
        .eq("id", id);
    } else {
      await supabase
        .from("product_reviews")
        .delete()
        .eq("id", id);
    }

    return NextResponse.json({ success: true }, { headers });
  } catch (err) {
    console.error("[ReviewModerate] PUT error:", err);
    return NextResponse.json({ error: "Failed to moderate review" }, { status: 500, headers });
  }
}
