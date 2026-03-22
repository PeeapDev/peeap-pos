import { NextRequest, NextResponse } from "next/server";
import { corsHeaders, handleCORS } from "@/lib/cors";
import { supabase } from "@/lib/supabase";

export async function OPTIONS(request: NextRequest) {
  return handleCORS(request) || NextResponse.json({});
}

// GET /api/marketplace/categories — All active marketplace categories
export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);

  try {
    const { data, error } = await supabase
      .from("marketplace_categories")
      .select("*")
      .eq("is_active", true)
      .order("sort_order");

    if (error) throw error;

    // Build tree structure (parent/child)
    const categories = data || [];
    const topLevel = categories.filter((c) => !c.parent_id);
    const childMap = new Map<string, typeof categories>();
    for (const cat of categories) {
      if (cat.parent_id) {
        const existing = childMap.get(cat.parent_id) || [];
        existing.push(cat);
        childMap.set(cat.parent_id, existing);
      }
    }

    const tree = topLevel.map((cat) => ({
      ...cat,
      children: childMap.get(cat.id) || [],
    }));

    return NextResponse.json({ categories: tree }, { headers });
  } catch (err) {
    console.error("Error fetching categories:", err);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500, headers }
    );
  }
}
