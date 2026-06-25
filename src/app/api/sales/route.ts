import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { corsHeaders, handleCORS } from "@/lib/cors";
import { supabase } from "@/lib/supabase";
import { createSaleSchema } from "@/lib/validation";
import { creditWallet } from "@/lib/api-client";

export async function OPTIONS(request: NextRequest) {
  return handleCORS(request) || NextResponse.json({});
}

// GET /api/sales — List sales for authenticated merchant
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
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
    const offset = parseInt(searchParams.get("offset") || "0");
    const status = searchParams.get("status");
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");
    const paymentMethod = searchParams.get("payment_method");
    const kitchen = searchParams.get("kitchen");

    // Kitchen display mode: return orders needing kitchen attention
    if (kitchen === "true") {
      const { data, error } = await supabase
        .from("pos_sales")
        .select("*, items:pos_sale_items(*)")
        .eq("merchant_id", auth.sub)
        .neq("kitchen_status", "completed")
        .order("created_at", { ascending: true });

      if (error) throw error;

      return NextResponse.json(
        { sales: data || [], total: (data || []).length },
        { headers }
      );
    }

    let query = supabase
      .from("pos_sales")
      .select("*, items:pos_sale_items(*)", { count: "exact" })
      .eq("merchant_id", auth.sub)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq("status", status);
    }
    if (startDate) {
      query = query.gte("created_at", startDate);
    }
    if (endDate) {
      query = query.lte("created_at", endDate);
    }
    if (paymentMethod) {
      query = query.eq("payment_method", paymentMethod);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    return NextResponse.json(
      { sales: data || [], total: count || 0 },
      { headers }
    );
  } catch (err) {
    console.error("Error fetching sales:", err);
    return NextResponse.json(
      { error: "Failed to fetch sales" },
      { status: 500, headers }
    );
  }
}

// PUT /api/sales?id=<uuid> — Update a sale (kitchen_status, etc.)
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

  const saleId = new URL(request.url).searchParams.get("id");
  if (!saleId) {
    return NextResponse.json(
      { error: "Missing sale id" },
      { status: 400, headers }
    );
  }

  try {
    const body = await request.json();
    const allowedFields: Record<string, unknown> = {};

    // Only allow updating specific fields
    if (body.kitchen_status) {
      const validStatuses = ["new", "preparing", "ready", "completed"];
      if (!validStatuses.includes(body.kitchen_status)) {
        return NextResponse.json(
          { error: "Invalid kitchen_status" },
          { status: 400, headers }
        );
      }
      allowedFields.kitchen_status = body.kitchen_status;
    }

    if (body.status) {
      allowedFields.status = body.status;
    }

    if (body.notes !== undefined) {
      allowedFields.notes = body.notes;
    }

    allowedFields.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("pos_sales")
      .update(allowedFields)
      .eq("id", saleId)
      .eq("merchant_id", auth.sub)
      .select("*, items:pos_sale_items(*)")
      .single();

    if (error) throw error;

    return NextResponse.json({ sale: data }, { headers });
  } catch (err) {
    console.error("Error updating sale:", err);
    return NextResponse.json(
      { error: "Failed to update sale" },
      { status: 500, headers }
    );
  }
}

// POST /api/sales — Create a sale
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
    const parsed = createSaleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400, headers }
      );
    }

    const { items, client_sale_id, ...saleData } = parsed.data;

    // Treat a Postgres "column does not exist" as the client_sale_id column not
    // being deployed yet — degrade to non-idempotent behaviour rather than break
    // sales (safe whatever the migration order).
    const isMissingClientCol = (e: any) =>
      e &&
      (e.code === "42703" ||
        e.code === "PGRST204" ||
        /client_sale_id/i.test(e.message || "") ||
        /client_sale_id/i.test(e.details || ""));

    // Exactly-once: if this client_sale_id was already recorded for this merchant,
    // return the existing sale WITHOUT inserting, crediting, or moving inventory.
    if (client_sale_id) {
      const { data: existing, error: lookupErr } = await supabase
        .from("pos_sales")
        .select("*, items:pos_sale_items(*)")
        .eq("merchant_id", auth.sub)
        .eq("client_sale_id", client_sale_id)
        .maybeSingle();
      if (existing) {
        return NextResponse.json(
          { sale: existing, idempotent: true },
          { status: 200, headers }
        );
      }
      if (lookupErr && !isMissingClientCol(lookupErr)) throw lookupErr;
    }

    // Generate sale number
    const { count } = await supabase
      .from("pos_sales")
      .select("id", { count: "exact", head: true })
      .eq("merchant_id", auth.sub);

    const saleNumber = `S${String((count || 0) + 1).padStart(6, "0")}`;

    // Insert sale (with client_sale_id when provided)
    let { data: sale, error: saleError } = await supabase
      .from("pos_sales")
      .insert({
        ...saleData,
        ...(client_sale_id ? { client_sale_id } : {}),
        merchant_id: auth.sub,
        sale_number: saleNumber,
        status: "completed",
      })
      .select()
      .single();

    // Concurrent double-submit: the unique (merchant_id, client_sale_id) index
    // rejected this insert because the twin request already created the sale —
    // return that one instead of a duplicate.
    if (saleError && (saleError as any).code === "23505" && client_sale_id) {
      const { data: existing } = await supabase
        .from("pos_sales")
        .select("*, items:pos_sale_items(*)")
        .eq("merchant_id", auth.sub)
        .eq("client_sale_id", client_sale_id)
        .maybeSingle();
      if (existing) {
        return NextResponse.json(
          { sale: existing, idempotent: true },
          { status: 200, headers }
        );
      }
    }

    // Column not deployed yet: retry without client_sale_id so sales still record.
    if (saleError && isMissingClientCol(saleError) && client_sale_id) {
      ({ data: sale, error: saleError } = await supabase
        .from("pos_sales")
        .insert({
          ...saleData,
          merchant_id: auth.sub,
          sale_number: saleNumber,
          status: "completed",
        })
        .select()
        .single());
    }

    if (saleError) throw saleError;

    // Insert sale items
    const saleItems = items.map((item) => ({
      ...item,
      sale_id: sale.id,
    }));

    const { error: itemsError } = await supabase
      .from("pos_sale_items")
      .insert(saleItems);

    if (itemsError) {
      // Rollback: delete the sale
      await supabase.from("pos_sales").delete().eq("id", sale.id);
      throw itemsError;
    }

    // Update inventory for tracked products
    for (const item of items) {
      if (item.product_id) {
        const { data: product } = await supabase
          .from("pos_products")
          .select("track_inventory, stock_quantity")
          .eq("id", item.product_id)
          .single();

        if (product?.track_inventory) {
          const newQty = (product.stock_quantity || 0) - item.quantity;
          await supabase
            .from("pos_products")
            .update({
              stock_quantity: Math.max(0, newQty),
              updated_at: new Date().toISOString(),
            })
            .eq("id", item.product_id);

          // Log inventory change
          await supabase.from("pos_inventory_log").insert({
            merchant_id: auth.sub,
            product_id: item.product_id,
            type: "sale",
            quantity_change: -item.quantity,
            previous_quantity: product.stock_quantity,
            new_quantity: Math.max(0, newQty),
            reference_id: sale.id,
          });
        }
      }
    }

    // Credit merchant wallet via api.peeap.com. Cash stays physical (the drawer),
    // so only digital payment methods credit the wallet — matching the POS terminal.
    if (saleData.total_amount > 0 && saleData.payment_method !== "cash") {
      const walletResult = await creditWallet(
        auth.sub,
        saleData.total_amount,
        `POS Sale ${saleNumber}`,
        // Stable reference so the credit dedupes on the client id, not the per-
        // request sale.id — a retry that somehow reached here won't double-credit.
        client_sale_id || sale.id
      );
      if (walletResult.error) {
        // Surface loudly for reconciliation — the sale recorded but the wallet
        // was not credited; this needs a retry/sweep, not a silent swallow.
        console.error(
          `[POS SALE WALLET CREDIT FAILED] sale=${sale.id} client_sale_id=${client_sale_id || "-"} merchant=${auth.sub} amount=${saleData.total_amount}:`,
          walletResult.error
        );
      }
    }

    // Return sale with items
    const { data: completeSale } = await supabase
      .from("pos_sales")
      .select("*, items:pos_sale_items(*)")
      .eq("id", sale.id)
      .single();

    return NextResponse.json(
      { sale: completeSale },
      { status: 201, headers }
    );
  } catch (err) {
    console.error("Error creating sale:", err);
    return NextResponse.json(
      { error: "Failed to create sale" },
      { status: 500, headers }
    );
  }
}
