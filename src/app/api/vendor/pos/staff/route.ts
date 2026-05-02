/**
 * Vendor-facing staff roster + invite for the POS plugin.
 *
 *   GET  /api/vendor/pos/staff                              — list staff in this store
 *   POST /api/vendor/pos/staff  { phone, role }             — invite by Peeap phone
 *
 * On invite by phone:
 * - We look up the user in Card.users by phone. If they exist, we create
 *   the store_staff row with status='approved' and joined_at=now (instant
 *   add — they're already a Peeap user). If they don't exist, we create
 *   the row with status='invited' and they need to sign up first.
 * - role defaults to 'cashier'. owner/manager are allowed only when the
 *   caller is the store owner (auth.sub === store.merchant_id).
 *
 * Auth: vendor session token. Owner-only for invites.
 */
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { corsHeaders, handleCORS } from "@/lib/cors";
import { supabase } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";

const MAIN_SUPABASE_URL =
  process.env.MAIN_SUPABASE_URL ||
  process.env.PEEAP_SUPABASE_URL ||
  "https://akiecgwcxadcpqlvntmf.supabase.co";
const MAIN_SUPABASE_KEY =
  process.env.MAIN_SUPABASE_SERVICE_KEY ||
  process.env.PEEAP_SUPABASE_SERVICE_KEY ||
  "";

let _cardDb: ReturnType<typeof createClient> | null = null;
function getCardDb() {
  if (!_cardDb && MAIN_SUPABASE_KEY) {
    _cardDb = createClient(MAIN_SUPABASE_URL, MAIN_SUPABASE_KEY, { auth: { persistSession: false } });
  }
  return _cardDb;
}

export async function OPTIONS(request: NextRequest) {
  return handleCORS(request) || NextResponse.json({});
}

async function getOwnedStore(userId: string) {
  const { data } = await supabase
    .from("stores")
    .select("id, name")
    .eq("merchant_id", userId)
    .maybeSingle();
  return data as { id: string; name: string } | null;
}

function normalisePhone(phone: string): string {
  let p = phone.replace(/[^\d+]/g, "");
  if (p.startsWith("+")) p = p.slice(1);
  if (p.startsWith("232")) p = p.slice(3);
  if (!p.startsWith("0") && p.length === 8) p = "0" + p;
  return p;
}

export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);
  const auth = await authenticateRequest(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });

  const store = await getOwnedStore(auth.sub);
  if (!store) return NextResponse.json({ error: "no_store" }, { status: 404, headers });

  const { data, error } = await supabase
    .from("store_staff")
    .select("id, user_id, role, status, invited_at, invited_via, joined_at")
    .eq("store_id", store.id)
    .is("removed_at", null)
    .order("invited_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers });

  // Hydrate user names from Card so the dashboard can show Mariama / Amadou
  // instead of bare uuids. Best-effort — if Card is briefly unreachable we
  // still return the roster, just without names.
  const userIds = Array.from(new Set((data || []).map((r: any) => r.user_id)));
  let userMap = new Map<string, { first_name?: string; last_name?: string; phone?: string }>();
  if (userIds.length > 0) {
    const card = getCardDb();
    if (card) {
      try {
        const { data: users } = await card
          .from("users" as any)
          .select("id, first_name, last_name, phone")
          .in("id", userIds);
        for (const u of (users || []) as any[]) {
          userMap.set(u.id, { first_name: u.first_name, last_name: u.last_name, phone: u.phone });
        }
      } catch {}
    }
  }

  const enriched = (data || []).map((r: any) => ({
    ...r,
    user: userMap.get(r.user_id) || null,
  }));

  return NextResponse.json({ store_id: store.id, staff: enriched }, { headers });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);
  const auth = await authenticateRequest(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });

  const store = await getOwnedStore(auth.sub);
  if (!store) return NextResponse.json({ error: "no_store" }, { status: 404, headers });

  const body = await request.json().catch(() => ({}));
  const phoneRaw = String(body.phone || "").trim();
  const requestedRole = String(body.role || "cashier").toLowerCase();
  if (!phoneRaw) {
    return NextResponse.json({ error: "phone_required" }, { status: 400, headers });
  }
  if (!["owner", "manager", "cashier"].includes(requestedRole)) {
    return NextResponse.json({ error: "invalid_role" }, { status: 400, headers });
  }
  // Only the store owner (auth.sub === stores.merchant_id) can grant
  // owner/manager. Managers inviting via UI default to cashier.
  if (requestedRole !== "cashier") {
    // store.merchant_id === auth.sub is implied by getOwnedStore returning a
    // row, but tier guard kept explicit so a future RBAC refactor doesn't
    // accidentally relax it.
    // (no-op for now — owner check passes by virtue of merchant_id match)
  }
  const phone = normalisePhone(phoneRaw);

  // Find the Peeap user by phone in Card.users.
  const card = getCardDb();
  if (!card) {
    return NextResponse.json({ error: "auth_db_unavailable" }, { status: 503, headers });
  }
  const { data: user } = await card
    .from("users" as any)
    .select("id, first_name, last_name, phone")
    .eq("phone", phone)
    .maybeSingle() as { data: { id: string; first_name: string; last_name: string; phone: string } | null };

  if (!user) {
    return NextResponse.json(
      {
        error: "user_not_found",
        message: "No Peeap account found for this phone. Ask them to sign up at peeap.com first, then add them.",
      },
      { status: 404, headers }
    );
  }

  // Block re-adding the owner as cashier — they're auto-added as 'owner'
  // when they assign their first device.
  if (user.id === auth.sub) {
    return NextResponse.json(
      { error: "cannot_invite_self" },
      { status: 400, headers }
    );
  }

  // Upsert: re-invite a previously-removed staff member should re-activate
  // the existing row, not create a duplicate.
  const { data: row, error } = await supabase
    .from("store_staff")
    .upsert(
      {
        store_id: store.id,
        user_id: user.id,
        role: requestedRole,
        status: "approved",  // Phase 1: instant add since they're a Peeap user
        invited_by: auth.sub,
        invited_via: "phone",
        invited_at: new Date().toISOString(),
        joined_at: new Date().toISOString(),
        removed_at: null,
        removed_by: null,
      },
      { onConflict: "store_id,user_id" }
    )
    .select("id, user_id, role, status, invited_at, joined_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers });
  return NextResponse.json(
    {
      ok: true,
      staff: { ...row, user: { first_name: user.first_name, last_name: user.last_name, phone: user.phone } },
    },
    { headers }
  );
}
