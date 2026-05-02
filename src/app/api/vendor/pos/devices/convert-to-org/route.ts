/**
 * POST /api/vendor/pos/devices/convert-to-org  { device_sn }
 *
 * Migrate a device the caller currently owns as a single-user merchant
 * (store_devices.owner_user_id === auth.sub) into their store
 * (owner_store_id = stores.id, owner_user_id = NULL). Auto-adds the
 * caller as 'owner' in store_staff so they pass the claim gate when
 * scanning the device themselves.
 *
 * Why this exists: single-user merchants who upgrade to a vendor account
 * shouldn't have to disconnect + re-claim their devices. This is the
 * one-tap migration path.
 *
 * Side effects:
 * - claimed_by_user_id reset (the next staff scan starts a fresh shift)
 * - any open shift is closed
 * - claimed_at preserved (device hasn't been "released" — just retitled)
 */
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { corsHeaders, handleCORS } from "@/lib/cors";
import { supabase } from "@/lib/supabase";

export async function OPTIONS(request: NextRequest) {
  return handleCORS(request) || NextResponse.json({});
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);
  const auth = await authenticateRequest(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });

  const { data: store } = await supabase
    .from("stores")
    .select("id, name")
    .eq("merchant_id", auth.sub)
    .maybeSingle();
  if (!store) {
    return NextResponse.json(
      { error: "no_store", message: "Create a store first via Vendor Settings, then convert your devices." },
      { status: 404, headers }
    );
  }

  const body = await request.json().catch(() => ({}));
  const deviceSn = String((body as any).device_sn || "").trim();
  if (!deviceSn) {
    return NextResponse.json({ error: "device_sn_required" }, { status: 400, headers });
  }

  const { data: device } = await supabase
    .from("store_devices")
    .select("id, device_sn, owner_user_id, owner_store_id, status")
    .eq("device_sn", deviceSn)
    .maybeSingle();

  if (!device) {
    return NextResponse.json({ error: "device_not_found" }, { status: 404, headers });
  }
  if ((device as any).status !== "active") {
    return NextResponse.json({ error: "device_disabled" }, { status: 403, headers });
  }
  if ((device as any).owner_store_id) {
    return NextResponse.json(
      {
        error: "already_org_device",
        message: "This device is already assigned to a store.",
      },
      { status: 409, headers }
    );
  }
  if ((device as any).owner_user_id !== auth.sub) {
    return NextResponse.json(
      {
        error: "not_your_device",
        message: "Only the current owner can convert a device to org-owned.",
      },
      { status: 403, headers }
    );
  }

  const nowIso = new Date().toISOString();

  // Close any open shift the previous owner had on the device — the
  // shift was on the personal account; org workflow restarts fresh.
  await supabase
    .from("store_device_shifts")
    .update({ ended_at: nowIso, metadata: { closed_via: "convert_to_org" } })
    .eq("device_sn", deviceSn)
    .is("ended_at", null);

  // Atomic conversion: swap owner_user_id for owner_store_id.
  const { data: updated, error } = await supabase
    .from("store_devices")
    .update({
      owner_user_id: null,
      owner_store_id: (store as any).id,
      claimed_by_user_id: null,
      updated_at: nowIso,
    })
    .eq("id", (device as any).id)
    .select("device_sn, owner_store_id, terminal_label")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers });

  // Auto-stamp the caller as 'owner' in store_staff if not already there,
  // so they pass the org claim gate when they scan the device.
  await supabase
    .from("store_staff")
    .upsert(
      {
        store_id: (store as any).id,
        user_id: auth.sub,
        role: "owner",
        status: "approved",
        invited_via: "self_owner",
        joined_at: nowIso,
        removed_at: null,
        removed_by: null,
      },
      { onConflict: "store_id,user_id" }
    );

  return NextResponse.json(
    { ok: true, device: updated, store: { id: (store as any).id, name: (store as any).name } },
    { headers }
  );
}
