import { NextRequest, NextResponse } from "next/server";
import { corsHeaders, handleCORS } from "@/lib/cors";
import { supabase } from "@/lib/supabase";
import { authenticateRequest } from "@/lib/auth";
import { z } from "zod";

export async function OPTIONS(request: NextRequest) {
  return handleCORS(request) || NextResponse.json({});
}

const cartItemSchema = z.object({
  product_id: z.string().uuid(),
  name: z.string().min(1),
  price: z.number().min(0),
  image_url: z.string().optional(),
  quantity: z.number().int().min(1),
});

const saveCartSchema = z.object({
  store_id: z.string().uuid(),
  items: z.array(cartItemSchema).min(1),
  merge: z.boolean().default(false),
});

// GET /api/cart?store_id=xxx
export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);

  const auth = await authenticateRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  }

  const storeId = request.nextUrl.searchParams.get("store_id");
  if (!storeId) {
    return NextResponse.json({ error: "store_id is required" }, { status: 400, headers });
  }

  const { data: cart } = await supabase
    .from("store_carts")
    .select("id, items, updated_at")
    .eq("user_id", auth.sub)
    .eq("store_id", storeId)
    .single();

  return NextResponse.json({ cart: cart || null }, { headers });
}

// POST /api/cart
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);

  const auth = await authenticateRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  }

  try {
    const body = await request.json();
    const parsed = saveCartSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400, headers }
      );
    }

    const { store_id, items, merge } = parsed.data;
    let finalItems = items;

    if (merge) {
      // Fetch existing cart and merge
      const { data: existing } = await supabase
        .from("store_carts")
        .select("items")
        .eq("user_id", auth.sub)
        .eq("store_id", store_id)
        .single();

      if (existing?.items && Array.isArray(existing.items)) {
        const serverMap = new Map(
          (existing.items as Array<{ product_id: string }>).map((i) => [i.product_id, i])
        );
        // Server items take priority; add new items from request
        for (const item of items) {
          if (!serverMap.has(item.product_id)) {
            serverMap.set(item.product_id, item);
          }
        }
        finalItems = Array.from(serverMap.values()) as typeof items;
      }
    }

    const { data: cart, error } = await supabase
      .from("store_carts")
      .upsert(
        {
          user_id: auth.sub,
          store_id,
          items: finalItems,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,store_id" }
      )
      .select("id, items, updated_at")
      .single();

    if (error) throw error;

    return NextResponse.json({ cart }, { headers });
  } catch (err) {
    console.error("[Cart] POST error:", err);
    return NextResponse.json(
      { error: "Failed to save cart" },
      { status: 500, headers }
    );
  }
}

// DELETE /api/cart?store_id=xxx
export async function DELETE(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);

  const auth = await authenticateRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  }

  const storeId = request.nextUrl.searchParams.get("store_id");
  if (!storeId) {
    return NextResponse.json({ error: "store_id is required" }, { status: 400, headers });
  }

  await supabase
    .from("store_carts")
    .delete()
    .eq("user_id", auth.sub)
    .eq("store_id", storeId);

  return NextResponse.json({ success: true }, { headers });
}
