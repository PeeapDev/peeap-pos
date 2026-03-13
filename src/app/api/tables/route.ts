import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { corsHeaders, handleCORS } from "@/lib/cors";
import { supabase } from "@/lib/supabase";

export async function OPTIONS(request: NextRequest) {
  return handleCORS(request) || NextResponse.json({});
}

// GET /api/tables — List tables with sections for merchant
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
    // Fetch sections
    const { data: sections, error: secError } = await supabase
      .from("pos_table_sections")
      .select("*")
      .eq("merchant_id", auth.sub)
      .order("sort_order", { ascending: true });

    if (secError) throw secError;

    // Fetch tables
    const { data: tables, error: tabError } = await supabase
      .from("pos_tables")
      .select("*")
      .eq("merchant_id", auth.sub)
      .order("table_number", { ascending: true });

    if (tabError) throw tabError;

    return NextResponse.json(
      { sections: sections || [], tables: tables || [] },
      { headers }
    );
  } catch (err) {
    console.error("Error fetching tables:", err);
    return NextResponse.json(
      { error: "Failed to fetch tables" },
      { status: 500, headers }
    );
  }
}

// POST /api/tables — Create a table or section
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
    const entityType = body.type; // "table" or "section"

    if (entityType === "section") {
      if (!body.name?.trim()) {
        return NextResponse.json(
          { error: "Section name is required" },
          { status: 400, headers }
        );
      }

      const { data, error } = await supabase
        .from("pos_table_sections")
        .insert({
          merchant_id: auth.sub,
          name: body.name.trim(),
          description: body.description || null,
          sort_order: body.sort_order || 0,
        })
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json(
        { section: data },
        { status: 201, headers }
      );
    }

    // Default: create table
    if (!body.table_number) {
      return NextResponse.json(
        { error: "Table number is required" },
        { status: 400, headers }
      );
    }

    // Check for duplicate table number
    const { data: existing } = await supabase
      .from("pos_tables")
      .select("id")
      .eq("merchant_id", auth.sub)
      .eq("table_number", body.table_number)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "A table with this number already exists" },
        { status: 409, headers }
      );
    }

    const { data, error } = await supabase
      .from("pos_tables")
      .insert({
        merchant_id: auth.sub,
        table_number: body.table_number,
        capacity: body.capacity || 4,
        section_id: body.section_id || null,
        shape: body.shape || "square",
        status: "available",
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ table: data }, { status: 201, headers });
  } catch (err) {
    console.error("Error creating table/section:", err);
    return NextResponse.json(
      { error: "Failed to create" },
      { status: 500, headers }
    );
  }
}

// PUT /api/tables?id=<uuid> — Update table or section
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
  const id = searchParams.get("id");
  const entityType = searchParams.get("type") || "table";

  if (!id) {
    return NextResponse.json(
      { error: "Missing id" },
      { status: 400, headers }
    );
  }

  try {
    const body = await request.json();

    if (entityType === "section") {
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (body.name !== undefined) updateData.name = body.name;
      if (body.description !== undefined)
        updateData.description = body.description;
      if (body.sort_order !== undefined)
        updateData.sort_order = body.sort_order;

      const { data, error } = await supabase
        .from("pos_table_sections")
        .update(updateData)
        .eq("id", id)
        .eq("merchant_id", auth.sub)
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({ section: data }, { headers });
    }

    // Default: update table
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.table_number !== undefined)
      updateData.table_number = body.table_number;
    if (body.capacity !== undefined) updateData.capacity = body.capacity;
    if (body.section_id !== undefined) updateData.section_id = body.section_id;
    if (body.shape !== undefined) updateData.shape = body.shape;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.current_order_id !== undefined)
      updateData.current_order_id = body.current_order_id;
    if (body.current_guests !== undefined)
      updateData.current_guests = body.current_guests;

    const { data, error } = await supabase
      .from("pos_tables")
      .update(updateData)
      .eq("id", id)
      .eq("merchant_id", auth.sub)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ table: data }, { headers });
  } catch (err) {
    console.error("Error updating table/section:", err);
    return NextResponse.json(
      { error: "Failed to update" },
      { status: 500, headers }
    );
  }
}

// DELETE /api/tables?id=<uuid>&type=table|section
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
  const id = searchParams.get("id");
  const entityType = searchParams.get("type") || "table";

  if (!id) {
    return NextResponse.json(
      { error: "Missing id" },
      { status: 400, headers }
    );
  }

  try {
    const table = entityType === "section" ? "pos_table_sections" : "pos_tables";

    const { error } = await supabase
      .from(table)
      .delete()
      .eq("id", id)
      .eq("merchant_id", auth.sub);

    if (error) throw error;

    return NextResponse.json({ success: true }, { headers });
  } catch (err) {
    console.error("Error deleting table/section:", err);
    return NextResponse.json(
      { error: "Failed to delete" },
      { status: 500, headers }
    );
  }
}
