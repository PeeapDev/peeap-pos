/**
 * Vendor-facing endpoints for the POS plugin's device roster.
 *
 *   GET  /api/vendor/pos/devices                         — list devices the vendor's store owns
 *   POST /api/vendor/pos/devices  { device_sn, label }   — assign an unowned HEMI to this store
 *
 * Auth: vendor session token (validated against Card sso_tokens via
 * authenticateRequest). The caller's user_id is matched to stores.merchant_id
 * to find the store; only the store's owner can assign devices in the
 * baseline flow. (Manager/cashier roles can be allowed later via store_staff
 * lookups, but the initial POS-tab UX is owner-only.)
 *
 * Cross-DB: store_devices and stores both live in the POS Supabase, so this
 * is a single-db operation. No call to Card.
 */
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { corsHeaders, handleCORS } from "@/lib/cors";
import { supabase } from "@/lib/supabase";

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

export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);
  const auth = await authenticateRequest(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });

  const store = await getOwnedStore(auth.sub);
  if (!store) {
    return NextResponse.json({ error: "no_store" }, { status: 404, headers });
  }

  const { data, error } = await supabase
    .from("store_devices")
    .select("device_sn, model, profile, terminal_label, status, claimed_by_user_id, claimed_at, last_seen_at, last_synced_at, cloud_state, created_at")
    .eq("owner_store_id", store.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers });
  }
  return NextResponse.json({ store_id: store.id, devices: data || [] }, { headers });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);
  const auth = await authenticateRequest(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });

  const store = await getOwnedStore(auth.sub);
  if (!store) {
    return NextResponse.json({ error: "no_store" }, { status: 404, headers });
  }

  const body = await request.json().catch(() => ({}));
  const deviceSn = String(body.device_sn || "").trim();
  const label = body.terminal_label ? String(body.terminal_label).slice(0, 40) : null;
  if (!deviceSn || deviceSn.length < 4) {
    return NextResponse.json({ error: "device_sn_required" }, { status: 400, headers });
  }

  // Find the device. Refuses to assign if already owned by anyone — owner has
  // to disconnect the previous claim first. This prevents an owner from
  // silently snatching another vendor's device by typing its SN.
  const { data: device } = await supabase
    .from("store_devices")
    .select("id, device_sn, owner_user_id, owner_store_id, status")
    .eq("device_sn", deviceSn)
    .maybeSingle();

  if (!device) {
    return NextResponse.json(
      { error: "device_not_in_inventory", message: "We don't recognise that SN. Power the device on and connect it to WiFi so it auto-imports, then try again." },
      { status: 404, headers }
    );
  }
  if ((device as any).status !== "active") {
    return NextResponse.json({ error: "device_disabled" }, { status: 403, headers });
  }
  if ((device as any).owner_user_id || (device as any).owner_store_id) {
    return NextResponse.json(
      { error: "device_already_owned", message: "This device is already paired with another account or store. Disconnect it from the previous owner first." },
      { status: 409, headers }
    );
  }

  const { data: assigned, error } = await supabase
    .from("store_devices")
    .update({
      owner_store_id: store.id,
      terminal_label: label,
      claimed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", (device as any).id)
    .select("device_sn, terminal_label, owner_store_id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers });
  }

  // Auto-add the store owner as 'owner' role in store_staff so they pass
  // the claim-flow gate when scanning the device themselves.
  await supabase
    .from("store_staff")
    .upsert(
      {
        store_id: store.id,
        user_id: auth.sub,
        role: "owner",
        status: "approved",
        invited_via: "self_owner",
        joined_at: new Date().toISOString(),
      },
      { onConflict: "store_id,user_id" }
    );

  return NextResponse.json({ ok: true, device: assigned }, { headers });
}
