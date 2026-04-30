import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const MAIN_SUPABASE_URL = process.env.MAIN_SUPABASE_URL || "https://akiecgwcxadcpqlvntmf.supabase.co";
const MAIN_SUPABASE_KEY = process.env.MAIN_SUPABASE_SERVICE_KEY || "";

/**
 * GET /api/address?user_id=xxx
 * Returns user's shipping addresses from main Peeap Supabase.
 */
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("user_id");
  if (!userId || !MAIN_SUPABASE_KEY) {
    return NextResponse.json({ addresses: [] });
  }

  try {
    const db = createClient(MAIN_SUPABASE_URL, MAIN_SUPABASE_KEY, { auth: { persistSession: false } });

    // Get from shipping_addresses table
    const { data: addresses } = await db
      .from("shipping_addresses")
      .select("id, address_line, city, country, phone, is_default, name")
      .eq("user_id", userId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    if (addresses?.length) {
      return NextResponse.json({ addresses });
    }

    // Fallback: get from user profile
    const { data: user } = await db
      .from("users")
      .select("address, city, phone, first_name, last_name")
      .eq("id", userId)
      .single();

    if (user?.address || user?.city) {
      return NextResponse.json({
        addresses: [{
          id: "profile",
          address_line: user.address || "",
          city: user.city || "",
          is_default: true,
          name: [user.first_name, user.last_name].filter(Boolean).join(" "),
          phone: user.phone || "",
        }],
      });
    }

    return NextResponse.json({ addresses: [] });
  } catch {
    return NextResponse.json({ addresses: [] });
  }
}
