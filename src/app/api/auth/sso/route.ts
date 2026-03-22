import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// SSO tokens live in the MAIN Peeap Supabase, not the POS Supabase
const MAIN_SUPABASE_URL = process.env.MAIN_SUPABASE_URL || process.env.PEEAP_SUPABASE_URL || "https://akiecgwcxadcpqlvntmf.supabase.co";
const MAIN_SUPABASE_KEY = process.env.MAIN_SUPABASE_SERVICE_KEY || process.env.PEEAP_SUPABASE_SERVICE_KEY || "";

function getMainSupabase() {
  return createClient(MAIN_SUPABASE_URL, MAIN_SUPABASE_KEY, {
    auth: { persistSession: false },
  });
}

/**
 * GET /api/auth/sso?token=xxx
 *
 * Validates an SSO token from my.peeap.com and returns the user data.
 * This is the store's SSO callback handler.
 *
 * Flow:
 * 1. User clicks "Login" on store → redirected to my.peeap.com/login
 * 2. User logs in → my.peeap.com creates SSO token + redirects back to store
 * 3. Store calls this endpoint to validate the token and get user info
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json(
      { error: "No token provided" },
      { status: 400 }
    );
  }

  if (!MAIN_SUPABASE_KEY) {
    console.error("[SSO] Missing MAIN_SUPABASE_SERVICE_KEY");
    return NextResponse.json(
      { error: "SSO not configured" },
      { status: 500 }
    );
  }

  try {
    const supabase = getMainSupabase();

    // Validate the SSO token
    const { data: ssoToken, error: ssoError } = await supabase
      .from("sso_tokens")
      .select("*")
      .eq("token", token)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (ssoError || !ssoToken) {
      return NextResponse.json(
        { error: "Invalid or expired SSO token" },
        { status: 401 }
      );
    }

    // Mark token as used (one-time use)
    await supabase
      .from("sso_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", ssoToken.id);

    // Fetch the user
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, email, phone, first_name, last_name, roles, is_active")
      .eq("id", ssoToken.user_id)
      .single();

    if (userError || !user || !user.is_active) {
      return NextResponse.json(
        { error: "User not found or disabled" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        first_name: user.first_name,
        last_name: user.last_name,
        roles: user.roles,
      },
      token: ssoToken.token,
      redirect_path: ssoToken.redirect_path,
    });
  } catch (err) {
    console.error("[SSO] Exchange error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
