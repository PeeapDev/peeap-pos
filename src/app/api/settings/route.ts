import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { corsHeaders, handleCORS } from "@/lib/cors";
import { supabase } from "@/lib/supabase";
import { updateSettingsSchema } from "@/lib/validation";

export async function OPTIONS(request: NextRequest) {
  return handleCORS(request) || NextResponse.json({});
}

/** Default settings returned when no record exists yet */
const DEFAULT_SETTINGS = {
  currency: "SLE",
  tax_rate: 0,
  tax_inclusive: false,
  receipt_header: "",
  receipt_footer: "",
  receipt_show_logo: true,
  low_stock_alert: true,
  low_stock_threshold: 10,
  require_customer: false,
  allow_negative_stock: false,
  auto_print_receipt: false,
  sound_enabled: true,
  theme: "system",
};

// GET /api/settings — Get POS settings for authenticated merchant
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
      .from("pos_settings")
      .select("*")
      .eq("merchant_id", auth.sub)
      .maybeSingle();

    if (error) throw error;

    // Return stored settings merged with defaults (to fill any new fields)
    const settings = data
      ? { ...DEFAULT_SETTINGS, ...data }
      : { ...DEFAULT_SETTINGS, merchant_id: auth.sub };

    return NextResponse.json({ settings }, { headers });
  } catch (err) {
    console.error("Error fetching settings:", err);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500, headers }
    );
  }
}

// PUT /api/settings — Upsert POS settings
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

  try {
    const body = await request.json();
    const parsed = updateSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400, headers }
      );
    }

    // Upsert: insert if not exists, update if exists
    const { data, error } = await supabase
      .from("pos_settings")
      .upsert(
        {
          merchant_id: auth.sub,
          ...parsed.data,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "merchant_id" }
      )
      .select()
      .single();

    if (error) throw error;

    const settings = { ...DEFAULT_SETTINGS, ...data };

    return NextResponse.json({ settings }, { headers });
  } catch (err) {
    console.error("Error updating settings:", err);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500, headers }
    );
  }
}
