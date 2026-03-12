import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { corsHeaders, handleCORS } from "@/lib/cors";
import { supabase } from "@/lib/supabase";
import { createCategorySchema, updateCategorySchema } from "@/lib/validation";

export async function OPTIONS(request: NextRequest) {
  return handleCORS(request) || NextResponse.json({});
}

// GET /api/categories
export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);
  const { searchParams } = new URL(request.url);

  // Public storefront query
  const storeSlug = searchParams.get("store");
  if (storeSlug) {
    try {
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

      const { data, error } = await supabase
        .from("pos_categories")
        .select("*")
        .eq("merchant_id", store.merchant_id)
        .eq("is_active", true)
        .order("sort_order");

      if (error) throw error;
      return NextResponse.json({ categories: data || [] }, { headers });
    } catch (err) {
      console.error("Error fetching public categories:", err);
      return NextResponse.json(
        { error: "Failed to fetch categories" },
        { status: 500, headers }
      );
    }
  }

  // Authenticated query
  const auth = await authenticateRequest(request);
  if (!auth) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers }
    );
  }

  try {
    const { data, error } = await supabase
      .from("pos_categories")
      .select("*")
      .eq("merchant_id", auth.sub)
      .order("sort_order");

    if (error) throw error;
    return NextResponse.json({ categories: data || [] }, { headers });
  } catch (err) {
    console.error("Error fetching categories:", err);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500, headers }
    );
  }
}

// POST /api/categories
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
    const parsed = createCategorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400, headers }
      );
    }

    const { data, error } = await supabase
      .from("pos_categories")
      .insert({ ...parsed.data, merchant_id: auth.sub })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ category: data }, { status: 201, headers });
  } catch (err) {
    console.error("Error creating category:", err);
    return NextResponse.json(
      { error: "Failed to create category" },
      { status: 500, headers }
    );
  }
}

// PUT /api/categories?id=<uuid>
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

  const categoryId = new URL(request.url).searchParams.get("id");
  if (!categoryId) {
    return NextResponse.json(
      { error: "Missing category id" },
      { status: 400, headers }
    );
  }

  try {
    const body = await request.json();
    const parsed = updateCategorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400, headers }
      );
    }

    const { data, error } = await supabase
      .from("pos_categories")
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq("id", categoryId)
      .eq("merchant_id", auth.sub)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ category: data }, { headers });
  } catch (err) {
    console.error("Error updating category:", err);
    return NextResponse.json(
      { error: "Failed to update category" },
      { status: 500, headers }
    );
  }
}

// DELETE /api/categories?id=<uuid>
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

  const categoryId = new URL(request.url).searchParams.get("id");
  if (!categoryId) {
    return NextResponse.json(
      { error: "Missing category id" },
      { status: 400, headers }
    );
  }

  try {
    const { error } = await supabase
      .from("pos_categories")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", categoryId)
      .eq("merchant_id", auth.sub);

    if (error) throw error;
    return NextResponse.json({ success: true }, { headers });
  } catch (err) {
    console.error("Error deleting category:", err);
    return NextResponse.json(
      { error: "Failed to delete category" },
      { status: 500, headers }
    );
  }
}
