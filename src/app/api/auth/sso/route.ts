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
 * POST /api/auth/sso { token }
 *
 * Validates an SSO token from my.peeap.com and returns the user data.
 * This is the store's SSO callback handler.
 *
 * Flow:
 * Receives a short-lived handoff from the same-site my.peeap.com bridge and
 * exchanges it for a store session. The token never enters an API URL.
 */
async function exchange(token: string | null) {

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

    if (!["store", "external"].includes(ssoToken.target_app)) {
      return NextResponse.json({ error: "Token is not for the store" }, { status: 401 });
    }

    // Mark token as used (one-time use)
    const { data: redeemed, error: redeemError } = await supabase
      .from("sso_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", ssoToken.id)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .select("id")
      .maybeSingle();
    if (redeemError || !redeemed) {
      return NextResponse.json({ error: "SSO token already used or expired" }, { status: 401 });
    }

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

    // Create a persistent session token for store API calls
    const sessionToken = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, '');
    const { error: sessionError } = await supabase.from('sso_tokens').insert({
      user_id: user.id,
      token: sessionToken,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      redirect_path: '/store-session',
    });
    if (sessionError) {
      console.error("[SSO] Could not create store session:", sessionError.message);
      return NextResponse.json({ error: "Could not establish session" }, { status: 503 });
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
      token: sessionToken,
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

// Handoff tokens must not appear in browser URLs, referrers, or access logs.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  return exchange(typeof body.token === "string" ? body.token : null);
}
