import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { corsHeaders, handleCORS } from "@/lib/cors";
import { supabase } from "@/lib/supabase";
import { createDiscountSchema, updateDiscountSchema } from "@/lib/validation";

export async function OPTIONS(request: NextRequest) {
  return handleCORS(request) || NextResponse.json({});
}

// GET /api/discounts — List discounts or validate a specific code
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

  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");

    // Validate a specific discount code
    if (code) {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("pos_discounts")
        .select("*")
        .eq("merchant_id", auth.sub)
        .eq("code", code.toUpperCase())
        .eq("is_active", true)
        .single();

      if (error || !data) {
        return NextResponse.json(
          { error: "Invalid discount code" },
          { status: 404, headers }
        );
      }

      // Check expiry
      if (data.expires_at && data.expires_at < now) {
        return NextResponse.json(
          { error: "Discount code has expired" },
          { status: 410, headers }
        );
      }

      // Check start date
      if (data.starts_at && data.starts_at > now) {
        return NextResponse.json(
          { error: "Discount code is not yet active" },
          { status: 422, headers }
        );
      }

      // Check usage limit
      if (
        data.usage_limit != null &&
        data.usage_count != null &&
        data.usage_count >= data.usage_limit
      ) {
        return NextResponse.json(
          { error: "Discount code usage limit reached" },
          { status: 410, headers }
        );
      }

      return NextResponse.json({ discount: data, valid: true }, { headers });
    }

    // List all discounts
    const activeOnly = searchParams.get("active") !== "false";

    let query = supabase
      .from("pos_discounts")
      .select("*")
      .eq("merchant_id", auth.sub)
      .order("created_at", { ascending: false });

    if (activeOnly) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ discounts: data || [] }, { headers });
  } catch (err) {
    console.error("Error fetching discounts:", err);
    return NextResponse.json(
      { error: "Failed to fetch discounts" },
      { status: 500, headers }
    );
  }
}

// POST /api/discounts — Create a discount
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
    const parsed = createDiscountSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400, headers }
      );
    }

    const discountData = {
      ...parsed.data,
      merchant_id: auth.sub,
      // Normalize code to uppercase
      code: parsed.data.code ? parsed.data.code.toUpperCase() : undefined,
      usage_count: 0,
    };

    // Check for duplicate code if provided
    if (discountData.code) {
      const { data: existing } = await supabase
        .from("pos_discounts")
        .select("id")
        .eq("merchant_id", auth.sub)
        .eq("code", discountData.code)
        .eq("is_active", true)
        .maybeSingle();

      if (existing) {
        return NextResponse.json(
          { error: "A discount with this code already exists" },
          { status: 409, headers }
        );
      }
    }

    const { data, error } = await supabase
      .from("pos_discounts")
      .insert(discountData)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ discount: data }, { status: 201, headers });
  } catch (err) {
    console.error("Error creating discount:", err);
    return NextResponse.json(
      { error: "Failed to create discount" },
      { status: 500, headers }
    );
  }
}

// PUT /api/discounts?id=<uuid> — Update a discount
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

  const discountId = new URL(request.url).searchParams.get("id");
  if (!discountId) {
    return NextResponse.json(
      { error: "Missing discount id" },
      { status: 400, headers }
    );
  }

  try {
    const body = await request.json();
    const parsed = updateDiscountSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400, headers }
      );
    }

    const updateData = {
      ...parsed.data,
      updated_at: new Date().toISOString(),
    };
    // Normalize code if being updated
    if (updateData.code) {
      updateData.code = updateData.code.toUpperCase();
    }

    const { data, error } = await supabase
      .from("pos_discounts")
      .update(updateData)
      .eq("id", discountId)
      .eq("merchant_id", auth.sub)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ discount: data }, { headers });
  } catch (err) {
    console.error("Error updating discount:", err);
    return NextResponse.json(
      { error: "Failed to update discount" },
      { status: 500, headers }
    );
  }
}

// DELETE /api/discounts?id=<uuid> — Soft-delete a discount
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

  const discountId = new URL(request.url).searchParams.get("id");
  if (!discountId) {
    return NextResponse.json(
      { error: "Missing discount id" },
      { status: 400, headers }
    );
  }

  try {
    const { error } = await supabase
      .from("pos_discounts")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", discountId)
      .eq("merchant_id", auth.sub);

    if (error) throw error;

    return NextResponse.json({ success: true }, { headers });
  } catch (err) {
    console.error("Error deleting discount:", err);
    return NextResponse.json(
      { error: "Failed to delete discount" },
      { status: 500, headers }
    );
  }
}
