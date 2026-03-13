import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { corsHeaders, handleCORS } from "@/lib/cors";
import { supabase } from "@/lib/supabase";

export async function OPTIONS(request: NextRequest) {
  return handleCORS(request) || NextResponse.json({});
}

// GET /api/suppliers — List suppliers for merchant
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
    const { data, error } = await supabase
      .from("pos_suppliers")
      .select("*")
      .eq("merchant_id", auth.sub)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Get total orders and spent per supplier
    const suppliersWithStats = await Promise.all(
      (data || []).map(async (supplier) => {
        const { data: orders, error: orderErr } = await supabase
          .from("pos_purchase_orders")
          .select("id, total_amount, status")
          .eq("supplier_id", supplier.id)
          .eq("merchant_id", auth.sub);

        const totalOrders = orders?.length || 0;
        const totalSpent =
          orders
            ?.filter((o) => o.status !== "cancelled")
            .reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;

        return { ...supplier, total_orders: totalOrders, total_spent: totalSpent };
      })
    );

    return NextResponse.json(
      { suppliers: suppliersWithStats },
      { headers }
    );
  } catch (err) {
    console.error("Error fetching suppliers:", err);
    return NextResponse.json(
      { error: "Failed to fetch suppliers" },
      { status: 500, headers }
    );
  }
}

// POST /api/suppliers — Create a supplier
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

    if (!body.name?.trim()) {
      return NextResponse.json(
        { error: "Supplier name is required" },
        { status: 400, headers }
      );
    }

    const insertData: Record<string, unknown> = {
      merchant_id: auth.sub,
      name: body.name.trim(),
    };

    if (body.contact_name) insertData.contact_name = body.contact_name;
    if (body.email) insertData.email = body.email;
    if (body.phone) insertData.phone = body.phone;
    if (body.address) insertData.address = body.address;
    if (body.payment_terms) insertData.payment_terms = body.payment_terms;
    if (body.notes) insertData.notes = body.notes;

    const { data, error } = await supabase
      .from("pos_suppliers")
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(
      { supplier: { ...data, total_orders: 0, total_spent: 0 } },
      { status: 201, headers }
    );
  } catch (err) {
    console.error("Error creating supplier:", err);
    return NextResponse.json(
      { error: "Failed to create supplier" },
      { status: 500, headers }
    );
  }
}

// PUT /api/suppliers?id=<uuid> — Update a supplier
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

  const supplierId = new URL(request.url).searchParams.get("id");
  if (!supplierId) {
    return NextResponse.json(
      { error: "Missing supplier id" },
      { status: 400, headers }
    );
  }

  try {
    const body = await request.json();
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) updateData.name = body.name;
    if (body.contact_name !== undefined)
      updateData.contact_name = body.contact_name;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.address !== undefined) updateData.address = body.address;
    if (body.payment_terms !== undefined)
      updateData.payment_terms = body.payment_terms;
    if (body.notes !== undefined) updateData.notes = body.notes;

    const { data, error } = await supabase
      .from("pos_suppliers")
      .update(updateData)
      .eq("id", supplierId)
      .eq("merchant_id", auth.sub)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ supplier: data }, { headers });
  } catch (err) {
    console.error("Error updating supplier:", err);
    return NextResponse.json(
      { error: "Failed to update supplier" },
      { status: 500, headers }
    );
  }
}

// DELETE /api/suppliers?id=<uuid> — Delete a supplier
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

  const supplierId = new URL(request.url).searchParams.get("id");
  if (!supplierId) {
    return NextResponse.json(
      { error: "Missing supplier id" },
      { status: 400, headers }
    );
  }

  try {
    const { error } = await supabase
      .from("pos_suppliers")
      .delete()
      .eq("id", supplierId)
      .eq("merchant_id", auth.sub);

    if (error) throw error;

    return NextResponse.json({ success: true }, { headers });
  } catch (err) {
    console.error("Error deleting supplier:", err);
    return NextResponse.json(
      { error: "Failed to delete supplier" },
      { status: 500, headers }
    );
  }
}
