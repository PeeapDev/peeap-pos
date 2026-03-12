import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { corsHeaders, handleCORS } from "@/lib/cors";
import { supabase } from "@/lib/supabase";
import { createStaffSchema, updateStaffSchema } from "@/lib/validation";

export async function OPTIONS(request: NextRequest) {
  return handleCORS(request) || NextResponse.json({});
}

/**
 * Simple PIN hashing using Web Crypto API (available in Edge Runtime).
 * Produces a hex-encoded SHA-256 digest with a per-merchant salt.
 */
async function hashPin(pin: string, merchantId: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${merchantId}:${pin}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// GET /api/staff — List staff for authenticated merchant
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
    const activeOnly = searchParams.get("active") !== "false";

    let query = supabase
      .from("pos_staff")
      .select("id, merchant_id, name, email, phone, role, is_active, created_at, updated_at")
      .eq("merchant_id", auth.sub)
      .order("created_at", { ascending: false });

    if (activeOnly) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ staff: data || [] }, { headers });
  } catch (err) {
    console.error("Error fetching staff:", err);
    return NextResponse.json(
      { error: "Failed to fetch staff" },
      { status: 500, headers }
    );
  }
}

// POST /api/staff — Create a staff member
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
    const parsed = createStaffSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400, headers }
      );
    }

    const { pin, ...staffData } = parsed.data;

    // Hash PIN if provided
    const insertData: Record<string, unknown> = {
      ...staffData,
      merchant_id: auth.sub,
    };
    if (pin) {
      insertData.pin_hash = await hashPin(pin, auth.sub);
    }

    const { data, error } = await supabase
      .from("pos_staff")
      .insert(insertData)
      .select("id, merchant_id, name, email, phone, role, is_active, created_at, updated_at")
      .single();

    if (error) throw error;

    return NextResponse.json({ staff: data }, { status: 201, headers });
  } catch (err) {
    console.error("Error creating staff:", err);
    return NextResponse.json(
      { error: "Failed to create staff" },
      { status: 500, headers }
    );
  }
}

// PUT /api/staff?id=<uuid> — Update a staff member
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

  const staffId = new URL(request.url).searchParams.get("id");
  if (!staffId) {
    return NextResponse.json(
      { error: "Missing staff id" },
      { status: 400, headers }
    );
  }

  try {
    const body = await request.json();
    const parsed = updateStaffSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400, headers }
      );
    }

    const { pin, ...staffData } = parsed.data;

    const updateData: Record<string, unknown> = {
      ...staffData,
      updated_at: new Date().toISOString(),
    };
    if (pin) {
      updateData.pin_hash = await hashPin(pin, auth.sub);
    }

    const { data, error } = await supabase
      .from("pos_staff")
      .update(updateData)
      .eq("id", staffId)
      .eq("merchant_id", auth.sub)
      .select("id, merchant_id, name, email, phone, role, is_active, created_at, updated_at")
      .single();

    if (error) throw error;

    return NextResponse.json({ staff: data }, { headers });
  } catch (err) {
    console.error("Error updating staff:", err);
    return NextResponse.json(
      { error: "Failed to update staff" },
      { status: 500, headers }
    );
  }
}

// DELETE /api/staff?id=<uuid> — Soft-delete a staff member
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

  const staffId = new URL(request.url).searchParams.get("id");
  if (!staffId) {
    return NextResponse.json(
      { error: "Missing staff id" },
      { status: 400, headers }
    );
  }

  try {
    const { error } = await supabase
      .from("pos_staff")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", staffId)
      .eq("merchant_id", auth.sub);

    if (error) throw error;

    return NextResponse.json({ success: true }, { headers });
  } catch (err) {
    console.error("Error deleting staff:", err);
    return NextResponse.json(
      { error: "Failed to delete staff" },
      { status: 500, headers }
    );
  }
}
