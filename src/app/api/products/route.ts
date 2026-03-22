import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, authenticateServiceCall } from "@/lib/auth";
import { corsHeaders, handleCORS } from "@/lib/cors";
import { supabase } from "@/lib/supabase";
import { createProductSchema, updateProductSchema } from "@/lib/validation";

export async function OPTIONS(request: NextRequest) {
  return handleCORS(request) || NextResponse.json({});
}

// GET /api/products — List products for authenticated merchant
// Also supports ?store=<slug> for public storefront (no auth needed)
export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);
  const { searchParams } = new URL(request.url);

  // Public storefront query
  const storeSlug = searchParams.get("store");
  if (storeSlug) {
    try {
      // Look up the store
      const { data: store } = await supabase
        .from("stores")
        .select("id, merchant_id")
        .eq("slug", storeSlug)
        .eq("is_published", true)
        .single();

      if (!store) {
        return NextResponse.json(
          { error: "Store not found" },
          { status: 404, headers }
        );
      }

      const sort = searchParams.get("sort") || "featured";
      const minPrice = searchParams.get("min_price");
      const maxPrice = searchParams.get("max_price");

      let query = supabase
        .from("pos_products")
        .select("*, category:pos_categories(*)")
        .eq("merchant_id", store.merchant_id)
        .eq("is_active", true)
        .eq("is_published", true);

      const categoryId = searchParams.get("category");
      if (categoryId) {
        query = query.eq("category_id", categoryId);
      }
      if (minPrice) {
        query = query.gte("price", parseFloat(minPrice));
      }
      if (maxPrice) {
        query = query.lte("price", parseFloat(maxPrice));
      }

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
          query = query.order("is_featured", { ascending: false }).order("name");
      }

      const { data, error } = await query;
      if (error) throw error;

      return NextResponse.json({ products: data || [] }, { headers });
    } catch (err) {
      console.error("Error fetching public products:", err);
      return NextResponse.json(
        { error: "Failed to fetch products" },
        { status: 500, headers }
      );
    }
  }

  // Authenticated merchant query
  const auth = await authenticateRequest(request);
  if (!auth) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers }
    );
  }

  try {
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "100"),
      500
    );
    const offset = parseInt(searchParams.get("offset") || "0");
    const search = searchParams.get("search");
    const categoryId = searchParams.get("category");
    const activeOnly = searchParams.get("active") !== "false";

    let query = supabase
      .from("pos_products")
      .select("*, category:pos_categories(*)", { count: "exact" })
      .eq("merchant_id", auth.sub)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (activeOnly) {
      query = query.eq("is_active", true);
    }
    if (categoryId) {
      query = query.eq("category_id", categoryId);
    }
    if (search) {
      query = query.or(
        `name.ilike.%${search}%,sku.ilike.%${search}%,barcode.ilike.%${search}%`
      );
    }

    const { data, error, count } = await query;
    if (error) throw error;

    return NextResponse.json(
      { products: data || [], total: count || 0 },
      { headers }
    );
  } catch (err) {
    console.error("Error fetching products:", err);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500, headers }
    );
  }
}

// POST /api/products — Create a product
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
    const body = await request.json();
    const parsed = createProductSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400, headers }
      );
    }

    const productData = {
      ...parsed.data,
      merchant_id: auth.sub,
      // Auto-generate slug from name if not provided
      slug:
        parsed.data.slug ||
        parsed.data.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, ""),
    };

    const { data, error } = await supabase
      .from("pos_products")
      .insert(productData)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ product: data }, { status: 201, headers });
  } catch (err) {
    console.error("Error creating product:", err);
    return NextResponse.json(
      { error: "Failed to create product" },
      { status: 500, headers }
    );
  }
}

// PUT /api/products — Update a product (requires ?id=<uuid>)
export async function PUT(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);

  const auth = await authenticateRequest(request);
  if (!auth) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers }
    );
  }

  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("id");
  if (!productId) {
    return NextResponse.json(
      { error: "Missing product id" },
      { status: 400, headers }
    );
  }

  try {
    const body = await request.json();
    const parsed = updateProductSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400, headers }
      );
    }

    const { data, error } = await supabase
      .from("pos_products")
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq("id", productId)
      .eq("merchant_id", auth.sub)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ product: data }, { headers });
  } catch (err) {
    console.error("Error updating product:", err);
    return NextResponse.json(
      { error: "Failed to update product" },
      { status: 500, headers }
    );
  }
}

// DELETE /api/products — Soft-delete a product (requires ?id=<uuid>)
export async function DELETE(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);

  const auth = await authenticateRequest(request);
  if (!auth) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers }
    );
  }

  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("id");
  if (!productId) {
    return NextResponse.json(
      { error: "Missing product id" },
      { status: 400, headers }
    );
  }

  try {
    const { error } = await supabase
      .from("pos_products")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", productId)
      .eq("merchant_id", auth.sub);

    if (error) throw error;

    return NextResponse.json({ success: true }, { headers });
  } catch (err) {
    console.error("Error deleting product:", err);
    return NextResponse.json(
      { error: "Failed to delete product" },
      { status: 500, headers }
    );
  }
}
