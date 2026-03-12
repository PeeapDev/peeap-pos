import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { corsHeaders, handleCORS } from "@/lib/cors";
import { supabase } from "@/lib/supabase";
import { createCustomerSchema, updateCustomerSchema } from "@/lib/validation";

export async function OPTIONS(request: NextRequest) {
  return handleCORS(request) || NextResponse.json({});
}

// GET /api/customers — List customers for authenticated merchant
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
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "100"),
      500
    );
    const offset = parseInt(searchParams.get("offset") || "0");
    const search = searchParams.get("search");

    let query = supabase
      .from("pos_customers")
      .select("*", { count: "exact" })
      .eq("merchant_id", auth.sub)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(
        `name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`
      );
    }

    const { data, error, count } = await query;
    if (error) throw error;

    return NextResponse.json(
      { customers: data || [], total: count || 0 },
      { headers }
    );
  } catch (err) {
    console.error("Error fetching customers:", err);
    return NextResponse.json(
      { error: "Failed to fetch customers" },
      { status: 500, headers }
    );
  }
}

// POST /api/customers — Create a customer
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
    const parsed = createCustomerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400, headers }
      );
    }

    const { data, error } = await supabase
      .from("pos_customers")
      .insert({ ...parsed.data, merchant_id: auth.sub })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ customer: data }, { status: 201, headers });
  } catch (err) {
    console.error("Error creating customer:", err);
    return NextResponse.json(
      { error: "Failed to create customer" },
      { status: 500, headers }
    );
  }
}

// PUT /api/customers?id=<uuid> — Update a customer
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

  const customerId = new URL(request.url).searchParams.get("id");
  if (!customerId) {
    return NextResponse.json(
      { error: "Missing customer id" },
      { status: 400, headers }
    );
  }

  try {
    const body = await request.json();
    const parsed = updateCustomerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400, headers }
      );
    }

    const { data, error } = await supabase
      .from("pos_customers")
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq("id", customerId)
      .eq("merchant_id", auth.sub)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ customer: data }, { headers });
  } catch (err) {
    console.error("Error updating customer:", err);
    return NextResponse.json(
      { error: "Failed to update customer" },
      { status: 500, headers }
    );
  }
}

// DELETE /api/customers?id=<uuid> — Soft-delete a customer
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

  const customerId = new URL(request.url).searchParams.get("id");
  if (!customerId) {
    return NextResponse.json(
      { error: "Missing customer id" },
      { status: 400, headers }
    );
  }

  try {
    const { error } = await supabase
      .from("pos_customers")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", customerId)
      .eq("merchant_id", auth.sub);

    if (error) throw error;

    return NextResponse.json({ success: true }, { headers });
  } catch (err) {
    console.error("Error deleting customer:", err);
    return NextResponse.json(
      { error: "Failed to delete customer" },
      { status: 500, headers }
    );
  }
}
