import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { corsHeaders, handleCORS } from "@/lib/cors";
import { supabase } from "@/lib/supabase";
import { createStoreSchema, updateStoreSchema } from "@/lib/validation";

export async function OPTIONS(request: NextRequest) {
  return handleCORS(request) || NextResponse.json({});
}

// GET /api/stores — Get merchant's store or list published stores
export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);
  const { searchParams } = new URL(request.url);

  const slug = searchParams.get("slug");

  // Public: get store by slug
  if (slug) {
    try {
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .eq("slug", slug)
        .eq("is_published", true)
        .single();

      if (error || !data) {
        return NextResponse.json(
          { error: "Store not found" },
          { status: 404, headers }
        );
      }

      return NextResponse.json({ store: data }, { headers });
    } catch (err) {
      console.error("Error fetching store:", err);
      return NextResponse.json(
        { error: "Failed to fetch store" },
        { status: 500, headers }
      );
    }
  }

  // Public: discover stores
  const discover = searchParams.get("discover");
  if (discover === "true") {
    try {
      const limit = Math.min(
        parseInt(searchParams.get("limit") || "20"),
        50
      );
      const offset = parseInt(searchParams.get("offset") || "0");

      const { data, error, count } = await supabase
        .from("stores")
        .select("*", { count: "exact" })
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return NextResponse.json(
        { stores: data || [], total: count || 0 },
        { headers }
      );
    } catch (err) {
      console.error("Error fetching stores:", err);
      return NextResponse.json(
        { error: "Failed to fetch stores" },
        { status: 500, headers }
      );
    }
  }

  // Authenticated: get my store
  const auth = await authenticateRequest(request);
  if (!auth) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers }
    );
  }

  try {
    const { data, error } = await supabase
      .from("stores")
      .select("*")
      .eq("merchant_id", auth.sub)
      .single();

    if (error && error.code !== "PGRST116") throw error;

    return NextResponse.json({ store: data || null }, { headers });
  } catch (err) {
    console.error("Error fetching store:", err);
    return NextResponse.json(
      { error: "Failed to fetch store" },
      { status: 500, headers }
    );
  }
}

// POST /api/stores — Create merchant store
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
    // Check if merchant already has a store
    const { data: existing } = await supabase
      .from("stores")
      .select("id")
      .eq("merchant_id", auth.sub)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "Store already exists" },
        { status: 409, headers }
      );
    }

    const body = await request.json();
    const parsed = createStoreSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400, headers }
      );
    }

    // Check slug uniqueness
    const { data: slugExists } = await supabase
      .from("stores")
      .select("id")
      .eq("slug", parsed.data.slug)
      .single();

    if (slugExists) {
      return NextResponse.json(
        { error: "Slug already taken" },
        { status: 409, headers }
      );
    }

    const { data, error } = await supabase
      .from("stores")
      .insert({ ...parsed.data, merchant_id: auth.sub })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ store: data }, { status: 201, headers });
  } catch (err) {
    console.error("Error creating store:", err);
    return NextResponse.json(
      { error: "Failed to create store" },
      { status: 500, headers }
    );
  }
}

// PUT /api/stores — Update merchant store
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

  try {
    const body = await request.json();
    const parsed = updateStoreSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400, headers }
      );
    }

    // If slug changed, check uniqueness
    if (parsed.data.slug) {
      const { data: slugExists } = await supabase
        .from("stores")
        .select("id, merchant_id")
        .eq("slug", parsed.data.slug)
        .single();

      if (slugExists && slugExists.merchant_id !== auth.sub) {
        return NextResponse.json(
          { error: "Slug already taken" },
          { status: 409, headers }
        );
      }
    }

    const { data, error } = await supabase
      .from("stores")
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq("merchant_id", auth.sub)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ store: data }, { headers });
  } catch (err) {
    console.error("Error updating store:", err);
    return NextResponse.json(
      { error: "Failed to update store" },
      { status: 500, headers }
    );
  }
}
