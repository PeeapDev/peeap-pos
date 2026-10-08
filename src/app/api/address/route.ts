import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authenticateRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MAIN_SUPABASE_URL = process.env.MAIN_SUPABASE_URL || "https://akiecgwcxadcpqlvntmf.supabase.co";
const MAIN_SUPABASE_KEY = process.env.MAIN_SUPABASE_SERVICE_KEY || "";

/**
 * GET /api/address?user_id=xxx
 * Returns user's shipping addresses from main Peeap Supabase.
 */
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("user_id");
  if (!userId) return NextResponse.json({ error: "user_id required" }, { status: 400 });
  const auth = await authenticateRequest(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.sub !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!MAIN_SUPABASE_KEY) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  try {
    const db = createClient(MAIN_SUPABASE_URL, MAIN_SUPABASE_KEY, { auth: { persistSession: false } });

    // Get from shipping_addresses table
    const { data: addresses, error } = await db
      .from("shipping_addresses")
      .select("id, address_line1, address_line2, city, country, phone, is_default, full_name")
      .eq("user_id", userId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ addresses: (addresses || []).map((address) => ({
      id: address.id,
      address_line: [address.address_line1, address.address_line2].filter(Boolean).join(", "),
      city: address.city,
      country: address.country,
      phone: address.phone,
      is_default: address.is_default,
      name: address.full_name,
    })) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not load delivery addresses" }, { status: 503 });
  }
}

/** Save a delivery address under the authenticated customer, not a supplied user ID. */
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!MAIN_SUPABASE_KEY) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const body = await request.json().catch(() => ({}));
  const fullName = String(body.full_name || "").trim();
  const phone = String(body.phone || "").trim();
  const addressLine = String(body.address_line || "").trim();
  const city = String(body.city || "").trim();
  if (!fullName || !phone || !addressLine || !city ||
      fullName.length > 255 || phone.length > 50 || addressLine.length > 500 || city.length > 100) {
    return NextResponse.json({ error: "Name, phone, street address and city are required" }, { status: 400 });
  }
  try {
    const db = createClient(MAIN_SUPABASE_URL, MAIN_SUPABASE_KEY, { auth: { persistSession: false } });
    const { data, error } = await db.from("shipping_addresses").insert({
      user_id: auth.sub,
      full_name: fullName,
      phone,
      address_line1: addressLine,
      city,
      country: "Sierra Leone",
      is_default: false,
    }).select("id, address_line1, city, phone, is_default, full_name").single();
    if (error || !data) throw error;
    return NextResponse.json({ address: {
      id: data.id,
      address_line: data.address_line1,
      city: data.city,
      phone: data.phone,
      is_default: data.is_default,
      name: data.full_name,
    } }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not save delivery address" }, { status: 503 });
  }
}
